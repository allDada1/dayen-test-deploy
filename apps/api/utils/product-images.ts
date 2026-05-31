import type { Pool } from "pg";

export function normalizeImagesInput(input: unknown) {
  if (!Array.isArray(input)) return [];

  const seen = new Set<string>();
  const out: string[] = [];

  for (const raw of input) {
    const url = typeof raw === "string" ? raw.trim() : String((raw as any)?.image_url || "").trim();

    if (!url || seen.has(url)) continue;

    seen.add(url);
    out.push(url);
  }

  return out;
}

export async function saveProductImages(
  pool: Pool,
  productId: number,
  images: unknown,
  fallbackImageUrl?: string,
) {
  const normalized = normalizeImagesInput(images);

  let finalImages = normalized;

  if (!finalImages.length && String(fallbackImageUrl || "").trim()) {
    finalImages = [String(fallbackImageUrl).trim()];
  }

  await pool.query(`DELETE FROM product_images WHERE product_id=$1`, [productId]);

  for (let i = 0; i < finalImages.length; i += 1) {
    await pool.query(
      `INSERT INTO product_images
       (product_id, image_url, sort_order, is_cover)
       VALUES ($1,$2,$3,$4)`,
      [productId, finalImages[i], i, i === 0],
    );
  }

  const cover = finalImages[0] || "";

  await pool.query(`UPDATE products SET image_url=$2 WHERE id=$1`, [productId, cover]);

  return finalImages;
}
