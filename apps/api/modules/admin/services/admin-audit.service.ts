import type { Pool, PoolClient } from "pg";

import { getRequestContext } from "../../../middleware/request-context";
import type { AppUser } from "../../../types/app";

type Queryable = Pool | PoolClient;

export type AdminAuditInput = {
  actor?: Pick<AppUser, "id"> | null;
  action: string;
  entityType: string;
  entityId?: string | number | null;
  targetUserId?: number | null;
  summary?: string;
  metadata?: Record<string, unknown>;
};

export async function writeAdminAuditLog(db: Queryable, input: AdminAuditInput) {
  const context = getRequestContext();
  await db.query(
    `INSERT INTO admin_audit_logs
       (actor_user_id, action, entity_type, entity_id, target_user_id, summary, metadata_json, ip_address, user_agent)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      input.actor?.id || null,
      String(input.action || "").slice(0, 120),
      String(input.entityType || "").slice(0, 120),
      input.entityId == null ? "" : String(input.entityId).slice(0, 120),
      input.targetUserId || null,
      String(input.summary || "").slice(0, 500),
      JSON.stringify(input.metadata || {}),
      String(context?.ip || "").slice(0, 120),
      String(context?.userAgent || "").slice(0, 500),
    ],
  );
}

export async function listAdminAuditLogs(pool: Pool, limit = 100) {
  const safeLimit = Math.max(1, Math.min(200, Math.floor(Number(limit) || 100)));
  const result = await pool.query(
    `SELECT
        l.id,
        l.actor_user_id,
        actor.name AS actor_name,
        l.action,
        l.entity_type,
        l.entity_id,
        l.target_user_id,
        target.name AS target_name,
        l.summary,
        l.metadata_json,
        l.ip_address,
        l.user_agent,
        l.created_at
       FROM admin_audit_logs l
       LEFT JOIN users actor ON actor.id = l.actor_user_id
       LEFT JOIN users target ON target.id = l.target_user_id
       ORDER BY l.created_at DESC, l.id DESC
       LIMIT $1`,
    [safeLimit],
  );

  return result.rows || [];
}
