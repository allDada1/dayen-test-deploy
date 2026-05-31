import { pool } from "./pool";

export async function backfillProductImages() {
  await pool.query(`
    INSERT INTO product_images (product_id, image_url, sort_order, is_cover)
    SELECT p.id, TRIM(p.image_url), 0, TRUE
    FROM products p
    WHERE COALESCE(TRIM(p.image_url), '') <> ''
      AND NOT EXISTS (
        SELECT 1 FROM product_images pi WHERE pi.product_id = p.id
      );
  `);
}

export async function backfillProductCategories() {
  await pool.query(`
    UPDATE products p
    SET category = c.title
    FROM categories c
    WHERE c.slug = p.tile_slug
      AND (p.category IS NULL OR TRIM(p.category) = '' OR p.category = 'Разное');
  `);
}

export async function backfillOrderStatusHistory() {
  await pool.query(`
    INSERT INTO order_status_history(order_id, status, note)
    SELECT o.id,
           CASE WHEN o.status = 'created' THEN 'pending' ELSE o.status END,
           ''::text
    FROM orders o
    WHERE NOT EXISTS (
      SELECT 1 FROM order_status_history h WHERE h.order_id = o.id
    );
  `);
}

export async function runBackfills() {
  await backfillProductImages();
  await backfillProductCategories();
  await backfillOrderStatusHistory();
}
