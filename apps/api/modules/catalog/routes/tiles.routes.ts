import express from "express";
import type { Pool } from "pg";

import { ok, serverError } from "../../../utils/http";

type TilesRouterOptions = {
  pool: Pool;
};

export function createTilesRouter({ pool }: TilesRouterOptions) {
  const router = express.Router();

  router.get("/tiles", async (_req, res) => {
    try {
      const r = await pool.query(
        `SELECT id, title, slug, emoji, icon_url, section, sort_order
         FROM categories
         WHERE COALESCE(is_active, 1) = 1
         ORDER BY section ASC, sort_order ASC, id ASC`,
      );

      return ok(res, { tiles: r.rows || [] });
    } catch (error) {
      console.error("GET /api/tiles error:", error);
      return serverError(res);
    }
  });

  return router;
}
