import type { Pool } from "pg";

export type AdminUserRow = {
  id: number;
  name: string;
  email: string;
  is_owner: boolean;
  is_admin: boolean;
  is_seller: boolean;
  seller_access: boolean;
  nickname: string | null;
  avatar_url: string | null;
  status: string;
  banned_until: string | Date | null;
  restrictions_json: string | null;
  warning_count: number;
  moderation_note: string | null;
  created_at?: string | Date | null;
  products_count?: number | string;
  orders_count?: number | string;
};

export type ModerationActionRow = {
  id: number;
  actor_user_id: number | null;
  actor_name: string | null;
  target_user_id: number;
  target_name: string | null;
  action: string;
  reason: string;
  metadata_json: string | null;
  created_at: string | Date;
};

export type ListUsersParams = {
  q?: string;
  status?: string;
  role?: string;
  page: number;
  limit: number;
};

export function createAdminUsersRepository(pool: Pool) {
  function buildWhere(params: ListUsersParams) {
    const where: string[] = [];
    const values: unknown[] = [];

    const q = String(params.q || "").trim();
    if (q) {
      values.push(`%${q.toLowerCase()}%`);
      const index = values.length;
      where.push(`(
        LOWER(u.name) LIKE $${index}
        OR LOWER(u.email) LIKE $${index}
        OR LOWER(COALESCE(u.nickname, '')) LIKE $${index}
        OR CAST(u.id AS TEXT) LIKE $${index}
      )`);
    }

    if (params.status && params.status !== "all") {
      values.push(params.status);
      where.push(`u.status = $${values.length}`);
    }

    if (params.role === "owner") {
      where.push(`COALESCE(u.is_owner, false) = TRUE`);
    } else if (params.role === "admin") {
      where.push(`u.is_admin = TRUE AND COALESCE(u.is_owner, false) = FALSE`);
    } else if (params.role === "seller") {
      where.push(`u.is_seller = TRUE`);
    } else if (params.role === "buyer") {
      where.push(`COALESCE(u.is_owner, false) = FALSE AND u.is_admin = FALSE AND u.is_seller = FALSE`);
    }

    return {
      clause: where.length ? `WHERE ${where.join(" AND ")}` : "",
      values,
    };
  }

  async function listUsers(params: ListUsersParams) {
    const { clause, values } = buildWhere(params);
    const offset = (params.page - 1) * params.limit;

    const totalResult = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM users u ${clause}`,
      values,
    );

    const result = await pool.query<AdminUserRow>(
      `SELECT
          u.id, u.name, u.email, COALESCE(u.is_owner, false) AS is_owner, u.is_admin, u.is_seller,
          COALESCE(u.seller_access, false) AS seller_access,
          COALESCE(u.nickname, '') AS nickname,
          COALESCE(u.avatar_url, '') AS avatar_url,
          COALESCE(u.status, 'active') AS status,
          u.banned_until,
          COALESCE(u.restrictions_json, '{}') AS restrictions_json,
          COALESCE(u.warning_count, 0) AS warning_count,
          COALESCE(u.moderation_note, '') AS moderation_note,
          COALESCE(pc.products_count, 0) AS products_count,
          COALESCE(oc.orders_count, 0) AS orders_count
         FROM users u
         LEFT JOIN (
           SELECT owner_user_id, COUNT(*)::int AS products_count
             FROM products
            WHERE owner_user_id IS NOT NULL
            GROUP BY owner_user_id
         ) pc ON pc.owner_user_id = u.id
         LEFT JOIN (
           SELECT user_id, COUNT(*)::int AS orders_count
             FROM orders
            GROUP BY user_id
         ) oc ON oc.user_id = u.id
         ${clause}
         ORDER BY u.id DESC
         LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, params.limit, offset],
    );

    return {
      users: result.rows,
      total: Number(totalResult.rows[0]?.count || 0),
    };
  }

  async function getUserById(id: number) {
    const result = await pool.query<AdminUserRow>(
      `SELECT
          u.id, u.name, u.email, COALESCE(u.is_owner, false) AS is_owner, u.is_admin, u.is_seller,
          COALESCE(u.seller_access, false) AS seller_access,
          COALESCE(u.nickname, '') AS nickname,
          COALESCE(u.avatar_url, '') AS avatar_url,
          COALESCE(u.status, 'active') AS status,
          u.banned_until,
          COALESCE(u.restrictions_json, '{}') AS restrictions_json,
          COALESCE(u.warning_count, 0) AS warning_count,
          COALESCE(u.moderation_note, '') AS moderation_note,
          COALESCE(pc.products_count, 0) AS products_count,
          COALESCE(oc.orders_count, 0) AS orders_count
         FROM users u
         LEFT JOIN (
           SELECT owner_user_id, COUNT(*)::int AS products_count
             FROM products
            WHERE owner_user_id IS NOT NULL
            GROUP BY owner_user_id
         ) pc ON pc.owner_user_id = u.id
         LEFT JOIN (
           SELECT user_id, COUNT(*)::int AS orders_count
             FROM orders
            GROUP BY user_id
         ) oc ON oc.user_id = u.id
        WHERE u.id = $1
        LIMIT 1`,
      [id],
    );

    return result.rows[0] || null;
  }

  async function warnUser(targetUserId: number, reason: string) {
    const result = await pool.query<AdminUserRow>(
      `UPDATE users
          SET warning_count = COALESCE(warning_count, 0) + 1,
              moderation_note = $2
        WHERE id = $1
        RETURNING id, name, email, COALESCE(is_owner, false) AS is_owner, is_admin, is_seller, seller_access, nickname, avatar_url,
                  status, banned_until, restrictions_json, warning_count, moderation_note`,
      [targetUserId, reason],
    );
    return result.rows[0] || null;
  }

  async function banUser(targetUserId: number, bannedUntil: string | null, reason: string) {
    const status = bannedUntil ? "temporarily_banned" : "banned";
    const result = await pool.query<AdminUserRow>(
      `UPDATE users
          SET status = $2,
              banned_until = $3,
              moderation_note = $4
        WHERE id = $1
        RETURNING id, name, email, COALESCE(is_owner, false) AS is_owner, is_admin, is_seller, seller_access, nickname, avatar_url,
                  status, banned_until, restrictions_json, warning_count, moderation_note`,
      [targetUserId, status, bannedUntil, reason],
    );
    return result.rows[0] || null;
  }

  async function unbanUser(targetUserId: number, reason: string) {
    const result = await pool.query<AdminUserRow>(
      `UPDATE users
          SET status = 'active',
              banned_until = NULL,
              moderation_note = $2
        WHERE id = $1
        RETURNING id, name, email, COALESCE(is_owner, false) AS is_owner, is_admin, is_seller, seller_access, nickname, avatar_url,
                  status, banned_until, restrictions_json, warning_count, moderation_note`,
      [targetUserId, reason],
    );
    return result.rows[0] || null;
  }

  async function updateUserProfile(targetUserId: number, input: { name?: string; nickname?: string; avatar_url?: string; reason: string }) {
    const result = await pool.query<AdminUserRow>(
      `UPDATE users
          SET name = COALESCE($2, name),
              nickname = COALESCE($3, nickname),
              avatar_url = COALESCE($4, avatar_url),
              moderation_note = $5
        WHERE id = $1
        RETURNING id, name, email, COALESCE(is_owner, false) AS is_owner, is_admin, is_seller, seller_access, nickname, avatar_url,
                  status, banned_until, restrictions_json, warning_count, moderation_note`,
      [
        targetUserId,
        input.name === undefined ? null : input.name,
        input.nickname === undefined ? null : input.nickname,
        input.avatar_url === undefined ? null : input.avatar_url,
        input.reason,
      ],
    );
    return result.rows[0] || null;
  }

  async function setAdminRole(targetUserId: number, isAdmin: boolean, reason: string) {
    const result = await pool.query<AdminUserRow>(
      `UPDATE users
          SET is_admin = $2,
              moderation_note = $3
        WHERE id = $1
        RETURNING id, name, email, COALESCE(is_owner, false) AS is_owner, is_admin, is_seller, seller_access, nickname, avatar_url,
                  status, banned_until, restrictions_json, warning_count, moderation_note`,
      [targetUserId, isAdmin, reason],
    );
    return result.rows[0] || null;
  }

  async function addAuditLog(input: {
    actorUserId: number;
    targetUserId: number;
    action: string;
    reason: string;
    metadata: Record<string, unknown>;
  }) {
    await pool.query(
      `INSERT INTO user_moderation_actions
        (actor_user_id, target_user_id, action, reason, metadata_json)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        input.actorUserId,
        input.targetUserId,
        input.action,
        input.reason,
        JSON.stringify(input.metadata || {}),
      ],
    );
  }

  async function addNotification(input: {
    userId: number;
    title: string;
    body: string;
    link?: string;
  }) {
    await pool.query(
      `INSERT INTO notifications (user_id, title, body, link)
       VALUES ($1, $2, $3, $4)`,
      [input.userId, input.title, input.body, input.link || "/notifications"],
    );
  }

  async function listAuditLogs(targetUserId?: number, limit = 50) {
    const values: unknown[] = [];
    const where = targetUserId ? "WHERE a.target_user_id = $1" : "";
    if (targetUserId) values.push(targetUserId);
    values.push(limit);

    const result = await pool.query<ModerationActionRow>(
      `SELECT
          a.id, a.actor_user_id, actor.name AS actor_name,
          a.target_user_id, target.name AS target_name,
          a.action, a.reason, a.metadata_json, a.created_at
         FROM user_moderation_actions a
         LEFT JOIN users actor ON actor.id = a.actor_user_id
         LEFT JOIN users target ON target.id = a.target_user_id
         ${where}
         ORDER BY a.created_at DESC, a.id DESC
         LIMIT $${values.length}`,
      values,
    );

    return result.rows;
  }

  return {
    listUsers,
    getUserById,
    warnUser,
    banUser,
    unbanUser,
    updateUserProfile,
    setAdminRole,
    addAuditLog,
    addNotification,
    listAuditLogs,
  };
}
