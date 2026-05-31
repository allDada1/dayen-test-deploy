import type { Pool, PoolClient } from "pg";

type Queryable = Pool | PoolClient;

type NotificationInput = {
  userId: number;
  title: string;
  body: string;
  link?: string;
};

type OrderSellerNotificationInput = {
  orderId: number;
  title: string;
  body: string;
  link?: string;
  excludeUserId?: number;
};

export async function createNotification(db: Queryable, input: NotificationInput) {
  const userId = Number(input.userId);
  if (!Number.isFinite(userId) || userId <= 0) return;

  await db.query(
    `INSERT INTO notifications (user_id, title, body, link)
     VALUES ($1, $2, $3, $4)`,
    [userId, input.title, input.body, input.link || "/notifications"],
  );
}

export async function notifyAdmins(db: Queryable, title: string, body: string, link = "/admin") {
  await db.query(
    `INSERT INTO notifications (user_id, title, body, link)
     SELECT id, $1, $2, $3
     FROM users
     WHERE is_admin = TRUE OR COALESCE(is_owner, false) = TRUE`,
    [title, body, link],
  );
}

export async function notifyOrderSellers(db: Queryable, input: OrderSellerNotificationInput) {
  const values: unknown[] = [input.orderId, input.title, input.body, input.link || "/seller/sales"];
  const excludeClause = input.excludeUserId ? "AND p.owner_user_id <> $5" : "";
  if (input.excludeUserId) values.push(input.excludeUserId);

  await db.query(
    `INSERT INTO notifications (user_id, title, body, link)
     SELECT DISTINCT p.owner_user_id, $2, $3, $4
     FROM order_items oi
     JOIN products p ON p.id = oi.product_id
     WHERE oi.order_id = $1
       AND COALESCE(p.owner_user_id, 0) > 0
       ${excludeClause}`,
    values,
  );
}
