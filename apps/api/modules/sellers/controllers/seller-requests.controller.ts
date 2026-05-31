import express from "express";
import type { NextFunction, Response } from "express";
import type { Pool } from "pg";

import type { AuthenticatedRequest } from "../../../types/app";
import { badRequest, conflict, fail, ok, serverError } from "../../../utils/http";
import { parseOptionalString, parseRequiredString, parseSlug } from "../../../utils/validation";

type AuthMiddleware = (req: AuthenticatedRequest, res: Response, next: NextFunction) => unknown;

type SellerRequestsRouterOptions = {
  pool: Pool;
  authRequired: AuthMiddleware;
};

type SellerRequestRow = {
  id: number;
  user_id: number;
  shop_name: string;
  shop_slug: string;
  avatar_url: string | null;
  about: string | null;
  contacts: string | null;
  status: string;
  admin_comment: string | null;
  created_at: string;
  reviewed_at: string | null;
};

export function createSellerRequestsRouter({ pool, authRequired }: SellerRequestsRouterOptions) {
  const router = express.Router();

  router.get("/seller/request-status", authRequired, async (req: AuthenticatedRequest, res) => {
    try {
      const r = await pool.query<SellerRequestRow>(
        `SELECT id, user_id, shop_name, shop_slug, avatar_url, about, contacts, status, admin_comment, created_at, reviewed_at
           FROM seller_requests
          WHERE user_id = $1
          ORDER BY id DESC
          LIMIT 1`,
        [req.user?.id],
      );
      return ok(res, { request: r.rows[0] || null });
    } catch (error) {
      console.error("GET /api/seller/request-status error:", error);
      return serverError(res);
    }
  });

  router.post("/seller/apply", authRequired, async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user?.email_verified) return fail(res, 403, "email_not_verified");

      const rawShopSlug = req.body?.shop_slug || req.body?.username;
      const rawShopName = req.body?.shop_name;
      const shopSlug = parseSlug(rawShopSlug, { min: 3, max: 40 });
      const shopName = parseRequiredString(rawShopName, { min: 2, max: 120, normalize: true });
      const avatarUrl = parseOptionalString(req.body?.avatar_url, { max: 500 });
      const contacts = parseOptionalString(req.body?.contacts, { max: 500, normalize: true });
      const about = parseOptionalString(req.body?.about, { max: 2000, normalize: true });

      if (!String(rawShopSlug || "").trim() || !String(rawShopName || "").trim()) return badRequest(res, "missing_fields");
      if (!shopSlug) return badRequest(res, "bad_shop_slug");
      if (!shopName) return badRequest(res, "bad_shop_name");
      if (avatarUrl == null) return badRequest(res, "bad_avatar_url");
      if (contacts == null) return badRequest(res, "bad_contacts");
      if (about == null) return badRequest(res, "bad_about");

      const currentSeller = await pool.query<{ id: number }>(
        `SELECT id
         FROM users
         WHERE id = $1
           AND is_seller = TRUE
         LIMIT 1`,
        [req.user?.id],
      );
      if (currentSeller.rows.length) return conflict(res, "already_seller");

      const pending = await pool.query<{ id: number }>(
        `SELECT id
           FROM seller_requests
          WHERE user_id = $1
            AND status = 'pending'
          LIMIT 1`,
        [req.user?.id],
      );
      if (pending.rows.length) return conflict(res, "request_already_pending");

      const slugTakenByUser = await pool.query<{ id: number }>(
        `SELECT id
           FROM users
          WHERE LOWER(COALESCE(nickname, '')) = LOWER($1)
          LIMIT 1`,
        [shopSlug],
      );
      if (slugTakenByUser.rows.length) return conflict(res, "shop_slug_taken");

      const slugTakenByRequest = await pool.query<{ id: number }>(
        `SELECT id
           FROM seller_requests
          WHERE LOWER(shop_slug) = LOWER($1)
            AND status IN ('pending', 'approved')
          LIMIT 1`,
        [shopSlug],
      );
      if (slugTakenByRequest.rows.length) return conflict(res, "shop_slug_taken");

      await pool.query(
        `INSERT INTO seller_requests
         (user_id, shop_name, shop_slug, avatar_url, about, contacts, status)
         VALUES ($1, $2, $3, $4, $5, $6, 'pending')`,
        [req.user?.id, shopName, shopSlug, avatarUrl, about, contacts],
      );

      return ok(res, { message: "Заявка отправлена. Ожидайте решения администратора." });
    } catch (error) {
      console.error("POST /api/seller/apply error:", error);
      return serverError(res);
    }
  });

  return router;
}
