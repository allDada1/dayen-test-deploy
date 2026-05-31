import { createAuthRouter } from "../modules/auth/routes/auth.routes";

function mockResponse() {
  const res: any = {
    body: null,
    statusCode: 200,
    json: jest.fn((body) => {
      res.body = body;
      return res;
    }),
    status: jest.fn((statusCode) => {
      res.statusCode = statusCode;
      return res;
    }),
  };

  return res;
}

function authHandler(path: string, pool: any) {
  const router = createAuthRouter({
    pool,
    authRequired: jest.fn(),
    hashPassword: (password, salt) => `${salt}:${password}`,
    makeSalt: () => "new-salt",
    makeToken: () => "token",
    nowPlusDays: () => "2099-01-01T00:00:00.000Z",
    emailService: {
      sendPasswordResetEmail: jest.fn(),
      sendEmailVerificationEmail: jest.fn(),
    },
  }) as any;

  const layer = router.stack.find((item: any) => item.route?.path === path);
  return layer.route.stack.at(-1).handle;
}

describe("auth routes", () => {
  test("change-password updates hash and removes other sessions", async () => {
    const client = {
      query: jest.fn().mockResolvedValue({ rows: [], rowCount: 1 }),
      release: jest.fn(),
    };
    const pool = {
      query: jest.fn().mockResolvedValueOnce({
        rows: [
          {
            id: 5,
            name: "User",
            email: "user@gmail.com",
            is_owner: false,
            is_admin: false,
            two_factor_enabled: false,
            pass_salt: "old-salt",
            pass_hash: "old-salt:Current123",
          },
        ],
      }),
      connect: jest.fn().mockResolvedValueOnce(client),
    };
    const handler = authHandler("/auth/change-password", pool);
    const req = {
      body: {
        current_password: "Current123",
        new_password: "NewPassword123",
      },
      user: { id: 5 },
      token: "raw-token",
    } as any;
    const res = mockResponse();

    await handler(req, res);

    expect(res.body).toEqual({ ok: true, message: "password_changed" });
    expect(client.query).toHaveBeenNthCalledWith(2, "UPDATE users SET pass_salt = $1, pass_hash = $2 WHERE id = $3", [
      "new-salt",
      "new-salt:NewPassword123",
      5,
    ]);
    expect(client.query).toHaveBeenNthCalledWith(4, expect.stringContaining("DELETE FROM sessions"), [
      5,
      expect.any(String),
      "raw-token",
    ]);
    expect(client.release).toHaveBeenCalled();
  });

  test("change-password rejects wrong current password before transaction", async () => {
    const pool = {
      query: jest.fn().mockResolvedValueOnce({
        rows: [
          {
            id: 5,
            two_factor_enabled: false,
            pass_salt: "old-salt",
            pass_hash: "old-salt:Current123",
          },
        ],
      }),
      connect: jest.fn(),
    };
    const handler = authHandler("/auth/change-password", pool);
    const req = {
      body: {
        current_password: "Wrong123",
        new_password: "NewPassword123",
      },
      user: { id: 5 },
      token: "raw-token",
    } as any;
    const res = mockResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ ok: false, error: "bad_credentials" });
    expect(pool.connect).not.toHaveBeenCalled();
  });

  test("change-password requires 2FA code when 2FA is enabled", async () => {
    const pool = {
      query: jest.fn().mockResolvedValueOnce({
        rows: [
          {
            id: 5,
            two_factor_enabled: true,
            two_factor_secret: "SECRET",
            pass_salt: "old-salt",
            pass_hash: "old-salt:Current123",
          },
        ],
      }),
      connect: jest.fn(),
    };
    const handler = authHandler("/auth/change-password", pool);
    const req = {
      body: {
        current_password: "Current123",
        new_password: "NewPassword123",
      },
      user: { id: 5 },
      token: "raw-token",
    } as any;
    const res = mockResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ ok: false, error: "missing_2fa_code" });
    expect(pool.connect).not.toHaveBeenCalled();
  });
});
