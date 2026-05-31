import express from "express";
import type { NextFunction, Response } from "express";
import type { Pool } from "pg";

import type { AuthenticatedRequest } from "../../../types/app";
import { createOrdersController } from "../controllers/orders.controller";

type AuthMiddleware = (req: AuthenticatedRequest, res: Response, next: NextFunction) => unknown;

type OrdersRouterOptions = {
  pool: Pool;
  authRequired: AuthMiddleware;
};

export function createOrdersRouter(options: OrdersRouterOptions) {
  const router = express.Router();
  const controller = createOrdersController(options);

  router.post("/orders", options.authRequired, controller.createOrder);
  router.get("/orders/my", options.authRequired, controller.listMyOrders);
  router.get("/orders/:id", options.authRequired, controller.getOrder);
  router.get("/orders/:id/claims", options.authRequired, controller.getOrderClaims);
  router.post("/orders/:id/repeat", options.authRequired, controller.repeatOrder);
  router.get("/seller/sales", options.authRequired, controller.listSellerSales);
  router.get("/orders/:id/history", options.authRequired, controller.getOrderHistory);

  return router;
}
