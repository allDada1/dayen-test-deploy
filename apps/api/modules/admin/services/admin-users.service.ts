import type { AppUser } from "../../../types/app";
import { parseRequiredString } from "../../../utils/validation";
import type { AdminUserRow } from "../repositories/admin-users.repository";
import { createAdminUsersRepository } from "../repositories/admin-users.repository";
import type { Pool } from "pg";
import { listAdminAuditLogs, writeAdminAuditLog } from "./admin-audit.service";

export type AdminUsersServiceErrorCode =
  | "bad_user_id"
  | "user_not_found"
  | "bad_reason"
  | "bad_ban_until"
  | "owner_only"
  | "two_factor_setup_required"
  | "cannot_moderate_self"
  | "cannot_moderate_owner"
  | "cannot_moderate_admin"
  | "nothing_to_update";

export class AdminUsersServiceError extends Error {
  code: AdminUsersServiceErrorCode;

  constructor(code: AdminUsersServiceErrorCode) {
    super(code);
    this.code = code;
  }
}

function normalizePage(value: unknown) {
  const page = Math.max(1, Number(value || 1) || 1);
  return Math.floor(page);
}

function normalizeLimit(value: unknown) {
  const limit = Math.max(1, Math.min(50, Number(value || 20) || 20));
  return Math.floor(limit);
}

function normalizeStatus(value: unknown) {
  const status = String(value || "all").trim();
  return ["all", "active", "temporarily_banned", "banned"].includes(status) ? status : "all";
}

function normalizeRole(value: unknown) {
  const role = String(value || "all").trim();
  return ["all", "owner", "admin", "seller", "buyer"].includes(role) ? role : "all";
}

function parseReason(value: unknown) {
  return parseRequiredString(value, { min: 3, max: 500, normalize: true });
}

function parseOptionalText(value: unknown, max = 120) {
  if (value === undefined) return undefined;
  return String(value || "").trim().slice(0, max);
}

function parseBanUntil(value: unknown) {
  if (!value) return null;
  const date = new Date(String(value));
  if (!Number.isFinite(date.getTime()) || date.getTime() <= Date.now()) {
    throw new AdminUsersServiceError("bad_ban_until");
  }
  return date.toISOString();
}

function formatBanUntil(value: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleString("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function toModerationUser(row: AdminUserRow) {
  return {
    id: Number(row.id),
    name: row.name,
    email: row.email,
    is_owner: !!row.is_owner,
    is_admin: !!row.is_admin,
    is_seller: !!row.is_seller,
    seller_access: !!row.seller_access,
    nickname: row.nickname || "",
    avatar_url: row.avatar_url || "",
    status: row.status || "active",
    banned_until: row.banned_until || null,
    restrictions: safeJson(row.restrictions_json, {}),
    warning_count: Number(row.warning_count || 0),
    moderation_note: row.moderation_note || "",
    products_count: Number(row.products_count || 0),
    orders_count: Number(row.orders_count || 0),
  };
}

function safeJson<T>(value: unknown, fallback: T): T {
  try {
    const parsed = JSON.parse(String(value || ""));
    return parsed && typeof parsed === "object" ? (parsed as T) : fallback;
  } catch {
    return fallback;
  }
}

export function createAdminUsersService(pool: Pool) {
  const repository = createAdminUsersRepository(pool);

  async function ensureTarget(actor: AppUser, targetUserId: number) {
    if (!Number.isFinite(targetUserId) || targetUserId <= 0) {
      throw new AdminUsersServiceError("bad_user_id");
    }

    const target = await repository.getUserById(targetUserId);
    if (!target) throw new AdminUsersServiceError("user_not_found");

    if (actor.id === Number(target.id)) {
      throw new AdminUsersServiceError("cannot_moderate_self");
    }

    if (target.is_owner) {
      throw new AdminUsersServiceError("cannot_moderate_owner");
    }

    if (target.is_admin && !actor.is_owner) {
      throw new AdminUsersServiceError("cannot_moderate_admin");
    }

    return target;
  }

  async function listUsers(query: Record<string, unknown>) {
    const page = normalizePage(query.page);
    const limit = normalizeLimit(query.limit);
    const response = await repository.listUsers({
      page,
      limit,
      q: String(query.q || "").trim(),
      status: normalizeStatus(query.status),
      role: normalizeRole(query.role),
    });

    return {
      users: response.users.map(toModerationUser),
      total: response.total,
      page,
      limit,
      total_pages: Math.max(1, Math.ceil(response.total / limit)),
    };
  }

  async function getUser(targetUserId: number) {
    const target = await repository.getUserById(targetUserId);
    if (!target) throw new AdminUsersServiceError("user_not_found");

    const audit = await repository.listAuditLogs(targetUserId, 30);
    return {
      user: toModerationUser(target),
      audit: audit.map((item) => ({
        ...item,
        metadata: safeJson(item.metadata_json, {}),
      })),
    };
  }

  async function warnUser(actor: AppUser, targetUserId: number, reasonValue: unknown) {
    const reason = parseReason(reasonValue);
    if (!reason) throw new AdminUsersServiceError("bad_reason");

    const before = await ensureTarget(actor, targetUserId);
    const updated = await repository.warnUser(targetUserId, reason);
    if (!updated) throw new AdminUsersServiceError("user_not_found");

    await repository.addAuditLog({
      actorUserId: actor.id,
      targetUserId,
      action: "warning",
      reason,
      metadata: { warning_count_before: Number(before.warning_count || 0), warning_count_after: Number(updated.warning_count || 0) },
    });
    await writeAdminAuditLog(pool, {
      actor,
      action: "user.warning",
      entityType: "user",
      entityId: targetUserId,
      targetUserId,
      summary: "Issued user warning",
      metadata: { reason, warning_count_before: Number(before.warning_count || 0), warning_count_after: Number(updated.warning_count || 0) },
    });
    await repository.addNotification({
      userId: targetUserId,
      title: "Предупреждение аккаунта",
      body: `Вам выдано предупреждение. Причина: ${reason}`,
      link: "/notifications",
    });

    return toModerationUser(updated);
  }

  async function banUser(actor: AppUser, targetUserId: number, input: { reason?: unknown; banned_until?: unknown }) {
    const reason = parseReason(input.reason);
    if (!reason) throw new AdminUsersServiceError("bad_reason");

    const bannedUntil = parseBanUntil(input.banned_until);
    const before = await ensureTarget(actor, targetUserId);
    const updated = await repository.banUser(targetUserId, bannedUntil, reason);
    if (!updated) throw new AdminUsersServiceError("user_not_found");

    await repository.addAuditLog({
      actorUserId: actor.id,
      targetUserId,
      action: bannedUntil ? "temporary_ban" : "permanent_ban",
      reason,
      metadata: { previous_status: before.status, previous_banned_until: before.banned_until, banned_until: bannedUntil },
    });
    await writeAdminAuditLog(pool, {
      actor,
      action: bannedUntil ? "user.temporary_ban" : "user.permanent_ban",
      entityType: "user",
      entityId: targetUserId,
      targetUserId,
      summary: bannedUntil ? "Temporarily banned user" : "Permanently banned user",
      metadata: { reason, previous_status: before.status, previous_banned_until: before.banned_until, banned_until: bannedUntil },
    });
    await repository.addNotification({
      userId: targetUserId,
      title: bannedUntil ? "Временная блокировка аккаунта" : "Блокировка аккаунта",
      body: bannedUntil
        ? `Ваш аккаунт временно заблокирован до ${formatBanUntil(bannedUntil)}. Причина: ${reason}`
        : `Ваш аккаунт заблокирован. Причина: ${reason}`,
      link: "/notifications",
    });

    return toModerationUser(updated);
  }

  async function unbanUser(actor: AppUser, targetUserId: number, reasonValue: unknown) {
    const reason = parseReason(reasonValue);
    if (!reason) throw new AdminUsersServiceError("bad_reason");

    const before = await ensureTarget(actor, targetUserId);
    const updated = await repository.unbanUser(targetUserId, reason);
    if (!updated) throw new AdminUsersServiceError("user_not_found");

    await repository.addAuditLog({
      actorUserId: actor.id,
      targetUserId,
      action: "unban",
      reason,
      metadata: { previous_status: before.status, previous_banned_until: before.banned_until },
    });
    await writeAdminAuditLog(pool, {
      actor,
      action: "user.unban",
      entityType: "user",
      entityId: targetUserId,
      targetUserId,
      summary: "Unbanned user",
      metadata: { reason, previous_status: before.status, previous_banned_until: before.banned_until },
    });
    await repository.addNotification({
      userId: targetUserId,
      title: "Блокировка снята",
      body: `Ограничение аккаунта снято. Причина: ${reason}`,
      link: "/notifications",
    });

    return toModerationUser(updated);
  }

  async function updateUserProfile(
    actor: AppUser,
    targetUserId: number,
    input: { name?: unknown; nickname?: unknown; avatar_url?: unknown; reason?: unknown },
  ) {
    const reason = parseReason(input.reason);
    if (!reason) throw new AdminUsersServiceError("bad_reason");

    const payload = {
      name: parseOptionalText(input.name, 80),
      nickname: parseOptionalText(input.nickname, 80),
      avatar_url: parseOptionalText(input.avatar_url, 500),
      reason,
    };

    if (payload.name === undefined && payload.nickname === undefined && payload.avatar_url === undefined) {
      throw new AdminUsersServiceError("nothing_to_update");
    }

    const before = await ensureTarget(actor, targetUserId);
    const updated = await repository.updateUserProfile(targetUserId, payload);
    if (!updated) throw new AdminUsersServiceError("user_not_found");

    await repository.addAuditLog({
      actorUserId: actor.id,
      targetUserId,
      action: "profile_update",
      reason,
      metadata: {
        before: { name: before.name, nickname: before.nickname, avatar_url: before.avatar_url },
        after: { name: updated.name, nickname: updated.nickname, avatar_url: updated.avatar_url },
      },
    });
    await writeAdminAuditLog(pool, {
      actor,
      action: "user.profile_update",
      entityType: "user",
      entityId: targetUserId,
      targetUserId,
      summary: "Updated user profile from admin panel",
      metadata: {
        reason,
        before: { name: before.name, nickname: before.nickname, avatar_url: before.avatar_url },
        after: { name: updated.name, nickname: updated.nickname, avatar_url: updated.avatar_url },
      },
    });

    return toModerationUser(updated);
  }

  async function setAdminRole(actor: AppUser, targetUserId: number, isAdmin: boolean, reasonValue: unknown) {
    if (!actor.is_owner) throw new AdminUsersServiceError("owner_only");
    if (!actor.two_factor_enabled) throw new AdminUsersServiceError("two_factor_setup_required");

    const reason = parseReason(reasonValue);
    if (!reason) throw new AdminUsersServiceError("bad_reason");

    const before = await ensureTarget(actor, targetUserId);
    const updated = await repository.setAdminRole(targetUserId, isAdmin, reason);
    if (!updated) throw new AdminUsersServiceError("user_not_found");

    const action = isAdmin ? "admin_granted" : "admin_revoked";
    await repository.addAuditLog({
      actorUserId: actor.id,
      targetUserId,
      action,
      reason,
      metadata: { is_admin_before: !!before.is_admin, is_admin_after: !!updated.is_admin },
    });
    await writeAdminAuditLog(pool, {
      actor,
      action: isAdmin ? "user.admin_granted" : "user.admin_revoked",
      entityType: "user",
      entityId: targetUserId,
      targetUserId,
      summary: isAdmin ? "Granted admin role" : "Revoked admin role",
      metadata: { reason, is_admin_before: !!before.is_admin, is_admin_after: !!updated.is_admin },
    });
    await repository.addNotification({
      userId: targetUserId,
      title: isAdmin ? "Роль администратора выдана" : "Роль администратора снята",
      body: isAdmin
        ? "Владелец проекта выдал вам доступ администратора."
        : "Владелец проекта снял с вас доступ администратора.",
      link: "/notifications",
    });

    return toModerationUser(updated);
  }

  async function listAuditLogs(targetUserId?: number) {
    const logs = await repository.listAuditLogs(targetUserId, 100);
    return logs.map((item) => ({
      ...item,
      metadata: safeJson(item.metadata_json, {}),
    }));
  }

  async function listActionLogs(actor: AppUser, limit?: number) {
    if (!actor.is_owner) throw new AdminUsersServiceError("owner_only");
    if (!actor.two_factor_enabled) throw new AdminUsersServiceError("two_factor_setup_required");

    const logs = await listAdminAuditLogs(pool, limit);
    return logs.map((item) => ({
      ...item,
      metadata: safeJson(item.metadata_json, {}),
    }));
  }

  return {
    listUsers,
    getUser,
    warnUser,
    banUser,
    unbanUser,
    updateUserProfile,
    setAdminRole,
    listAuditLogs,
    listActionLogs,
  };
}
