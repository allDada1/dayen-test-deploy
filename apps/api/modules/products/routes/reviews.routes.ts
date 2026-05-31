import express from "express";
import type { NextFunction, Response } from "express";
import type { Pool } from "pg";

import { productFeedbackRateLimit } from "../../../middleware/rate-limit";
import type { AuthenticatedRequest } from "../../../types/app";
import { createReviewsController } from "../controllers/products.controller";

type AuthMiddleware = (req: AuthenticatedRequest, res: Response, next: NextFunction) => unknown;

type ReviewsRouterOptions = {
  pool: Pool;
  authRequired: AuthMiddleware;
};

export function createReviewsRouter(options: ReviewsRouterOptions) {
  const router = express.Router();
  const controller = createReviewsController(options);

  router.get("/:productId", controller.listReviews);
  router.get("/:productId/can-review", options.authRequired, controller.canReview);
  router.post("/", options.authRequired, productFeedbackRateLimit, controller.createReview);

  return router;
}
