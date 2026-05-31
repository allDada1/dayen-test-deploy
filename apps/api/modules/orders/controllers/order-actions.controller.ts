import type { NextFunction, Response } from "express";
import type { Pool } from "pg";

import type { AuthenticatedRequest } from "../../../types/app";
import { badRequest, dbError, fail, notFound, ok } from "../../../utils/http";
import { parseEnum, parseOptionalString, toPositiveInt } from "../../../utils/validation";
import { writeAdminAuditLog } from "../../admin/services/admin-audit.service";
import {
  createNotification,
  notifyAdmins,
  notifyOrderSellers,
} from "../../notifications/services/notification.service";
import {
  aggregateOrderDisplayStatus,
  getAdminClaim,
  ensureOrderClaimsTable,
  ensureOrderItemSellerStateColumns,
  hasElevatedOrderAccess,
  listAdminClaims,
  listSellerClaims,
  sellerCanAccessClaim,
  sellerCanAccessSale,
} from "../services/orders.service";

type AuthMiddleware = (req: AuthenticatedRequest, res: Response, next: NextFunction) => unknown;

type OrderActionsControllerOptions = {
  pool: Pool;
  authRequired: AuthMiddleware;
  adminRequired: AuthMiddleware;
};

const orderStatuses = ["pending", "paid", "shipped", "delayed", "delivered", "cancelled"];

const orderStatusLabels: Record<string, string> = {
  pending: "в обработке",
  paid: "оплачен",
  shipped: "передан в доставку",
  delayed: "задерживается",
  delivered: "доставлен",
  cancelled: "отменен",
};

function orderStatusLabel(status: string) {
  return orderStatusLabels[String(status || "").toLowerCase()] || status;
}

export function createOrderActionsController({
  pool,
  authRequired,
  adminRequired,
}: OrderActionsControllerOptions) {
  return {
    authRequired,
    adminRequired,

    async payOrder(req: AuthenticatedRequest, res: Response) {
      const orderId = toPositiveInt(req.params.id);
      const method = parseEnum(req.body?.method, ["card", "kaspi"], null);

      if (!orderId) return badRequest(res, "bad_id");
      if (!method) return badRequest(res, "bad_method");

      try {
        const hasElevatedAccess = hasElevatedOrderAccess(req.user);
        const qOrder = hasElevatedAccess
          ? await pool.query<{ id: number; user_id: number; status: string }>(
              `SELECT id, user_id, status FROM orders WHERE id = $1`,
              [orderId],
            )
          : await pool.query<{ id: number; user_id: number; status: string }>(
              `SELECT id, user_id, status FROM orders WHERE id = $1 AND user_id = $2`,
              [orderId, req.user!.id],
            );

        const order = qOrder.rows[0];
        if (!order) return notFound(res);

        await ensureOrderItemSellerStateColumns(pool);
        const itemStatuses = await pool.query<{ seller_status: string }>(
          `SELECT COALESCE(seller_status, 'pending') AS seller_status
           FROM order_items
           WHERE order_id = $1`,
          [orderId],
        );

        const currentStatus = String(order.status || "").toLowerCase();
        const displayStatus = aggregateOrderDisplayStatus(itemStatuses.rows || [], currentStatus);
        if (currentStatus === "paid" && displayStatus === "paid") return ok(res, { already: true });
        if (!["created", "pending"].includes(currentStatus) || !["created", "pending"].includes(displayStatus)) {
          return badRequest(res, "bad_status");
        }

        const client = await pool.connect();
        try {
          await client.query("BEGIN");
          await ensureOrderItemSellerStateColumns(client);

          const updatedOrder = await client.query(`UPDATE orders SET status = 'paid' WHERE id = $1`, [orderId]);
          if ((updatedOrder.rowCount || 0) === 0) {
            await client.query("ROLLBACK");
            return notFound(res);
          }

          await client.query(
            `UPDATE order_items
             SET seller_status = 'paid',
                 seller_updated_at = NOW()
             WHERE order_id = $1
               AND COALESCE(seller_status, 'pending') = 'pending'`,
            [orderId],
          );

          await client.query(
            `INSERT INTO order_status_history(order_id, status, note)
             VALUES ($1, 'paid', $2)`,
            [orderId, `Оплата (${method})`],
          );
          if (hasElevatedAccess) {
            await writeAdminAuditLog(client, {
              actor: req.user,
              action: "order.pay",
              entityType: "order",
              entityId: orderId,
              targetUserId: Number(order.user_id),
              summary: "Marked order as paid",
              metadata: { method },
            });
          }

          try {
            await createNotification(client, {
              userId: Number(order.user_id),
              title: "Оплата принята",
              body: `Заказ #${orderId} оплачен (${method}). Продавец получил уведомление и начнет обработку.`,
              link: `/orders/${orderId}`,
            });
            await notifyOrderSellers(client, {
              orderId,
              title: "Новый оплаченный заказ",
              body: `Заказ #${orderId} оплачен. Проверьте продажи и подготовьте товар.`,
              link: "/seller/sales",
              excludeUserId: Number(order.user_id),
            });
          } catch (error) {
            console.error("create payment notifications failed", error);
          }

          await client.query("COMMIT");
          return ok(res);
        } catch (error) {
          await client.query("ROLLBACK");
          console.error("ORDER PAY ERROR:", String((error as Error)?.message || error));
          return dbError(res, error);
        } finally {
          client.release();
        }
      } catch (error) {
        console.error("ORDER PAY ERROR:", String((error as Error)?.message || error));
        return dbError(res, error);
      }
    },

    async createOrderClaim(req: AuthenticatedRequest, res: Response) {
      const orderId = toPositiveInt(req.params.id);
      const claimType = parseEnum(req.body?.type, ["return", "dispute"], null);
      const reason = parseOptionalString(req.body?.reason, { max: 1000 }) ?? null;

      if (!orderId) return badRequest(res, "bad_id");
      if (!claimType) return badRequest(res, "bad_type");
      if (reason === null || !reason.trim()) return badRequest(res, "bad_reason");

      try {
        const hasElevatedAccess = hasElevatedOrderAccess(req.user);
        const qOrder = hasElevatedAccess
          ? await pool.query<{ id: number; user_id: number; status: string }>(
              `SELECT id, user_id, status FROM orders WHERE id = $1`,
              [orderId],
            )
          : await pool.query<{ id: number; user_id: number; status: string }>(
              `SELECT id, user_id, status FROM orders WHERE id = $1 AND user_id = $2`,
              [orderId, req.user!.id],
            );

        const order = qOrder.rows[0];
        if (!order) return notFound(res);

        const status = String(order.status || "").toLowerCase();
        if (!["paid", "shipped", "delayed", "delivered"].includes(status)) {
          return badRequest(res, "claim_unavailable");
        }

        const client = await pool.connect();
        try {
          await client.query("BEGIN");
          await ensureOrderClaimsTable(client);

          const title = claimType === "return" ? "Запрошен возврат" : "Открыт спор";
          const historyNote = claimType === "return" ? `Возврат: ${reason.trim()}` : `Спор: ${reason.trim()}`;

          const sellersResult = await client.query<{ seller_user_id: number }>(
            `SELECT DISTINCT p.owner_user_id AS seller_user_id
             FROM order_items oi
             JOIN products p ON p.id = oi.product_id
             WHERE oi.order_id = $1
               AND COALESCE(p.owner_user_id, 0) > 0`,
            [orderId],
          );

          for (const row of sellersResult.rows || []) {
            await client.query(
              `INSERT INTO order_claims (order_id, user_id, seller_user_id, type, status, reason)
               VALUES ($1, $2, $3, $4, 'open', $5)`,
              [orderId, Number(order.user_id), Number(row.seller_user_id), claimType, reason.trim()],
            );
          }

          await client.query(
            `INSERT INTO order_status_history(order_id, status, note)
             VALUES ($1, $2, $3)`,
            [orderId, status, historyNote],
          );

          try {
            const body = `По заказу #${orderId} создано обращение: ${reason.trim()}`;
            await notifyOrderSellers(client, {
              orderId,
              title,
              body,
              link: "/seller/claims",
            });
            await notifyAdmins(client, title, body, "/admin/claims");
          } catch (error) {
            console.error("create claim notifications failed", error);
          }

          await client.query("COMMIT");
          return ok(res, { claim_type: claimType });
        } catch (error) {
          await client.query("ROLLBACK");
          console.error("ORDER CLAIM ERROR:", String((error as Error)?.message || error));
          return dbError(res, error);
        } finally {
          client.release();
        }
      } catch (error) {
        console.error("ORDER CLAIM ERROR:", String((error as Error)?.message || error));
        return dbError(res, error);
      }
    },

    async listSellerClaims(req: AuthenticatedRequest, res: Response) {
      if (!req.user?.is_seller || !req.user.id) {
        return fail(res, 403, "seller_only", "Доступ продавца сейчас отключен.");
      }

      try {
        const items = await listSellerClaims(pool, req.user.id);
        return ok(res, { items });
      } catch (error) {
        console.error("SELLER CLAIMS LIST ERROR:", String((error as Error)?.message || error));
        return dbError(res, error);
      }
    },

    async listAdminClaims(_req: AuthenticatedRequest, res: Response) {
      try {
        const items = await listAdminClaims(pool);
        return ok(res, { items });
      } catch (error) {
        console.error("ADMIN CLAIMS LIST ERROR:", String((error as Error)?.message || error));
        return dbError(res, error);
      }
    },

    async updateSellerClaim(req: AuthenticatedRequest, res: Response) {
      const claimId = toPositiveInt(req.params.id);
      const status = parseEnum(req.body?.status, ["open", "in_review", "approved", "rejected", "resolved"], null);
      const sellerReply = parseOptionalString(req.body?.seller_reply, { max: 1000 }) ?? null;

      if (!claimId) return badRequest(res, "bad_id");
      if (!status) return badRequest(res, "bad_status");
      if (sellerReply === null) return badRequest(res, "bad_note");
      if (!req.user?.is_seller || !req.user.id) {
        return fail(res, 403, "seller_only", "Доступ продавца сейчас отключен.");
      }

      try {
        const claim = await sellerCanAccessClaim(pool, claimId, req.user.id);
        if (!claim) return notFound(res);

        await pool.query(
          `UPDATE order_claims
           SET status = $1,
               seller_reply = $2,
               updated_at = NOW()
           WHERE id = $3`,
          [status, sellerReply.trim(), claimId],
        );

        await pool.query(
          `INSERT INTO order_status_history(order_id, status, note)
           VALUES ($1, $2, $3)`,
          [
            Number(claim.order_id),
            String(claim.status || "paid"),
            `Обращение #${claimId}: ${status}${sellerReply.trim() ? ` — ${sellerReply.trim()}` : ""}`,
          ],
        );

        try {
          await createNotification(pool, {
            userId: Number(claim.user_id),
            title: "Обращение обновлено",
            body: `По заказу #${claim.order_id} продавец обновил обращение: ${status}.`,
            link: `/orders/${claim.order_id}`,
          });
        } catch (error) {
          console.error("create seller claim notification failed", error);
        }
        return ok(res);
      } catch (error) {
        console.error("SELLER CLAIM UPDATE ERROR:", String((error as Error)?.message || error));
        return dbError(res, error);
      }
    },

    async updateAdminClaim(req: AuthenticatedRequest, res: Response) {
      const claimId = toPositiveInt(req.params.id);
      const status = parseEnum(req.body?.status, ["open", "in_review", "approved", "rejected", "resolved", "escalated"], null);
      const resolution = parseOptionalString(req.body?.resolution, { max: 1000 }) ?? null;

      if (!claimId) return badRequest(res, "bad_id");
      if (!status) return badRequest(res, "bad_status");
      if (resolution === null) return badRequest(res, "bad_note");

      try {
        const claim = await getAdminClaim(pool, claimId);
        if (!claim) return notFound(res);

        await pool.query(
          `UPDATE order_claims
           SET status = $1,
               resolution = $2,
               updated_at = NOW()
           WHERE id = $3`,
          [status, resolution.trim(), claimId],
        );

        const noteSuffix = resolution.trim() ? ` — ${resolution.trim()}` : "";
        await pool.query(
          `INSERT INTO order_status_history(order_id, status, note)
           VALUES ($1, $2, $3)`,
          [
            Number(claim.order_id),
            String(claim.status || "paid"),
            `Обращение #${claimId}: администратор установил статус ${status}${noteSuffix}`,
          ],
        );

        try {
          const body = `По заказу #${claim.order_id} администратор обновил обращение #${claimId}: ${status}.`;
          await createNotification(pool, {
            userId: Number(claim.user_id),
            title: "Обращение обновлено администратором",
            body,
            link: `/orders/${claim.order_id}`,
          });
          await createNotification(pool, {
            userId: Number(claim.seller_user_id),
            title: "Обращение обновлено администратором",
            body,
            link: "/seller/claims",
          });
        } catch (error) {
          console.error("create admin claim notifications failed", error);
        }
        await writeAdminAuditLog(pool, {
          actor: req.user,
          action: "claim.update",
          entityType: "order_claim",
          entityId: claimId,
          targetUserId: Number(claim.user_id),
          summary: "Updated buyer claim from admin panel",
          metadata: { status, resolution: resolution.trim(), order_id: Number(claim.order_id), seller_user_id: Number(claim.seller_user_id) },
        });

        return ok(res);
      } catch (error) {
        console.error("ADMIN CLAIM UPDATE ERROR:", String((error as Error)?.message || error));
        return dbError(res, error);
      }
    },

    async updateSellerSaleStatus(req: AuthenticatedRequest, res: Response) {
      const saleId = toPositiveInt(req.params.id);
      const status = parseEnum(req.body?.status, orderStatuses, null);
      const note = parseOptionalString(req.body?.note, { max: 500 }) ?? null;

      if (!saleId) return badRequest(res, "bad_id");
      if (!status) return badRequest(res, "bad_status");
      if (note === null) return badRequest(res, "bad_note");
      if (!req.user?.is_seller) {
        return fail(res, 403, "seller_only", "Доступ продавца сейчас отключен.");
      }

      try {
        await ensureOrderItemSellerStateColumns(pool);
        const sale = await sellerCanAccessSale(pool, saleId, req.user.id);
        if (!sale) return notFound(res);

        await pool.query(
          `UPDATE order_items
           SET seller_status = $1,
               seller_note = $2,
               seller_updated_at = NOW()
           WHERE id = $3`,
          [status, note || "", saleId],
        );

        await pool.query(
          `INSERT INTO order_status_history(order_id, status, note)
           VALUES ($1, $2, $3)`,
          [sale.order_id, status, `Изменено продавцом для позиции #${saleId}: ${note || ""}`.trim()],
        );

        try {
          await createNotification(pool, {
            userId: Number(sale.user_id),
            title: "Статус товара в заказе обновлен",
            body: `Продавец обновил статус товара в заказе #${sale.order_id}: ${orderStatusLabel(status)}.`,
            link: `/orders/${sale.order_id}`,
          });
        } catch (error) {
          console.error("create seller sale status notification failed", error);
        }
        return ok(res);
      } catch (error) {
        console.error("SELLER SALE STATUS ERROR:", String((error as Error)?.message || error));
        return dbError(res, error);
      }
    },

    async updateOrderStatus(req: AuthenticatedRequest, res: Response) {
      const orderId = toPositiveInt(req.params.id);
      const status = parseEnum(req.body?.status, orderStatuses, null);
      const note = parseOptionalString(req.body?.note, { max: 500 }) ?? null;

      if (!orderId) return badRequest(res, "bad_id");
      if (!status) return badRequest(res, "bad_status");
      if (note === null) return badRequest(res, "bad_note");

      try {
        const updatedOrder = await pool.query<{ id: number; user_id: number; status: string }>(
          `UPDATE orders
           SET status = $1
           WHERE id = $2
           RETURNING id, user_id, status`,
          [status, orderId],
        );
        const order = updatedOrder.rows[0];
        if (!order) return notFound(res);

        await pool.query(
          `INSERT INTO order_status_history(order_id, status, note)
           VALUES ($1, $2, $3)`,
          [orderId, status, note],
        );

        try {
          const body = `Заказ #${orderId} ${orderStatusLabel(status)}${note ? `: ${note}` : "."}`;
          await createNotification(pool, {
            userId: Number(order.user_id),
            title: "Статус заказа обновлен",
            body,
            link: `/orders/${orderId}`,
          });
          await notifyOrderSellers(pool, {
            orderId,
            title: "Статус заказа обновлен",
            body: `Администратор обновил заказ #${orderId}: ${orderStatusLabel(status)}.`,
            link: "/seller/sales",
            excludeUserId: Number(order.user_id),
          });
        } catch (error) {
          console.error("create admin order status notifications failed", error);
        }
        await writeAdminAuditLog(pool, {
          actor: req.user,
          action: "order.status_update",
          entityType: "order",
          entityId: orderId,
          targetUserId: Number(order.user_id),
          summary: "Updated order status from admin panel",
          metadata: { status, note },
        });

        return ok(res);
      } catch (error) {
        console.error("ORDER STATUS ERROR:", String((error as Error)?.message || error));
        return dbError(res, error);
      }
    },
  };
}
