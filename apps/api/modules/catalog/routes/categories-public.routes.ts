import express from "express";
import type { Pool } from "pg";

import { badRequest, ok, serverError } from "../../../utils/http";

type ProductRow = Record<string, any>;

type CategoriesPublicRouterOptions = {
  pool: Pool;
  attachImagesToProducts: (rows: ProductRow[]) => Promise<ProductRow[]>;
  withProductStats: (rows: ProductRow[], userId: number | null, callback: (rows: ProductRow[]) => unknown) => Promise<unknown>;
};

type CategoryRow = {
  id: number;
  group_name: string | null;
  section: string | null;
  title: string;
  slug: string;
  icon_url: string | null;
  emoji: string | null;
  sort_order: number | null;
  is_active: boolean | number | null;
};

type CategoryGroupRow = {
  group_name: string | null;
  tiles_count: number;
};

export function createCategoriesPublicRouter({
  pool,
  attachImagesToProducts,
  withProductStats,
}: CategoriesPublicRouterOptions) {
  const router = express.Router();

  router.get("/categories", async (_req, res) => {
    try {
      const result = await pool.query<CategoryRow>(
        `SELECT id, group_name, section, title, slug, icon_url, emoji, sort_order, is_active
         FROM categories
         WHERE COALESCE(is_active, 1) = 1
         ORDER BY section ASC, sort_order ASC, id ASC`,
      );

      return ok(res, { items: result.rows || [] });
    } catch (error) {
      console.error("GET /api/categories error:", error);
      return serverError(res);
    }
  });

  router.get("/category-groups", async (_req, res) => {
    try {
      const result = await pool.query<CategoryGroupRow>(
        `SELECT group_name, COUNT(*)::int AS tiles_count
         FROM categories
         WHERE COALESCE(is_active, 1) = 1
         GROUP BY group_name
         ORDER BY group_name ASC`,
      );

      return ok(res, { items: result.rows || [] });
    } catch (error) {
      console.error("GET /api/category-groups error:", error);
      return serverError(res);
    }
  });

  router.get("/tiles/:slug/products", async (req, res) => {
    try {
      const slug = String(req.params.slug || "").trim().toLowerCase();
      if (!slug) {
        return badRequest(res, "bad_slug");
      }

      const result = await pool.query<ProductRow>(
        `SELECT p.*
         FROM products p
         LEFT JOIN users seller_user ON seller_user.id = p.owner_user_id
         WHERE LOWER(COALESCE(p.tile_slug, '')) = $1
           AND (p.owner_user_id IS NULL OR COALESCE(seller_user.is_seller, FALSE) = TRUE)
         ORDER BY p.id DESC`,
        [slug],
      );

      let rows = result.rows || [];

      try {
        rows = await attachImagesToProducts(rows);
      } catch (error) {
        console.error("tile products attachImages error:", error);
      }

      return await withProductStats(rows, null, (out) => ok(res, { items: out }));
    } catch (error) {
      console.error("GET /api/tiles/:slug/products error:", error);
      return serverError(res);
    }
  });

  return router;
}
