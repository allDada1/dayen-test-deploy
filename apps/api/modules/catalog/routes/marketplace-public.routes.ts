import express from "express";
import type { Pool } from "pg";

import { ok, serverError } from "../../../utils/http";

type MarketplacePublicRouterOptions = {
  pool: Pool;
};

export function createMarketplacePublicRouter({ pool }: MarketplacePublicRouterOptions) {
  const router = express.Router();

  router.get("/sections", async (_req, res) => {
    try {
      const result = await pool.query(
        `SELECT id, title, slug, icon_url, emoji, sort_order, is_active
         FROM marketplace_sections
         WHERE COALESCE(is_active, 1) = 1
         ORDER BY sort_order ASC, id ASC`,
      );

      return ok(res, { items: result.rows || [] });
    } catch (error) {
      console.error("GET /api/sections error:", error);
      return serverError(res);
    }
  });

  router.get("/home-banner", async (_req, res) => {
    try {
      const result = await pool.query(
        `SELECT id, eyebrow, title, description, cta_label, cta_href, image_url, is_active, sort_order
         FROM home_hero_banners
         WHERE COALESCE(is_active, 0) = 1
         ORDER BY sort_order ASC, id ASC
         LIMIT 1`,
      );

      return ok(res, { banner: result.rows[0] || null });
    } catch (error) {
      console.error("GET /api/home-banner error:", error);
      return serverError(res);
    }
  });

  router.get("/page-banners/:pageKey", async (req, res) => {
    try {
      const pageKey = String(req.params.pageKey || "").trim().toLowerCase();
      if (!/^[a-z0-9:_-]{2,120}$/.test(pageKey)) return ok(res, { banner: null });

      const result = await pool.query(
        `SELECT id, page_key, eyebrow, title, description, cta_label, cta_href, image_url, is_active, sort_order
         FROM page_banners
         WHERE page_key = $1 AND COALESCE(is_active, 0) = 1
         ORDER BY sort_order ASC, id ASC
         LIMIT 1`,
        [pageKey],
      );

      return ok(res, { banner: result.rows[0] || null });
    } catch (error) {
      console.error("GET /api/page-banners/:pageKey error:", error);
      return serverError(res);
    }
  });

  return router;
}
