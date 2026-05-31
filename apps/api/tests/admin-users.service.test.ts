import {
  AdminUsersServiceError,
  createAdminUsersService,
} from "../modules/admin/services/admin-users.service";
import type { AppUser } from "../types/app";

function user(overrides: Partial<AppUser>): AppUser {
  return {
    id: 1,
    name: "User",
    email: "user@example.com",
    is_owner: false,
    is_admin: false,
    two_factor_enabled: false,
    is_seller: false,
    seller_access: false,
    nickname: "",
    avatar_url: "",
    theme: "dark",
    lang: "ru",
    email_verified: true,
    status: "active",
    banned_until: null,
    warning_count: 0,
    ...overrides,
  };
}

describe("admin users service owner protections", () => {
  test("blocks admin role changes from regular admins before touching the database", async () => {
    const pool = { query: jest.fn() };
    const service = createAdminUsersService(pool as any);

    await expect(
      service.setAdminRole(user({ id: 2, is_admin: true, two_factor_enabled: true }), 5, true, "security review"),
    ).rejects.toMatchObject({ code: "owner_only" } satisfies Partial<AdminUsersServiceError>);

    expect(pool.query).not.toHaveBeenCalled();
  });

  test("blocks owner role changes when owner has no 2FA", async () => {
    const pool = { query: jest.fn() };
    const service = createAdminUsersService(pool as any);

    await expect(
      service.setAdminRole(user({ id: 1, is_owner: true, is_admin: true, two_factor_enabled: false }), 5, true, "security review"),
    ).rejects.toMatchObject({ code: "two_factor_setup_required" } satisfies Partial<AdminUsersServiceError>);

    expect(pool.query).not.toHaveBeenCalled();
  });

  test("does not allow changing another owner account", async () => {
    const pool = {
      query: jest.fn().mockResolvedValueOnce({
        rows: [{ id: 5, is_owner: true, is_admin: true }],
      }),
    };
    const service = createAdminUsersService(pool as any);

    await expect(
      service.setAdminRole(user({ id: 1, is_owner: true, is_admin: true, two_factor_enabled: true }), 5, false, "security review"),
    ).rejects.toMatchObject({ code: "cannot_moderate_owner" } satisfies Partial<AdminUsersServiceError>);

    expect(pool.query).toHaveBeenCalledTimes(1);
  });

  test("blocks global action log from non-owner admins", async () => {
    const pool = { query: jest.fn() };
    const service = createAdminUsersService(pool as any);

    await expect(
      service.listActionLogs(user({ id: 2, is_admin: true, two_factor_enabled: true })),
    ).rejects.toMatchObject({ code: "owner_only" } satisfies Partial<AdminUsersServiceError>);

    expect(pool.query).not.toHaveBeenCalled();
  });
});
