import express from "express";
import type { NextFunction, Response } from "express";
import type { Pool } from "pg";

import type { AuthenticatedRequest } from "../../../types/app";
import { badRequest, dbError, ok } from "../../../utils/http";
import {
  createAdminProductsService,
  normalizeSpecsPayload,
} from "../services/admin-products.service";
import { writeAdminAuditLog } from "../services/admin-audit.service";

type AuthMiddleware = (req: AuthenticatedRequest, res: Response, next: NextFunction) => unknown;

type AdminProductCreateRouterOptions = {
  pool: Pool;
  authRequired: AuthMiddleware;
  adminRequired: AuthMiddleware;
  normalizeImagesInput: (value: unknown) => string[];
  saveProductImages: (pool: Pool, productId: number, images: string[], coverImage: string) => Promise<unknown>;
};

export function createAdminProductCreateRouter({
  pool,
  authRequired,
  adminRequired,
  normalizeImagesInput,
  saveProductImages,
}: AdminProductCreateRouterOptions) {
  const router = express.Router();
  const adminProductsService = createAdminProductsService({ pool, saveProductImages });

  router.post("/products", authRequired, adminRequired, async (req: AuthenticatedRequest, res) => {
    try {
      const { title, description, category, price, stock, image_url } = req.body;
      const tileSlug = String(req.body.tile_slug || "").trim().toLowerCase();
      const section = String(req.body.section || "Игры").trim();
      const images = normalizeImagesInput(req.body.images);

      if (!title || !description || !category) {
        return badRequest(res, "missing_fields");
      }

      const p = Number(price);
      const s = Number(stock ?? 10);

      if (!Number.isFinite(p) || p <= 0) {
        return badRequest(res, "bad_price");
      }

      if (!Number.isFinite(s) || s < 0) {
        return badRequest(res, "bad_stock");
      }

      const coverImage = images[0] || String(image_url || "").trim();
      const specsRows = normalizeSpecsPayload(req.body.specs, req.body.specs_json);
      const specsJson = JSON.stringify(specsRows);

      const newId = await adminProductsService.createProduct(
        {
          title,
          description,
          category,
          price: p,
          stock: s,
          imageUrl: coverImage,
          tileSlug,
          section,
          ownerUserId: null,
          specsJson,
        },
        images,
      );

      const sellerDisplay =
        req.user?.nickname && String(req.user.nickname).trim()
          ? String(req.user.nickname).trim()
          : String(req.user?.name || "Продавец");

      await adminProductsService.notifyFollowers(req.user?.id, sellerDisplay, String(title || ""), newId);
      await writeAdminAuditLog(pool, {
        actor: req.user,
        action: "product.create",
        entityType: "product",
        entityId: newId,
        summary: "Created product from admin panel",
        metadata: { title, category, price: p, stock: s },
      });

      return ok(res, { id: newId });
    } catch (error) {
      console.error("POST /api/products error:", error);
      return dbError(res, error);
    }
  });

  return router;
}
