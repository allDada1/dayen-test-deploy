import express from "express";
import type { NextFunction, Response } from "express";
import type { Pool } from "pg";

import type { AuthenticatedRequest } from "../../../types/app";
import { badRequest, fail, notFound, ok, serverError } from "../../../utils/http";
import { toPositiveInt } from "../../../utils/validation";

type AuthMiddleware = (req: AuthenticatedRequest, res: Response, next: NextFunction) => unknown;
type ProductRow = Record<string, any>;

type SellersRouterOptions = {
  pool: Pool;
  authRequired: AuthMiddleware;
  attachImagesToProducts: (rows: ProductRow[]) => Promise<ProductRow[]>;
  withProductStats: (rows: ProductRow[], userId: number | null, callback: (rows: ProductRow[]) => unknown) => Promise<unknown>;
};

type SellerAccessRow = {
  status: string | null;
  admin_comment: string | null;
  reviewed_at: string | null;
};

type SellerRow = {
  id: number;
  name: string;
  nickname: string;
  avatar_url: string;
  seller_banner_url: string;
  seller_about: string;
  seller_telegram: string;
  seller_instagram: string;
  seller_whatsapp: string;
  seller_tiktok: string;
  is_seller: boolean;
};

const INACTIVE_SELLER_REQUEST_SQL = `
  SELECT status,
         COALESCE(admin_comment, '') AS admin_comment,
         reviewed_at
  FROM seller_requests
  WHERE user_id = $1
  ORDER BY reviewed_at DESC NULLS LAST, id DESC
  LIMIT 1`;

async function getInactiveSellerPayload(pool: Pool, userId: number) {
  const result = await pool.query<SellerAccessRow>(INACTIVE_SELLER_REQUEST_SQL, [userId]);
  const row = result.rows[0] || null;
  return {
    error: "seller_inactive",
    message: "Магазин временно недоступен.",
    admin_comment: row?.admin_comment || "",
    seller_status: row?.status || "inactive",
    reviewed_at: row?.reviewed_at || null,
  };
}

export function createSellersRouter({
  pool,
  authRequired,
  attachImagesToProducts,
  withProductStats,
}: SellersRouterOptions) {
  const router = express.Router();

  router.get("/sellers/:id", async (req, res) => {
    try {
      const id = toPositiveInt(req.params.id);
      if (!id) return badRequest(res, "bad_id");

      const sellerRes = await pool.query<SellerRow>(
        `SELECT
           id,
           name,
           COALESCE(nickname, '') AS nickname,
           COALESCE(avatar_url, '') AS avatar_url,
           COALESCE(seller_banner_url, '') AS seller_banner_url,
           COALESCE(seller_about, '') AS seller_about,
           COALESCE(seller_telegram, '') AS seller_telegram,
           COALESCE(seller_instagram, '') AS seller_instagram,
           COALESCE(seller_whatsapp, '') AS seller_whatsapp,
           COALESCE(seller_tiktok, '') AS seller_tiktok,
           COALESCE(is_seller, FALSE) AS is_seller
         FROM users
         WHERE id = $1`,
        [id],
      );

      const row = sellerRes.rows[0];
      if (!row) return notFound(res);
      if (!row.is_seller) {
        const payload = await getInactiveSellerPayload(pool, id);
        return fail(res, 404, payload.error, payload);
      }

      const seller = {
        id: row.id,
        name: row.name,
        nickname: row.nickname,
        avatar_url: row.avatar_url,
        banner_url: row.seller_banner_url || "",
        about: row.seller_about || "",
        telegram: row.seller_telegram || "",
        instagram: row.seller_instagram || "",
        whatsapp: row.seller_whatsapp || "",
        tiktok: row.seller_tiktok || "",
      };

      const productsCountRes = await pool.query<{ products_count: number }>(
        `SELECT COUNT(*)::int AS products_count
         FROM products
         WHERE owner_user_id = $1`,
        [id],
      );

      const likesCountRes = await pool.query<{ likes_count: number }>(
        `SELECT COUNT(*)::int AS likes_count
         FROM product_likes pl
         JOIN products p ON p.id = pl.product_id
         WHERE p.owner_user_id = $1`,
        [id],
      );

      const reviewCountRes = await pool.query<{ review_count: number }>(
        `SELECT COUNT(*)::int AS review_count
         FROM reviews r
         JOIN products p ON p.id = r.product_id
         WHERE p.owner_user_id = $1`,
        [id],
      );

      return ok(res, {
        seller,
        stats: {
          products_count: Number(productsCountRes.rows[0]?.products_count || 0),
          likes_count: Number(likesCountRes.rows[0]?.likes_count || 0),
          review_count: Number(reviewCountRes.rows[0]?.review_count || 0),
        },
      });
    } catch (error) {
      console.error("GET /api/sellers/:id error:", error);
      return serverError(res);
    }
  });

  router.get("/sellers/:id/products", async (req, res) => {
    try {
      const id = toPositiveInt(req.params.id);
      if (!id) return badRequest(res, "bad_id");

      const sellerStateRes = await pool.query<{ is_seller: boolean }>(
        `SELECT COALESCE(is_seller, FALSE) AS is_seller FROM users WHERE id = $1`,
        [id],
      );
      const sellerState = sellerStateRes.rows[0];
      if (!sellerState) return notFound(res);
      if (!sellerState.is_seller) {
        const payload = await getInactiveSellerPayload(pool, id);
        return fail(res, 404, payload.error, payload);
      }

      const result = await pool.query<ProductRow>(
        `SELECT *
         FROM products
         WHERE owner_user_id = $1
         ORDER BY id DESC`,
        [id],
      );

      let rows = result.rows || [];

      try {
        rows = await attachImagesToProducts(rows);
      } catch (error) {
        console.error("seller products attachImages error:", error);
      }

      return await withProductStats(rows, null, (out) => ok(res, { items: out }));
    } catch (error) {
      console.error("GET /api/sellers/:id/products error:", error);
      return serverError(res);
    }
  });

  router.get("/sellers/:id/reviews", async (req, res) => {
    try {
      const id = toPositiveInt(req.params.id);
      if (!id) return badRequest(res, "bad_id");

      const sellerStateRes = await pool.query<{ is_seller: boolean }>(
        `SELECT COALESCE(is_seller, FALSE) AS is_seller FROM users WHERE id = $1`,
        [id],
      );
      const sellerState = sellerStateRes.rows[0];
      if (!sellerState) return notFound(res);
      if (!sellerState.is_seller) {
        const payload = await getInactiveSellerPayload(pool, id);
        return fail(res, 404, payload.error, payload);
      }

      const result = await pool.query(
        `SELECT r.id,
                r.rating,
                COALESCE(r.comment, '') AS comment,
                r.created_at,
                COALESCE(u.name, 'Покупатель') AS user_name,
                p.id AS product_id,
                COALESCE(p.title, '') AS product_title,
                COALESCE(p.image_url, '') AS product_image_url
           FROM reviews r
           JOIN products p ON p.id = r.product_id
           LEFT JOIN users u ON u.id = r.user_id
          WHERE p.owner_user_id = $1
          ORDER BY r.created_at DESC, r.id DESC`,
        [id],
      );

      return ok(res, { items: result.rows || [] });
    } catch (error) {
      console.error("GET /api/sellers/:id/reviews error:", error);
      return serverError(res);
    }
  });

  router.get("/sellers/:id/following", authRequired, async (req: AuthenticatedRequest, res) => {
    try {
      const sellerId = toPositiveInt(req.params.id);
      if (!sellerId) return badRequest(res, "bad_id");

      const result = await pool.query(
        `SELECT 1 AS ok
         FROM seller_follows
         WHERE follower_user_id = $1
           AND seller_user_id = $2
         LIMIT 1`,
        [req.user!.id, sellerId],
      );

      return ok(res, { following: result.rows.length > 0 });
    } catch (error) {
      console.error("GET /api/sellers/:id/following error:", error);
      return serverError(res);
    }
  });

  router.post("/sellers/:id/follow", authRequired, async (req: AuthenticatedRequest, res) => {
    try {
      const sellerId = toPositiveInt(req.params.id);
      if (!sellerId) return badRequest(res, "bad_id");
      if (sellerId === req.user!.id) return badRequest(res, "self_follow");

      await pool.query(
        `INSERT INTO seller_follows (follower_user_id, seller_user_id)
         VALUES ($1, $2)
         ON CONFLICT (follower_user_id, seller_user_id) DO NOTHING`,
        [req.user!.id, sellerId],
      );

      return ok(res);
    } catch (error) {
      console.error("POST /api/sellers/:id/follow error:", error);
      return serverError(res);
    }
  });

  router.delete("/sellers/:id/follow", authRequired, async (req: AuthenticatedRequest, res) => {
    try {
      const sellerId = toPositiveInt(req.params.id);
      if (!sellerId) return badRequest(res, "bad_id");

      const result = await pool.query(
        `DELETE FROM seller_follows
         WHERE follower_user_id = $1
           AND seller_user_id = $2`,
        [req.user!.id, sellerId],
      );

      return ok(res, { removed: result.rowCount || 0 });
    } catch (error) {
      console.error("DELETE /api/sellers/:id/follow error:", error);
      return serverError(res);
    }
  });

  return router;
}
