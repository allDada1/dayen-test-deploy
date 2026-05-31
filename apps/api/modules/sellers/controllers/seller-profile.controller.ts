import express from "express";
import type { NextFunction, Response } from "express";
import type { Pool } from "pg";

import type { AuthenticatedRequest } from "../../../types/app";
import { badRequest, fail, notFound, ok, serverError } from "../../../utils/http";
import { parseOptionalString, parseRequiredString } from "../../../utils/validation";

type AuthMiddleware = (req: AuthenticatedRequest, res: Response, next: NextFunction) => unknown;
type ProductRow = Record<string, any>;

type SellerProfileRouterOptions = {
  pool: Pool;
  authRequired: AuthMiddleware;
  attachImagesToProducts?: (rows: ProductRow[]) => Promise<ProductRow[]>;
  withProductStats?: (
    rows: ProductRow[],
    userId: number | null,
    callback: (rows: ProductRow[]) => unknown,
  ) => Promise<unknown>;
};

type SellerProfileRow = {
  id: number;
  is_seller: boolean;
  username: string;
  name: string;
  avatar_url: string;
  banner_url: string;
  seller_about: string;
  seller_telegram: string;
  seller_instagram: string;
  seller_whatsapp: string;
  seller_tiktok: string;
};

type SellerAccessRow = {
  status: string | null;
  admin_comment: string | null;
  reviewed_at: string | null;
};

const SELLER_PROFILE_SELECT = `
  SELECT
    id,
    is_seller,
    COALESCE(nickname, '') AS username,
    COALESCE(name, '') AS name,
    COALESCE(avatar_url, '') AS avatar_url,
    COALESCE(seller_banner_url, '') AS banner_url,
    COALESCE(seller_about, '') AS seller_about,
    COALESCE(seller_telegram, '') AS seller_telegram,
    COALESCE(seller_instagram, '') AS seller_instagram,
    COALESCE(seller_whatsapp, '') AS seller_whatsapp,
    COALESCE(seller_tiktok, '') AS seller_tiktok
  FROM users
`;

const SELLER_ACCESS_SQL = `
  SELECT status,
         COALESCE(admin_comment, '') AS admin_comment,
         reviewed_at
  FROM seller_requests
  WHERE user_id = $1
  ORDER BY reviewed_at DESC NULLS LAST, id DESC
  LIMIT 1`;

async function buildSellerAccessError(pool: Pool, userId: number) {
  const result = await pool.query<SellerAccessRow>(SELLER_ACCESS_SQL, [userId]);
  const row = result.rows[0] || null;
  return {
    error: "seller_only",
    message: "Доступ продавца сейчас отключён.",
    admin_comment: row?.admin_comment || "",
    seller_status: row?.status || "inactive",
    reviewed_at: row?.reviewed_at || null,
  };
}

async function ensureSeller(pool: Pool, req: AuthenticatedRequest, res: Response) {
  if (!req.user || !req.user.is_seller) {
    const payload = await buildSellerAccessError(pool, req.user?.id || 0);
    fail(res, 403, payload.error, payload);
    return false;
  }
  return true;
}

function mapSellerProfile(row: SellerProfileRow | null) {
  if (!row) return null;

  return {
    ...row,
    banner_url: row.banner_url || "",
    about: row.seller_about || "",
    telegram: row.seller_telegram || "",
    instagram: row.seller_instagram || "",
    whatsapp: row.seller_whatsapp || "",
    tiktok: row.seller_tiktok || "",
  };
}

async function loadSellerByUserId(pool: Pool, userId: number) {
  const result = await pool.query<SellerProfileRow>(`${SELLER_PROFILE_SELECT} WHERE id = $1`, [userId]);
  return result.rows[0] || null;
}

async function loadSellerByUsername(pool: Pool, username: string) {
  const result = await pool.query<SellerProfileRow>(
    `${SELLER_PROFILE_SELECT}
     WHERE LOWER(COALESCE(nickname, '')) = LOWER($1)
     LIMIT 1`,
    [username],
  );
  return result.rows[0] || null;
}

function parseSellerProfileInput(body: any) {
  const shopName = parseRequiredString(body?.shop_name, { min: 2, max: 120, normalize: true });
  const avatarUrl = parseOptionalString(body?.avatar_url, { max: 500 });
  const bannerUrl = parseOptionalString(body?.banner_url, { max: 500 });
  const about = parseOptionalString(body?.about, { max: 5000 });
  const telegram = parseOptionalString(body?.telegram, { max: 500 });
  const instagram = parseOptionalString(body?.instagram, { max: 500 });
  const whatsapp = parseOptionalString(body?.whatsapp, { max: 500 });
  const tiktok = parseOptionalString(body?.tiktok, { max: 500 });

  if (!shopName) return { error: "bad_shop_name" };
  if (avatarUrl == null) return { error: "bad_avatar_url" };
  if (bannerUrl == null) return { error: "bad_banner_url" };
  if (about == null) return { error: "bad_about" };
  if (telegram == null) return { error: "bad_telegram" };
  if (instagram == null) return { error: "bad_instagram" };
  if (whatsapp == null) return { error: "bad_whatsapp" };
  if (tiktok == null) return { error: "bad_tiktok" };

  return {
    values: {
      shop_name: shopName,
      avatar_url: avatarUrl || "",
      banner_url: bannerUrl || "",
      about: about || "",
      telegram: telegram || "",
      instagram: instagram || "",
      whatsapp: whatsapp || "",
      tiktok: tiktok || "",
    },
  };
}

export function createSellerProfileRouter({
  pool,
  authRequired,
  attachImagesToProducts,
  withProductStats,
}: SellerProfileRouterOptions) {
  const router = express.Router();

  router.get("/seller/me", authRequired, async (req: AuthenticatedRequest, res) => {
    if (!(await ensureSeller(pool, req, res))) return;

    try {
      const seller = await loadSellerByUserId(pool, req.user!.id);
      if (!seller || !seller.is_seller) return notFound(res, "not_seller");

      return ok(res, { seller: mapSellerProfile(seller) });
    } catch (error) {
      console.error("GET /api/seller/me error:", error);
      return serverError(res);
    }
  });

  router.post("/seller/profile", authRequired, async (req: AuthenticatedRequest, res) => {
    if (!(await ensureSeller(pool, req, res))) return;

    try {
      const parsed = parseSellerProfileInput(req.body);
      if ("error" in parsed) return badRequest(res, parsed.error);

      const { shop_name, avatar_url, banner_url, about, telegram, instagram, whatsapp, tiktok } = parsed.values;

      await pool.query(
        `UPDATE users
         SET name = $1,
             avatar_url = $2,
             seller_banner_url = $3,
             seller_about = $4,
             seller_telegram = $5,
             seller_instagram = $6,
             seller_whatsapp = $7,
             seller_tiktok = $8
         WHERE id = $9`,
        [shop_name, avatar_url, banner_url, about, telegram, instagram, whatsapp, tiktok, req.user!.id],
      );

      return ok(res);
    } catch (error) {
      console.error("POST /api/seller/profile error:", error);
      return serverError(res);
    }
  });

  router.get("/shop/:username", async (req, res) => {
    try {
      const username = parseRequiredString(req.params.username, { min: 1, max: 64 });
      if (!username) return badRequest(res, "bad_username");

      const seller = await loadSellerByUsername(pool, username);
      if (!seller) return notFound(res);
      if (!seller.is_seller) {
        const payload = await buildSellerAccessError(pool, seller.id);
        return fail(res, 404, "seller_inactive", {
          message: "Магазин временно недоступен.",
          admin_comment: payload.admin_comment,
          seller_status: payload.seller_status,
          reviewed_at: payload.reviewed_at,
        });
      }

      const productsRes = await pool.query<ProductRow>(
        `SELECT *
         FROM products
         WHERE owner_user_id = $1
         ORDER BY id DESC`,
        [seller.id],
      );

      let products = productsRes.rows || [];

      try {
        if (typeof attachImagesToProducts === "function") {
          products = await attachImagesToProducts(products);
        }
      } catch (error) {
        console.error("shop products attachImages error:", error);
      }

      const sellerOut = mapSellerProfile(seller);

      if (typeof withProductStats === "function") {
        return await withProductStats(products, null, (out) => ok(res, { seller: sellerOut, products: out || [] }));
      }

      return ok(res, { seller: sellerOut, products });
    } catch (error) {
      console.error("GET /api/shop/:username error:", error);
      return serverError(res);
    }
  });

  return router;
}
