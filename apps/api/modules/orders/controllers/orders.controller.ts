import type { NextFunction, Response } from "express";
import type { Pool } from "pg";

import type { AppUser, AuthenticatedRequest } from "../../../types/app";
import { badRequest, dbError, fail, notFound } from "../../../utils/http";
import { toPositiveInt } from "../../../utils/validation";
import {
  aggregateOrderDisplayStatus,
  createOrder,
  getAccessibleOrder,
  getAccessibleOrderBrief,
  getOrderClaims,
  getOrderHistory,
  getOrderItems,
  getRepeatOrderItems,
  listMyOrders,
  listSellerSales,
  summarizeSellerSales,
} from "../services/orders.service";

type AuthMiddleware = (req: AuthenticatedRequest, res: Response, next: NextFunction) => unknown;

type OrdersControllerOptions = {
  pool: Pool;
  authRequired: AuthMiddleware;
};

function parseOrderId(value: unknown) {
  return toPositiveInt(value);
}

async function loadAccessibleOrderOr404(
  res: Response,
  loader: (pool: Pool, orderId: number, user: Pick<AppUser, "id" | "is_admin" | "is_owner" | "two_factor_enabled">) => Promise<any>,
  pool: Pool,
  orderId: number,
  user: Pick<AppUser, "id" | "is_admin" | "is_owner" | "two_factor_enabled">,
) {
  const order = await loader(pool, orderId, user);
  if (!order) {
    notFound(res, "not_found");
    return null;
  }
  return order;
}

export function createOrdersController({ pool, authRequired }: OrdersControllerOptions) {
  return {
    authRequired,

    async createOrder(req: AuthenticatedRequest, res: Response) {
      try {
        if (!req.user?.id) return notFound(res);
        if (!req.user.email_verified) return fail(res, 403, "email_not_verified");

        const result = await createOrder(pool, req.user.id, req.body);
        if ("error" in result) {
          return res.status(result.error.status).json(result.error.body);
        }

        return res.json({ id: result.orderId });
      } catch (error) {
        console.error("POST /api/orders error:", error);
        return dbError(res, error);
      }
    },

    async listMyOrders(req: AuthenticatedRequest, res: Response) {
      try {
        if (!req.user?.id) return notFound(res);

        const orders = await listMyOrders(pool, req.user.id);
        return res.json(orders);
      } catch (error) {
        console.error("GET /api/orders/my error:", error);
        return dbError(res, error);
      }
    },

    async getOrder(req: AuthenticatedRequest, res: Response) {
      try {
        const orderId = parseOrderId(req.params.id);
        if (!orderId) return badRequest(res, "bad_id");
        if (!req.user) return notFound(res);

        const order = await loadAccessibleOrderOr404(res, getAccessibleOrder, pool, orderId, req.user);
        if (!order) return;

        const items = await getOrderItems(pool, orderId);
        return res.json({
          order: {
            ...order,
            display_status: aggregateOrderDisplayStatus(items, order.status || "created"),
          },
          items,
        });
      } catch (error) {
        console.error("GET /api/orders/:id error:", error);
        return dbError(res, error);
      }
    },

    async repeatOrder(req: AuthenticatedRequest, res: Response) {
      try {
        const orderId = parseOrderId(req.params.id);
        if (!orderId) return badRequest(res, "bad_id");
        if (!req.user) return notFound(res);

        const order = await loadAccessibleOrderOr404(res, getAccessibleOrderBrief, pool, orderId, req.user);
        if (!order) return;

        const items = await getRepeatOrderItems(pool, orderId);
        return res.json({ items });
      } catch (error) {
        console.error("POST /api/orders/:id/repeat error:", error);
        return dbError(res, error);
      }
    },

    async listSellerSales(req: AuthenticatedRequest, res: Response) {
      try {
        if (!req.user?.is_seller || !req.user.id) {
          return fail(res, 403, "seller_only", "Доступ продавца сейчас отключен.");
        }

        const items = await listSellerSales(pool, req.user.id);
        const summary = summarizeSellerSales(items);
        return res.json({ items, summary });
      } catch (error) {
        console.error("GET /api/seller/sales error:", error);
        return dbError(res, error);
      }
    },

    async getOrderHistory(req: AuthenticatedRequest, res: Response) {
      try {
        const orderId = parseOrderId(req.params.id);
        if (!orderId) return badRequest(res, "bad_id");
        if (!req.user) return notFound(res);

        const order = await loadAccessibleOrderOr404(res, getAccessibleOrderBrief, pool, orderId, req.user);
        if (!order) return;

        const items = await getOrderHistory(pool, orderId);
        return res.json({ items });
      } catch (error) {
        console.error("GET /api/orders/:id/history error:", error);
        return dbError(res, error);
      }
    },

    async getOrderClaims(req: AuthenticatedRequest, res: Response) {
      try {
        const orderId = parseOrderId(req.params.id);
        if (!orderId) return badRequest(res, "bad_id");
        if (!req.user) return notFound(res);

        const order = await loadAccessibleOrderOr404(res, getAccessibleOrderBrief, pool, orderId, req.user);
        if (!order) return;

        const items = await getOrderClaims(pool, orderId);
        return res.json({ items });
      } catch (error) {
        console.error("GET /api/orders/:id/claims error:", error);
        return dbError(res, error);
      }
    },
  };
}
