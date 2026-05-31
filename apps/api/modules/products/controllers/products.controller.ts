import type { NextFunction, Response } from "express";
import type { Pool } from "pg";

import { resolveOptionalUserId } from "../../../middleware/auth-helpers";
import type { AuthenticatedRequest } from "../../../types/app";
import { badRequest, created, dbError, forbidden, notFound, ok, serverError } from "../../../utils/http";
import { normalizeSort, toPositiveInt } from "../../../utils/product-query";
import { parseOptionalString, parseRating, getTrimmedString, toPositiveInt as parseId } from "../../../utils/validation";
import { createProductsRepository, type ProductRow } from "../repositories/products.repository";
import { createProductsService } from "../services/products.service";

type AuthMiddleware = (req: AuthenticatedRequest, res: Response, next: NextFunction) => unknown;

type ProductsControllerOptions = {
  pool: Pool;
  attachImagesToProducts: (rows: ProductRow[]) => Promise<ProductRow[]>;
  withProductStats: (
    rows: ProductRow[] | ProductRow,
    userId: number | null,
    callback: (rows: ProductRow[]) => unknown,
  ) => Promise<unknown>;
};

type ProductActionsControllerOptions = ProductsControllerOptions & {
  authRequired: AuthMiddleware;
};

type ReviewsControllerOptions = {
  pool: Pool;
  authRequired: AuthMiddleware;
};

function createService(options: ProductsControllerOptions) {
  return createProductsService({
    repository: createProductsRepository(options.pool),
    attachImagesToProducts: options.attachImagesToProducts,
    withProductStats: options.withProductStats,
  });
}

export function createProductsController(options: ProductsControllerOptions) {
  const service = createService(options);

  return {
    async listProducts(req: AuthenticatedRequest, res: Response) {
      try {
        const q = getTrimmedString(req.query.q);
        const cat = getTrimmedString(req.query.cat);
        const section = getTrimmedString(req.query.section);
        const tileSlug = getTrimmedString(req.query.tile_slug);
        const sort = normalizeSort(req.query.sort, req.query.dir);

        const paging = {
          enabled: req.query.limit !== undefined || req.query.offset !== undefined,
          limit: Math.min(toPositiveInt(req.query.limit, 20), 100),
          offset: toPositiveInt(req.query.offset, 0),
        };

        const optionalUserId = await resolveOptionalUserId(options.pool, req.headers.authorization);
        const data = await service.listProducts({ q, cat, section, tile_slug: tileSlug }, sort, paging, optionalUserId);
        return ok(res, data as Record<string, unknown>);
      } catch (error) {
        console.error("GET /api/products error:", error);
        return serverError(res);
      }
    },

    async getProduct(req: AuthenticatedRequest, res: Response) {
      try {
        const productId = parseId(req.params.id);
        if (!productId) return badRequest(res, "bad_id");

        const optionalUserId = await resolveOptionalUserId(options.pool, req.headers.authorization);
        const product = await service.getProductById(productId, optionalUserId);
        if (!product) return notFound(res);

        return ok(res, { product });
      } catch (error) {
        console.error("GET /api/products/:id error:", error);
        return serverError(res);
      }
    },
  };
}

export function createProductActionsController(options: ProductActionsControllerOptions) {
  const service = createService(options);

  return {
    authRequired: options.authRequired,

    async toggleLike(req: AuthenticatedRequest, res: Response) {
      try {
        const productId = toPositiveInt(req.params.id);
        const userId = req.user!.id;
        if (!productId) return badRequest(res, "bad_id");

        return ok(res, await service.toggleLike(productId, userId));
      } catch (error) {
        console.error("POST /api/products/:id/like error:", error);
        return dbError(res, error);
      }
    },

    async listFavorites(req: AuthenticatedRequest, res: Response) {
      try {
        const userId = req.user!.id;
        const data = await service.listFavorites(userId);
        return ok(res, data as Record<string, unknown>);
      } catch (error) {
        console.error("GET /api/favorites error:", error);
        return dbError(res, error);
      }
    },

    async rateProduct(req: AuthenticatedRequest, res: Response) {
      try {
        const productId = toPositiveInt(req.params.id);
        const userId = req.user!.id;
        const rating = parseRating(req.body.rating);

        if (!productId) return badRequest(res, "bad_id");
        if (rating == null) return badRequest(res, "bad_rating");

        const result = await service.rateProduct(productId, userId, rating);
        if (!result.permission.can_review) {
          return forbidden(res, result.permission.reason || "not_allowed");
        }

        return ok(res, result);
      } catch (error) {
        console.error("POST /api/products/:id/rate error:", error);
        return dbError(res, error);
      }
    },
  };
}

export function createReviewsController({ pool, authRequired }: ReviewsControllerOptions) {
  const service = createProductsService({
    repository: createProductsRepository(pool),
    attachImagesToProducts: async (rows) => rows,
    withProductStats: async (rows, _userId, callback) =>
      callback(Array.isArray(rows) ? rows : [rows]),
  });

  return {
    authRequired,

    async listReviews(req: AuthenticatedRequest, res: Response) {
      try {
        const productId = toPositiveInt(req.params.productId);
        if (!productId) return badRequest(res, "bad_product_id");

        return ok(res, await service.listReviews(productId));
      } catch (error) {
        console.error("GET /api/reviews/:productId error:", error);
        return serverError(res);
      }
    },

    async canReview(req: AuthenticatedRequest, res: Response) {
      try {
        const productId = toPositiveInt(req.params.productId);
        if (!productId) return badRequest(res, "bad_product_id");

        const info = await service.getReviewPermission(productId, toPositiveInt(req.user!.id) || 0);
        return ok(res, info);
      } catch (error) {
        console.error("GET /api/reviews/:productId/can-review error:", error);
        return serverError(res);
      }
    },

    async createReview(req: AuthenticatedRequest, res: Response) {
      try {
        const userId = toPositiveInt(req.user!.id);
        const productId = toPositiveInt(req.body.product_id);
        const rating = parseRating(req.body.rating);
        const comment = parseOptionalString(req.body.comment, { max: 5000, normalize: true });

        if (!productId) return badRequest(res, "bad_product_id");
        if (rating == null) return badRequest(res, "bad_rating");
        if (comment == null) return badRequest(res, "bad_comment");

        const result = await service.createReview(userId || 0, productId, rating, comment);
        if (!result.permission.can_review) {
          return forbidden(res, result.permission.reason || "not_allowed");
        }

        return created(res, { review: result.review });
      } catch (error: any) {
        if (error?.code === "23505") {
          return badRequest(res, "already_reviewed");
        }

        console.error("POST /api/reviews error:", error);
        return serverError(res);
      }
    },
  };
}
