import express from "express";
import type { NextFunction, Response } from "express";
import type { Pool } from "pg";

import type { AuthenticatedRequest } from "../../../types/app";
import { createOrderActionsController } from "../controllers/order-actions.controller";

type AuthMiddleware = (req: AuthenticatedRequest, res: Response, next: NextFunction) => unknown;

type OrderActionsRouterOptions = {
  pool: Pool;
  authRequired: AuthMiddleware;
  adminRequired: AuthMiddleware;
};

export function createOrderActionsRouter(options: OrderActionsRouterOptions) {
  const router = express.Router();
  const controller = createOrderActionsController(options);

  router.post("/orders/:id/pay", options.authRequired, controller.payOrder);
  router.post("/orders/:id/claim", options.authRequired, controller.createOrderClaim);
  router.get("/seller/claims", options.authRequired, controller.listSellerClaims);
  router.get("/admin/claims", options.authRequired, options.adminRequired, controller.listAdminClaims);
  router.post("/seller/claims/:id", options.authRequired, controller.updateSellerClaim);
  router.post("/admin/claims/:id", options.authRequired, options.adminRequired, controller.updateAdminClaim);
  router.post("/seller/sales/:id/status", options.authRequired, controller.updateSellerSaleStatus);
  router.post(
    "/orders/:id/status",
    options.authRequired,
    options.adminRequired,
    controller.updateOrderStatus,
  );

  return router;
}
