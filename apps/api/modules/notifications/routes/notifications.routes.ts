import express from "express";
import type { NextFunction, Response } from "express";
import type { Pool } from "pg";

import type { AuthenticatedRequest } from "../../../types/app";
import { ok, serverError } from "../../../utils/http";
import { parseIdArray } from "../../../utils/validation";

type AuthMiddleware = (req: AuthenticatedRequest, res: Response, next: NextFunction) => unknown;

type NotificationsRouterOptions = {
  pool: Pool;
  authRequired: AuthMiddleware;
};

type NotificationRow = {
  id: number;
  title: string;
  body: string;
  link: string | null;
  is_read: boolean;
  created_at: string;
};

export function createNotificationsRouter({ pool, authRequired }: NotificationsRouterOptions) {
  const router = express.Router();

  router.get("/notifications", authRequired, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;

      const result = await pool.query<NotificationRow>(
        `SELECT id, title, body, link, is_read, created_at
         FROM notifications
         WHERE user_id = $1
         ORDER BY id DESC
         LIMIT 50`,
        [userId],
      );

      const rows = result.rows || [];
      const unread = rows.filter((row) => !row.is_read).length;

      return ok(res, {
        unread_count: unread,
        items: rows,
      });
    } catch (error) {
      console.error("GET /api/notifications error:", error);
      return serverError(res);
    }
  });

  router.post("/notifications/read", authRequired, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;
      const ids = parseIdArray(req.body?.ids);

      if (!ids.length) return ok(res, { updated: 0 });

      const placeholders = ids.map((_, i) => `$${i + 2}`).join(",");
      const result = await pool.query(
        `UPDATE notifications
         SET is_read = TRUE
         WHERE user_id = $1
           AND id IN (${placeholders})`,
        [userId, ...ids],
      );

      return ok(res, { updated: result.rowCount || 0 });
    } catch (error) {
      console.error("POST /api/notifications/read error:", error);
      return serverError(res);
    }
  });

  router.post("/notifications/clear", authRequired, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;

      const result = await pool.query(
        `DELETE FROM notifications
         WHERE user_id = $1
           AND is_read = TRUE`,
        [userId],
      );

      return ok(res, { deleted: result.rowCount || 0 });
    } catch (error) {
      console.error("POST /api/notifications/clear error:", error);
      return serverError(res);
    }
  });

  return router;
}
