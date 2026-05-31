import express from "express";
import type { NextFunction, Response } from "express";
import type { Pool } from "pg";

import type { AuthenticatedRequest } from "../../../types/app";
import { badRequest, created, fail, notFound, ok, serverError } from "../../../utils/http";
import {
  parseOptionalString,
  parsePriceNumber,
  parseRequiredString,
  parseSlug,
  parseStockNumber,
  toPositiveInt,
} from "../../../utils/validation";
import {
  createSellerProductsService,
  normalizeSellerProductSort,
  parseProductSpecs,
} from "../services/seller-products.service";

type AuthMiddleware = (req: AuthenticatedRequest, res: Response, next: NextFunction) => unknown;

type SellerProductsRouterOptions = {
  pool: Pool;
  authRequired: AuthMiddleware;
  normalizeImagesInput: (value: unknown) => string[];
  saveProductImages: (pool: Pool, productId: number, images: string[], coverImage: string) => Promise<unknown>;
};

async function ensureSeller(
  buildSellerAccessError: (userId: number) => Promise<Record<string, unknown>>,
  req: AuthenticatedRequest,
  res: Response,
) {
  if (!req.user || !req.user.is_seller) {
    const payload = await buildSellerAccessError(req.user?.id || 0);
    fail(res, 403, String(payload.error || "seller_only"), payload);
    return false;
  }
  return true;
}

function parseSellerProductBody(body: any, normalizeImagesInput: (value: unknown) => string[]) {
  const title = parseRequiredString(body?.title, { min: 1, max: 200, normalize: true });
  const description = parseRequiredString(body?.description, { min: 1, max: 10000, normalize: true });
  const tileSlug = parseSlug(body?.tile_slug, { min: 1, max: 120 });
  const category = parseRequiredString(body?.category || body?.tile_slug, { min: 1, max: 120, normalize: true });
  const price = parsePriceNumber(body?.price);
  const stock = parseStockNumber(body?.stock, 0);
  const imageUrl = parseOptionalString(body?.image_url, { max: 500 });
  const images = normalizeImagesInput(body?.images);
  const coverImage = images[0] || imageUrl || "";
  const specs = parseProductSpecs(body?.specs, { allowMissing: true });

  if (!title || !description || !category || !tileSlug) return { error: "missing_fields" as const };
  if (price == null) return { error: "bad_price" as const };
  if (stock == null) return { error: "bad_stock" as const };
  if (imageUrl == null) return { error: "bad_image_url" as const };
  if (specs == null) return { error: "bad_specs" as const };

  return {
    title,
    description,
    category,
    tile_slug: tileSlug,
    price,
    stock,
    image_url: imageUrl,
    images,
    coverImage,
    specs,
  };
}

export function createSellerProductsRouter({
  pool,
  authRequired,
  normalizeImagesInput,
  saveProductImages,
}: SellerProductsRouterOptions) {
  const router = express.Router();
  const sellerProductsService = createSellerProductsService({ pool, saveProductImages });

  router.get("/seller/products", authRequired, async (req: AuthenticatedRequest, res) => {
    if (!(await ensureSeller(sellerProductsService.buildSellerAccessError, req, res))) return;

    try {
      const limit = Math.min(toPositiveInt(req.query.limit) || 12, 50);
      const page = Math.max(1, toPositiveInt(req.query.page) || 1);
      const explicitOffset = req.query.offset === undefined ? null : Math.max(0, Number(req.query.offset) || 0);
      const offset = explicitOffset == null ? (page - 1) * limit : explicitOffset;
      const q = parseOptionalString(req.query.q, { max: 120, normalize: true }) || "";
      const tile = parseOptionalString(req.query.tile, { max: 120, normalize: true }) || "";

      const data = await sellerProductsService.listProducts(req.user!.id, {
        q,
        tile,
        sort: normalizeSellerProductSort(req.query.sort),
        limit,
        offset,
      });

      return ok(res, data);
    } catch (error) {
      console.error("GET /api/seller/products error:", error);
      return serverError(res);
    }
  });

  router.post("/seller/products", authRequired, async (req: AuthenticatedRequest, res) => {
    if (!(await ensureSeller(sellerProductsService.buildSellerAccessError, req, res))) return;

    try {
      const payload = parseSellerProductBody(req.body, normalizeImagesInput);
      if ("error" in payload) return badRequest(res, payload.error);

      const newId = await sellerProductsService.createProduct(req.user!.id, {
        title: payload.title,
        description: payload.description,
        category: payload.category,
        tileSlug: payload.tile_slug,
        price: payload.price,
        stock: payload.stock,
        coverImage: payload.coverImage,
        specsJson: JSON.stringify(payload.specs || []),
        images: payload.images,
      });

      return created(res, { id: newId });
    } catch (error) {
      console.error("POST /api/seller/products error:", error);
      return serverError(res);
    }
  });

  router.put("/seller/products/:id", authRequired, async (req: AuthenticatedRequest, res) => {
    if (!(await ensureSeller(sellerProductsService.buildSellerAccessError, req, res))) return;

    try {
      const id = toPositiveInt(req.params.id);
      if (!id) return badRequest(res, "bad_id");

      const payload = parseSellerProductBody(req.body, normalizeImagesInput);
      if ("error" in payload) return badRequest(res, payload.error);

      const updated = await sellerProductsService.updateProduct(req.user!.id, id, {
        title: payload.title,
        description: payload.description,
        category: payload.category,
        tileSlug: payload.tile_slug,
        price: payload.price,
        stock: payload.stock,
        coverImage: payload.coverImage,
        specsJson: JSON.stringify(payload.specs || []),
        images: payload.images,
      });

      if (!updated) return notFound(res);

      return ok(res);
    } catch (error) {
      console.error("PUT /api/seller/products/:id error:", error);
      return serverError(res);
    }
  });

  router.delete("/seller/products/:id", authRequired, async (req: AuthenticatedRequest, res) => {
    if (!(await ensureSeller(sellerProductsService.buildSellerAccessError, req, res))) return;

    try {
      const id = toPositiveInt(req.params.id);
      if (!id) return badRequest(res, "bad_id");

      const deleted = await sellerProductsService.deleteProduct(req.user!.id, id);
      if (!deleted) return notFound(res);
      return ok(res);
    } catch (error) {
      console.error("DELETE /api/seller/products/:id error:", error);
      return serverError(res);
    }
  });

  return router;
}
