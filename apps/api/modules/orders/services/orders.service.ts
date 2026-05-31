import type { Pool, PoolClient } from "pg";

import type { AppUser } from "../../../types/app";
import { createNotification } from "../../notifications/services/notification.service";

type Queryable = Pool | PoolClient;
type GenericRow = Record<string, any>;
type OrderUser = Pick<AppUser, "id" | "is_admin" | "is_owner" | "two_factor_enabled">;

type ServiceError = {
  status: number;
  body: Record<string, unknown>;
};

type CreateOrderResult =
  | { orderId: number }
  | { error: ServiceError };

function selectAccessibleOrderSql(columns = "*") {
  return {
    admin: `SELECT ${columns} FROM orders WHERE id = $1`,
    user: `SELECT ${columns} FROM orders WHERE id = $1 AND user_id = $2`,
  };
}

export async function queryAccessibleOrder(pool: Pool, orderId: number, user: OrderUser, columns = "*") {
  const sql = selectAccessibleOrderSql(columns);
  const hasElevatedAccess = hasElevatedOrderAccess(user);
  const result = hasElevatedAccess
    ? await pool.query(sql.admin, [orderId])
    : await pool.query(sql.user, [orderId, user.id]);

  return result.rows[0] || null;
}

export function hasElevatedOrderAccess(user?: Pick<AppUser, "is_admin" | "is_owner" | "two_factor_enabled"> | null) {
  return !!((user?.is_admin || user?.is_owner) && user.two_factor_enabled);
}

export async function getAccessibleOrder(pool: Pool, orderId: number, user: OrderUser) {
  return queryAccessibleOrder(pool, orderId, user, "*");
}

export async function getAccessibleOrderBrief(pool: Pool, orderId: number, user: OrderUser) {
  return queryAccessibleOrder(pool, orderId, user, "id, user_id, status");
}

export async function ensureOrderItemSellerStateColumns(poolOrClient: Queryable) {
  await poolOrClient.query(`
    ALTER TABLE order_items
      ADD COLUMN IF NOT EXISTS seller_status TEXT DEFAULT 'pending',
      ADD COLUMN IF NOT EXISTS seller_note TEXT DEFAULT '',
      ADD COLUMN IF NOT EXISTS seller_updated_at TIMESTAMP DEFAULT NOW()
  `);
}

export async function ensureOrderClaimsTable(poolOrClient: Queryable) {
  await poolOrClient.query(`
    CREATE TABLE IF NOT EXISTS order_claims (
      id SERIAL PRIMARY KEY,
      order_id INT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      seller_user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      reason TEXT NOT NULL DEFAULT '',
      seller_reply TEXT NOT NULL DEFAULT '',
      resolution TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
}

export function aggregateOrderDisplayStatus(rows: GenericRow[], fallbackStatus = "created") {
  const fallback = String(fallbackStatus || "created").toLowerCase().trim();
  if (["shipped", "delayed", "delivered", "cancelled"].includes(fallback)) return fallback;

  const items = Array.isArray(rows) ? rows : [];
  const normalized = items
    .map((row) => String(row?.seller_status || "").toLowerCase().trim())
    .filter(Boolean);

  if (!normalized.length) return fallback;

  const uniq = [...new Set(normalized)];
  if (uniq.length === 1) return uniq[0];
  return "mixed";
}

export async function listMyOrders(pool: Pool, userId: number) {
  await ensureOrderItemSellerStateColumns(pool);

  const result = await pool.query<GenericRow>(
    `SELECT *
     FROM orders
     WHERE user_id = $1
     ORDER BY id DESC`,
    [userId],
  );

  const orders = result.rows || [];
  if (!orders.length) return orders;

  const orderIds = orders.map((row) => Number(row.id)).filter((id) => Number.isFinite(id) && id > 0);
  const itemsResult = await pool.query<GenericRow>(
    `SELECT order_id, COALESCE(seller_status, 'pending') AS seller_status
     FROM order_items
     WHERE order_id = ANY($1::int[])`,
    [orderIds],
  );

  const byOrder = new Map<number, GenericRow[]>();
  for (const row of itemsResult.rows || []) {
    const key = Number(row.order_id);
    if (!byOrder.has(key)) byOrder.set(key, []);
    byOrder.get(key)?.push(row);
  }

  return orders.map((order) => {
    const displayStatus = aggregateOrderDisplayStatus(byOrder.get(Number(order.id)) || [], order.status || "created");
    return {
      ...order,
      display_status: displayStatus,
    };
  });
}

export async function getOrderItems(pool: Pool, orderId: number) {
  await ensureOrderItemSellerStateColumns(pool);

  const result = await pool.query<GenericRow>(
    `SELECT
       oi.*,
       COALESCE(oi.seller_status, 'pending') AS seller_status,
       COALESCE(oi.seller_note, '') AS seller_note,
       oi.seller_updated_at,
       COALESCE(p.owner_user_id, 0) AS seller_id,
       COALESCE(u.name, '') AS seller_name,
       COALESCE(u.email, '') AS seller_email,
       COALESCE(p.image_url, '') AS image_url
     FROM order_items oi
     LEFT JOIN products p ON p.id = oi.product_id
     LEFT JOIN users u ON u.id = p.owner_user_id
     WHERE oi.order_id = $1
     ORDER BY oi.id ASC`,
    [orderId],
  );

  return result.rows || [];
}

export async function getRepeatOrderItems(pool: Pool, orderId: number) {
  const result = await pool.query<GenericRow>(
    `SELECT oi.product_id,
            oi.qty,
            COALESCE(p.stock, 0) AS available_stock
     FROM order_items oi
     LEFT JOIN products p ON p.id = oi.product_id
     WHERE oi.order_id = $1
     ORDER BY oi.id ASC`,
    [orderId],
  );

  return result.rows || [];
}

export async function getOrderHistory(pool: Pool, orderId: number) {
  const result = await pool.query<GenericRow>(
    `SELECT status, note, created_at
     FROM order_status_history
     WHERE order_id = $1
     ORDER BY id ASC`,
    [orderId],
  );

  return result.rows || [];
}

export async function getOrderClaims(pool: Pool, orderId: number) {
  await ensureOrderClaimsTable(pool);

  const result = await pool.query<GenericRow>(
    `SELECT
       oc.id,
       oc.order_id,
       oc.user_id,
       oc.seller_user_id,
       oc.type,
       oc.status,
       oc.reason,
       oc.seller_reply,
       oc.resolution,
       oc.created_at,
       oc.updated_at,
       COALESCE(u.name, '') AS seller_name,
       COALESCE(u.email, '') AS seller_email,
       COUNT(oi.id)::int AS items_count,
       COALESCE(MIN(p.image_url), '') AS image_url,
       COALESCE(STRING_AGG(DISTINCT COALESCE(oi.title, p.title, ''), ' • '), '') AS product_titles
     FROM order_claims oc
     LEFT JOIN users u ON u.id = oc.seller_user_id
     LEFT JOIN order_items oi ON oi.order_id = oc.order_id
     LEFT JOIN products p ON p.id = oi.product_id AND p.owner_user_id = oc.seller_user_id
     WHERE oc.order_id = $1
     GROUP BY oc.id, u.name, u.email
     ORDER BY oc.id DESC`,
    [orderId],
  );

  return result.rows || [];
}

function normalizeOrderInput(body: any) {
  return {
    items: Array.isArray(body?.items) ? body.items : [],
    delivery: body?.delivery && typeof body.delivery === "object" ? body.delivery : {},
    comment: String(body?.comment || "").trim(),
  };
}

function getUniqueProductIds(items: any[]) {
  return [...new Set(items.map((item) => Number(item?.product_id)).filter((id) => Number.isFinite(id) && id > 0))];
}

async function loadProductsForOrder(pool: Pool, productIds: number[]) {
  if (!productIds.length) return [];

  const placeholders = productIds.map((_, i) => `$${i + 1}`).join(",");
  const result = await pool.query<GenericRow>(
    `SELECT id, title, price, stock
     FROM products
     WHERE id IN (${placeholders})`,
    productIds,
  );

  return result.rows || [];
}

function validateAndBuildOrderItems(items: any[], products: GenericRow[]) {
  const byId = new Map((products || []).map((row) => [Number(row.id), row]));
  const normalized: GenericRow[] = [];
  let subtotal = 0;

  for (const item of items) {
    const productId = Number(item?.product_id);
    const qty = Math.max(1, Math.min(999, Number(item?.qty) || 1));
    const product = byId.get(productId);

    if (!product) {
      return { error: { status: 400, body: { error: "product_not_found", product_id: productId } } };
    }

    if (Number(product.stock) < qty) {
      return { error: { status: 400, body: { error: "not_enough_stock", product_id: productId } } };
    }

    const price = Number(product.price) || 0;
    subtotal += price * qty;
    normalized.push({
      product_id: productId,
      title: String(product.title || ""),
      price,
      qty,
    });
  }

  return { subtotal, normalized };
}

function hasServiceError(value: unknown): value is { error: ServiceError } {
  return !!value && typeof value === "object" && "error" in value;
}

function normalizeDeliveryInfo(delivery: any) {
  return {
    method: String(delivery?.method || "").trim(),
    city: String(delivery?.city || "").trim(),
    address: String(delivery?.address || "").trim(),
    phone: String(delivery?.phone || "").trim(),
    email: String(delivery?.email || delivery?.contact_email || "").trim().toLowerCase(),
    price: Math.max(0, Number(delivery?.price || 0) || 0),
  };
}

function validateDeliveryInfo(deliveryInfo: ReturnType<typeof normalizeDeliveryInfo>) {
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!deliveryInfo.method) {
    return { status: 400, body: { error: "delivery_method_required" } };
  }
  if (!deliveryInfo.city) {
    return { status: 400, body: { error: "delivery_city_required" } };
  }
  if (!deliveryInfo.address) {
    return { status: 400, body: { error: "delivery_address_required" } };
  }
  if (!deliveryInfo.phone) {
    return { status: 400, body: { error: "delivery_phone_required" } };
  }
  if (deliveryInfo.email && !emailPattern.test(deliveryInfo.email)) {
    return { status: 400, body: { error: "bad_email" } };
  }
  return null;
}

async function insertOrderItems(client: PoolClient, orderId: number, items: GenericRow[]) {
  await ensureOrderItemSellerStateColumns(client);

  for (const item of items) {
    await client.query(
      `INSERT INTO order_items (order_id, product_id, title, price, qty, seller_status, seller_note, seller_updated_at)
       VALUES ($1, $2, $3, $4, $5, 'pending', '', NOW())`,
      [orderId, item.product_id, item.title, item.price, item.qty],
    );
  }
}

async function decrementProductStock(client: PoolClient, items: GenericRow[]) {
  for (const item of items) {
    const result = await client.query(
      `UPDATE products
       SET stock = stock - $1
       WHERE id = $2
         AND stock >= $1`,
      [item.qty, item.product_id],
    );

    if (!result.rowCount) {
      return { error: { status: 400, body: { error: "not_enough_stock", product_id: item.product_id } } };
    }
  }

  return null;
}

export async function createOrder(pool: Pool, userId: number, payload: any): Promise<CreateOrderResult> {
  const { items, delivery, comment } = normalizeOrderInput(payload);

  if (!items.length) {
    return { error: { status: 400, body: { error: "empty_items" } } };
  }

  const productIds = getUniqueProductIds(items);
  if (!productIds.length) {
    return { error: { status: 400, body: { error: "bad_items" } } };
  }

  const products = await loadProductsForOrder(pool, productIds);
  const built = validateAndBuildOrderItems(items, products);
  if (hasServiceError(built)) return { error: built.error };

  const deliveryInfo = normalizeDeliveryInfo(delivery);
  const deliveryError = validateDeliveryInfo(deliveryInfo);
  if (deliveryError) {
    return { error: deliveryError };
  }
  const subtotal = Number(built.subtotal || 0);
  const deliveryPrice = deliveryInfo.price;
  const total = subtotal + deliveryPrice;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await ensureOrderItemSellerStateColumns(client);

    const orderResult = await client.query<{ id: number }>(
      `INSERT INTO orders
       (user_id, status, subtotal, delivery_price, total, delivery_method, delivery_city, delivery_address, phone, contact_email, comment)
       VALUES ($1, 'created', $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id`,
      [
        userId,
        Math.round(subtotal),
        Math.round(deliveryPrice),
        Math.round(total),
        deliveryInfo.method,
        deliveryInfo.city,
        deliveryInfo.address,
        deliveryInfo.phone,
        deliveryInfo.email,
        comment,
      ],
    );

    const orderId = Number(orderResult.rows[0]?.id);
    const normalizedItems = built.normalized || [];

    await insertOrderItems(client, orderId, normalizedItems);
    const stockError = await decrementProductStock(client, normalizedItems);
    if (stockError) {
      await client.query("ROLLBACK");
      return { error: stockError.error };
    }

    await client.query(
      `INSERT INTO order_status_history(order_id, status, note)
       VALUES ($1, 'pending', '')`,
      [orderId],
    );

    await createNotification(client, {
      userId,
      title: "Заказ создан",
      body: `Заказ #${orderId} создан. Перейдите к оплате, чтобы продавец начал обработку.`,
      link: `/payment?order=${orderId}`,
    });

    await client.query("COMMIT");
    return { orderId };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function listSellerSales(pool: Pool, sellerUserId: number) {
  await ensureOrderItemSellerStateColumns(pool);

  const result = await pool.query<GenericRow>(
    `SELECT
       oi.id AS sale_id,
       o.id AS order_id,
       COALESCE(oi.seller_status, 'pending') AS status,
       COALESCE(oi.seller_note, '') AS seller_note,
       COALESCE(o.comment, '') AS order_comment,
       o.created_at,
       COALESCE(u.name, '') AS buyer_name,
       COALESCE(NULLIF(o.contact_email, ''), u.email, '') AS buyer_email,
       oi.product_id,
       COALESCE(oi.title, p.title, '') AS product_title,
       COALESCE(p.image_url, '') AS image_url,
       COALESCE(oi.price, 0) AS price,
       COALESCE(oi.qty, 0) AS qty,
       (COALESCE(oi.price, 0) * COALESCE(oi.qty, 0))::int AS line_total
     FROM order_items oi
     JOIN orders o ON o.id = oi.order_id
     JOIN products p ON p.id = oi.product_id
     LEFT JOIN users u ON u.id = o.user_id
     WHERE p.owner_user_id = $1
     ORDER BY o.id DESC, oi.id DESC`,
    [sellerUserId],
  );

  return result.rows || [];
}

export function summarizeSellerSales(items: GenericRow[]) {
  const rows = Array.isArray(items) ? items : [];
  let newCount = 0;

  for (const row of rows) {
    const status = String(row?.status || "").toLowerCase();
    if (status === "pending" || status === "paid") newCount += 1;
  }

  return {
    total_count: rows.length,
    new_count: newCount,
  };
}

export async function sellerCanAccessSale(pool: Pool, saleId: number, sellerUserId: number) {
  const result = await pool.query<GenericRow>(
    `SELECT
       oi.id AS sale_id,
       oi.order_id,
       o.user_id,
       COALESCE(oi.seller_status, 'pending') AS seller_status
     FROM order_items oi
     JOIN orders o ON o.id = oi.order_id
     JOIN products p ON p.id = oi.product_id
     WHERE oi.id = $1
       AND p.owner_user_id = $2
     LIMIT 1`,
    [saleId, sellerUserId],
  );

  return result.rows[0] || null;
}

export async function listSellerClaims(pool: Pool, sellerUserId: number) {
  await ensureOrderClaimsTable(pool);

  const result = await pool.query<GenericRow>(
    `SELECT
       oc.id,
       oc.order_id,
       oc.user_id,
       oc.seller_user_id,
       oc.type,
       oc.status,
       oc.reason,
       oc.seller_reply,
       oc.resolution,
       oc.created_at,
       oc.updated_at,
       COALESCE(u.name, '') AS buyer_name,
       COALESCE(NULLIF(o.contact_email, ''), u.email, '') AS buyer_email,
       COUNT(oi.id)::int AS items_count,
       COALESCE(MIN(p.image_url), '') AS image_url,
       COALESCE(STRING_AGG(DISTINCT COALESCE(oi.title, p.title, ''), ' • '), '') AS product_titles
     FROM order_claims oc
     LEFT JOIN orders o ON o.id = oc.order_id
     LEFT JOIN users u ON u.id = oc.user_id
     LEFT JOIN order_items oi ON oi.order_id = oc.order_id
     LEFT JOIN products p ON p.id = oi.product_id AND p.owner_user_id = oc.seller_user_id
     WHERE oc.seller_user_id = $1
     GROUP BY oc.id, u.name, u.email, o.contact_email
     ORDER BY oc.id DESC`,
    [sellerUserId],
  );

  return result.rows || [];
}

export async function listAdminClaims(pool: Pool) {
  await ensureOrderClaimsTable(pool);

  const result = await pool.query<GenericRow>(
    `SELECT
       oc.id,
       oc.order_id,
       oc.user_id,
       oc.seller_user_id,
       oc.type,
       oc.status,
       oc.reason,
       oc.seller_reply,
       oc.resolution,
       oc.created_at,
       oc.updated_at,
       COALESCE(buyer.name, '') AS buyer_name,
       COALESCE(NULLIF(o.contact_email, ''), buyer.email, '') AS buyer_email,
       COALESCE(seller.name, '') AS seller_name,
       COALESCE(seller.email, '') AS seller_email,
       COALESCE(o.status, '') AS order_status,
       COALESCE(o.total, 0)::int AS order_total,
       COUNT(oi.id)::int AS items_count,
       COALESCE(MIN(p.image_url), '') AS image_url,
       COALESCE(STRING_AGG(DISTINCT COALESCE(oi.title, p.title, ''), ' • '), '') AS product_titles
     FROM order_claims oc
     LEFT JOIN users buyer ON buyer.id = oc.user_id
     LEFT JOIN users seller ON seller.id = oc.seller_user_id
     LEFT JOIN orders o ON o.id = oc.order_id
     LEFT JOIN order_items oi ON oi.order_id = oc.order_id
     LEFT JOIN products p ON p.id = oi.product_id AND p.owner_user_id = oc.seller_user_id
     GROUP BY oc.id, buyer.name, buyer.email, seller.name, seller.email, o.status, o.total, o.contact_email
     ORDER BY
       CASE
         WHEN oc.status IN ('open', 'in_review', 'escalated') THEN 0
         ELSE 1
       END,
       oc.updated_at DESC,
       oc.id DESC`,
  );

  return result.rows || [];
}

export async function sellerCanAccessClaim(pool: Pool, claimId: number, sellerUserId: number) {
  await ensureOrderClaimsTable(pool);

  const result = await pool.query<GenericRow>(
    `SELECT *
     FROM order_claims
     WHERE id = $1
       AND seller_user_id = $2
     LIMIT 1`,
    [claimId, sellerUserId],
  );

  return result.rows[0] || null;
}

export async function getAdminClaim(pool: Pool, claimId: number) {
  await ensureOrderClaimsTable(pool);

  const result = await pool.query<GenericRow>(
    `SELECT *
     FROM order_claims
     WHERE id = $1
     LIMIT 1`,
    [claimId],
  );

  return result.rows[0] || null;
}
