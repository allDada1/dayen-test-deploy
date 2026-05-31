import express from "express";
import type { NextFunction, Response } from "express";
import type { Pool } from "pg";

import type { AuthenticatedRequest } from "../../../types/app";
import { badRequest, dbError, notFound, ok } from "../../../utils/http";
import {
  parseOptionalString,
  parsePriceNumber,
  parseRequiredString,
  parseSlug,
  parseStockNumber,
  toPositiveInt,
} from "../../../utils/validation";
import {
  createAdminProductsService,
  normalizeSpecsPayload,
} from "../services/admin-products.service";
import { writeAdminAuditLog } from "../services/admin-audit.service";

type AuthMiddleware = (req: AuthenticatedRequest, res: Response, next: NextFunction) => unknown;

type AdminProductsRouterOptions = {
  pool: Pool;
  authRequired: AuthMiddleware;
  adminRequired: AuthMiddleware;
  normalizeImagesInput: (value: unknown) => string[];
  saveProductImages: (pool: Pool, productId: number, images: string[], coverImage: string) => Promise<unknown>;
};

export function createAdminProductsRouter({
  pool,
  authRequired,
  adminRequired,
  normalizeImagesInput,
  saveProductImages,
}: AdminProductsRouterOptions) {
  const router = express.Router();
  const adminProductsService = createAdminProductsService({ pool, saveProductImages });

  router.patch("/products/:id", authRequired, adminRequired, async (req: AuthenticatedRequest, res) => {
    try {
      const id = toPositiveInt(req.params.id);
      if (!id) return badRequest(res, "bad_id");

      const title = parseRequiredString(req.body.title, { min: 1, max: 200, normalize: true });
      const description = parseRequiredString(req.body.description, { min: 1, max: 20000 });
      const category = parseRequiredString(req.body.category, { min: 1, max: 120, normalize: true });
      const price = parsePriceNumber(req.body.price);
      const stock = parseStockNumber(req.body.stock);
      const tileSlug = req.body.tile_slug ? parseSlug(req.body.tile_slug, { min: 1, max: 100 }) : "";
      const section = parseOptionalString(req.body.section, { max: 120, normalize: true });
      const imageUrl = parseOptionalString(req.body.image_url, { max: 2000 });
      const specsJsonRaw = parseOptionalString(req.body.specs_json, { max: 20000 });
      const images = normalizeImagesInput(req.body.images);
      const specs = normalizeSpecsPayload(req.body.specs, req.body.specs_json);

      if (!title || !description || !category) return badRequest(res, "missing_fields");
      if (price == null) return badRequest(res, "bad_price");
      if (stock == null) return badRequest(res, "bad_stock");
      if (req.body.tile_slug && tileSlug == null) return badRequest(res, "bad_tile_slug");
      if (section == null) return badRequest(res, "bad_section");
      if (imageUrl == null) return badRequest(res, "bad_image_url");
      if (specsJsonRaw == null) return badRequest(res, "bad_specs_json");
      if (specs == null) return badRequest(res, "bad_specs");

      const coverImage = images[0] || imageUrl;
      const normalizedSpecsJson = JSON.stringify(specs);

      const updated = await adminProductsService.updateProduct(
        id,
        {
          title,
          description,
          category,
          price,
          stock,
          imageUrl: coverImage || "",
          tileSlug: tileSlug || "",
          section: section || "Игры",
          specsJson: normalizedSpecsJson,
        },
        images,
      );

      if (!updated) return notFound(res);
      await writeAdminAuditLog(pool, {
        actor: req.user,
        action: "product.update",
        entityType: "product",
        entityId: id,
        summary: "Updated product from admin panel",
        metadata: { title, category, price, stock, tile_slug: tileSlug || "", section: section || "Игры" },
      });

      return ok(res);
    } catch (error) {
      console.error("PATCH /api/products/:id error:", error);
      return dbError(res, error);
    }
  });

  router.delete("/products/:id", authRequired, adminRequired, async (req: AuthenticatedRequest, res) => {
    try {
      const id = toPositiveInt(req.params.id);
      if (!id) return badRequest(res, "bad_id");

      const deleted = await adminProductsService.deleteProduct(id);
      if (!deleted) return notFound(res);
      await writeAdminAuditLog(pool, {
        actor: req.user,
        action: "product.delete",
        entityType: "product",
        entityId: id,
        summary: "Deleted product from admin panel",
      });

      return ok(res);
    } catch (error) {
      console.error("DELETE /api/products/:id error:", error);
      return dbError(res, error);
    }
  });

  return router;
}
