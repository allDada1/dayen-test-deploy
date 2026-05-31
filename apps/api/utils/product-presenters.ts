import type { Pool } from "pg";

type ProductRow = Record<string, any>;
type RatingsMapValue = { avg: number; cnt: number };

function toProductList(input: ProductRow[] | ProductRow) {
  return Array.isArray(input) ? input : [input];
}

function getProductIds(list: ProductRow[]) {
  return list.map((p) => Number(p?.id)).filter((id) => Number.isFinite(id) && id > 0);
}

function makeDefaultProductStats(product: ProductRow) {
  return {
    ...product,
    likes: 0,
    rating_avg: 0,
    rating_count: 0,
    is_liked: false,
    my_rating: null,
  };
}

function buildPlaceholders(ids: number[], startAt = 1) {
  return ids.map((_, i) => `$${i + startAt}`).join(",");
}

async function fetchLikesMap(pool: Pool, ids: number[]) {
  if (!ids.length) return new Map<number, number>();

  const placeholders = buildPlaceholders(ids);
  const result = await pool.query<{ product_id: number; likes: number }>(
    `SELECT product_id, COUNT(*)::int AS likes
     FROM product_likes
     WHERE product_id IN (${placeholders})
     GROUP BY product_id`,
    ids,
  );

  return new Map((result.rows || []).map((row) => [Number(row.product_id), Number(row.likes || 0)]));
}

async function fetchRatingsMap(pool: Pool, ids: number[]) {
  if (!ids.length) return new Map<number, RatingsMapValue>();

  const placeholdersRatings = buildPlaceholders(ids, 1);
  const placeholdersReviews = buildPlaceholders(ids, ids.length + 1);

  const result = await pool.query<{ product_id: number; rating_avg: number; rating_count: number }>(
    `SELECT t.product_id,
            ROUND(AVG(t.rating)::numeric, 2) AS rating_avg,
            COUNT(*)::int AS rating_count
     FROM (
       SELECT pr.product_id, pr.rating::numeric AS rating
       FROM product_ratings pr
       WHERE pr.product_id IN (${placeholdersRatings})

       UNION ALL

       SELECT r.product_id, r.rating::numeric AS rating
       FROM reviews r
       WHERE r.product_id IN (${placeholdersReviews})
     ) t
     GROUP BY t.product_id`,
    [...ids, ...ids],
  );

  return new Map(
    (result.rows || []).map((row) => [
      Number(row.product_id),
      {
        avg: Number(row.rating_avg) || 0,
        cnt: Number(row.rating_count) || 0,
      },
    ]),
  );
}

async function fetchUserProductState(pool: Pool, userId: number | null, ids: number[]) {
  if (!userId || !ids.length) {
    return {
      myLikeSet: new Set<number>(),
      myRateMap: new Map<number, number>(),
    };
  }

  const placeholders = buildPlaceholders(ids, 2);
  const values = [userId, ...ids];

  const [likesResult, ratingsResult] = await Promise.all([
    pool.query<{ product_id: number }>(
      `SELECT product_id
       FROM product_likes
       WHERE user_id = $1
         AND product_id IN (${placeholders})`,
      values,
    ),
    pool.query<{ product_id: number; rating: number }>(
      `SELECT product_id, rating
       FROM product_ratings
       WHERE user_id = $1
         AND product_id IN (${placeholders})`,
      values,
    ),
  ]);

  return {
    myLikeSet: new Set((likesResult.rows || []).map((row) => Number(row.product_id))),
    myRateMap: new Map((ratingsResult.rows || []).map((row) => [Number(row.product_id), Number(row.rating)])),
  };
}

function applyStatsToProducts(
  list: ProductRow[],
  likesMap: Map<number, number>,
  ratingsMap: Map<number, RatingsMapValue>,
  myLikeSet: Set<number>,
  myRateMap: Map<number, number>,
) {
  return list.map((product) => {
    const productId = Number(product?.id);
    const rating = ratingsMap.get(productId) || { avg: 0, cnt: 0 };

    return {
      ...product,
      likes: Number(likesMap.get(productId) || 0),
      rating_avg: rating.avg,
      rating_count: rating.cnt,
      is_liked: myLikeSet.has(productId),
      my_rating: myRateMap.has(productId) ? myRateMap.get(productId) : null,
    };
  });
}

export async function buildProductsWithStats(pool: Pool, rows: ProductRow[] | ProductRow, userId: number | null) {
  const list = toProductList(rows);
  const ids = getProductIds(list);

  if (!ids.length) {
    return list.map(makeDefaultProductStats);
  }

  const [likesMap, ratingsMap, userState] = await Promise.all([
    fetchLikesMap(pool, ids),
    fetchRatingsMap(pool, ids),
    fetchUserProductState(pool, userId, ids),
  ]);

  return applyStatsToProducts(list, likesMap, ratingsMap, userState.myLikeSet, userState.myRateMap);
}

export async function withProductStats(
  pool: Pool,
  rows: ProductRow[] | ProductRow,
  userId: number | null,
  cb?: (output: ProductRow[]) => unknown,
) {
  try {
    const output = await buildProductsWithStats(pool, rows, userId);
    return typeof cb === "function" ? cb(output) : output;
  } catch (error) {
    console.error("withProductStats error:", error);
    const fallback = toProductList(rows).map(makeDefaultProductStats);
    return typeof cb === "function" ? cb(fallback) : fallback;
  }
}

function normalizeImageUrl(value: unknown) {
  return String(value || "").trim();
}

function mapProductsWithImages(products: ProductRow[], byProduct: Map<number, string[]>) {
  return products.map((product) => {
    const fallback = normalizeImageUrl(product?.image_url);
    const images = (byProduct.get(Number(product.id)) || []).filter(Boolean);

    if (!images.length && fallback) images.push(fallback);
    return { ...product, images };
  });
}

export async function attachImagesToProducts(pool: Pool, products: ProductRow[] | ProductRow) {
  const list = toProductList(products);
  if (!list.length) return list;

  const ids = getProductIds(list);
  if (!ids.length) {
    return list.map((product) => {
      const imageUrl = normalizeImageUrl(product?.image_url);
      return { ...product, images: imageUrl ? [imageUrl] : [] };
    });
  }

  const placeholders = buildPlaceholders(ids);
  const result = await pool.query<{ product_id: number; image_url: string }>(
    `SELECT product_id, image_url
     FROM product_images
     WHERE product_id IN (${placeholders})
     ORDER BY product_id ASC, is_cover DESC, sort_order ASC, id ASC`,
    ids,
  );

  const byProduct = new Map<number, string[]>();
  for (const row of result.rows || []) {
    const productId = Number(row.product_id);
    const imageUrl = normalizeImageUrl(row.image_url);
    if (!imageUrl) continue;
    if (!byProduct.has(productId)) byProduct.set(productId, []);
    byProduct.get(productId)!.push(imageUrl);
  }

  return mapProductsWithImages(list, byProduct);
}

export function createProductPresenters(pool: Pool) {
  return {
    withProductStats: (rows: ProductRow[] | ProductRow, userId: number | null, cb?: (output: ProductRow[]) => unknown) =>
      withProductStats(pool, rows, userId, cb),
    attachImagesToProducts: (products: ProductRow[] | ProductRow) => attachImagesToProducts(pool, products),
  };
}
