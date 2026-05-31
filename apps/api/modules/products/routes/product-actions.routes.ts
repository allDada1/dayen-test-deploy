import express from "express";
import type { NextFunction, Response } from "express";
import type { Pool } from "pg";

import { productFeedbackRateLimit } from "../../../middleware/rate-limit";
import type { AuthenticatedRequest } from "../../../types/app";
import { createProductActionsController } from "../controllers/products.controller";
import type { ProductRow } from "../repositories/products.repository";

type AuthMiddleware = (req: AuthenticatedRequest, res: Response, next: NextFunction) => unknown;

type ProductActionsRouterOptions = {
  pool: Pool;
  authRequired: AuthMiddleware;
  withProductStats: (
    rows: ProductRow[],
    userId: number | null,
    callback: (rows: ProductRow[]) => unknown,
  ) => Promise<unknown>;
};

export function createProductActionsRouter({
  pool,
  authRequired,
  withProductStats,
}: ProductActionsRouterOptions) {
  const router = express.Router();
  const controller = createProductActionsController({
    pool,
    authRequired,
    withProductStats,
    attachImagesToProducts: async (rows) => rows,
  });

  router.post("/products/:id/like", authRequired, controller.toggleLike);
  router.get("/favorites", authRequired, controller.listFavorites);
  router.post("/products/:id/rate", authRequired, productFeedbackRateLimit, controller.rateProduct);

  return router;
}
