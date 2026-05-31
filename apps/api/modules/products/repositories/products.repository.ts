import type { Pool } from "pg";

export type ProductRow = Record<string, any>;

export type ProductFilters = {
  q: string;
  cat: string;
  section: string;
  tile_slug: string;
};

export type ProductSort = {
  sort: "price" | "likes" | "rating" | "new";
  dir: "asc" | "desc";
};

export type ProductPaging = {
  enabled: boolean;
  limit: number;
  offset: number;
};

export type ReviewPermission = {
  can_review: boolean;
  reason: string | null;
  already_reviewed: boolean;
  order_id?: number;
};

export type ReviewRow = {
  id: number;
  user_id: number;
  product_id: number;
  rating: number;
  comment: string | null;
  created_at: string;
  name?: string | null;
};

type QueryParts = {
  whereSql: string;
  params: Array<string | number>;
};

const ACTIVE_SELLER_JOIN = "LEFT JOIN users seller_user ON seller_user.id = p.owner_user_id";
const ACTIVE_SELLER_FILTER = "(p.owner_user_id IS NULL OR COALESCE(seller_user.is_seller, FALSE) = TRUE)";

function buildProductWhere(filters: ProductFilters): QueryParts {
  const where: string[] = [ACTIVE_SELLER_FILTER];
  const params: Array<string | number> = [];
  let idx = 1;

  if (filters.q) {
    where.push(`
      (
        p.title ILIKE $${idx}
        OR p.description ILIKE $${idx}
        OR p.category ILIKE $${idx}
      )
    `);
    params.push(`%${filters.q}%`);
    idx += 1;
  }

  if (filters.cat && filters.cat !== "Все") {
    where.push(`p.category = $${idx}`);
    params.push(filters.cat);
    idx += 1;
  }

  if (filters.section) {
    where.push(`LOWER(COALESCE(p.section, '')) = LOWER($${idx})`);
    params.push(filters.section);
    idx += 1;
  }

  if (filters.tile_slug) {
    where.push(`LOWER(COALESCE(p.tile_slug, '')) = LOWER($${idx})`);
    params.push(filters.tile_slug);
  }

  return {
    whereSql: where.length ? ` WHERE ${where.join(" AND ")}` : "",
    params,
  };
}

export function createProductsRepository(pool: Pool) {
  return {
    async countProducts(filters: ProductFilters) {
      const { whereSql, params } = buildProductWhere(filters);
      const result = await pool.query<{ total: number }>(
        `SELECT COUNT(*)::int AS total
         FROM products p
         ${ACTIVE_SELLER_JOIN}
         ${whereSql}`,
        params,
      );

      return Number(result.rows?.[0]?.total || 0);
    },

    async findProducts(filters: ProductFilters, sort: ProductSort, paging: ProductPaging) {
      const { whereSql, params } = buildProductWhere(filters);
      const finalParams = params.slice();
      let sql = `
        SELECT p.*
        FROM products p
        ${ACTIVE_SELLER_JOIN}
        ${whereSql}
      `;

      if (sort.sort === "price") {
        sql += ` ORDER BY p.price ${sort.dir === "asc" ? "ASC" : "DESC"}, p.id DESC`;
      } else {
        sql += " ORDER BY p.id DESC";
      }

      if (paging.enabled) {
        sql += ` LIMIT $${finalParams.length + 1} OFFSET $${finalParams.length + 2}`;
        finalParams.push(paging.limit, paging.offset);
      }

      const result = await pool.query<ProductRow>(sql, finalParams);
      return result.rows || [];
    },

    async findProductsForStatsSort(filters: ProductFilters) {
      const { whereSql, params } = buildProductWhere(filters);
      const result = await pool.query<ProductRow>(
        `SELECT p.*
         FROM products p
         ${ACTIVE_SELLER_JOIN}
         ${whereSql}
         ORDER BY p.id DESC`,
        params,
      );

      return result.rows || [];
    },

    async findProductById(id: number) {
      const result = await pool.query<ProductRow>(
        `SELECT p.*
         FROM products p
         ${ACTIVE_SELLER_JOIN}
         WHERE p.id = $1
           AND ${ACTIVE_SELLER_FILTER}`,
        [id],
      );
      return result.rows[0] || null;
    },

    async findFavorites(userId: number) {
      const result = await pool.query<ProductRow>(
        `SELECT p.*
         FROM products p
         JOIN product_likes l ON l.product_id = p.id
         ${ACTIVE_SELLER_JOIN}
         WHERE l.user_id = $1
           AND ${ACTIVE_SELLER_FILTER}
         ORDER BY p.id DESC`,
        [userId],
      );

      return result.rows || [];
    },

    async hasLike(productId: number, userId: number) {
      const result = await pool.query(
        `SELECT 1
         FROM product_likes
         WHERE user_id = $1 AND product_id = $2
         LIMIT 1`,
        [userId, productId],
      );

      return Boolean(result.rows.length);
    },

    async addLike(productId: number, userId: number) {
      await pool.query(
        `INSERT INTO product_likes (user_id, product_id)
         VALUES ($1, $2)
         ON CONFLICT (user_id, product_id) DO NOTHING`,
        [userId, productId],
      );
    },

    async removeLike(productId: number, userId: number) {
      await pool.query(
        `DELETE FROM product_likes
         WHERE user_id = $1 AND product_id = $2`,
        [userId, productId],
      );
    },

    async countLikes(productId: number) {
      const result = await pool.query<{ c: number }>(
        `SELECT COUNT(*)::int AS c
         FROM product_likes
         WHERE product_id = $1`,
        [productId],
      );

      return Number(result.rows[0]?.c || 0);
    },

    async setRating(productId: number, userId: number, rating: number) {
      await pool.query(
        `INSERT INTO product_ratings (user_id, product_id, rating, updated_at)
         VALUES ($1, $2, $3, NOW()::text)
         ON CONFLICT (user_id, product_id)
         DO UPDATE SET rating = EXCLUDED.rating, updated_at = NOW()::text`,
        [userId, productId, rating],
      );
    },

    async getRatingStats(productId: number) {
      const result = await pool.query<{ avg: number; cnt: number }>(
        `SELECT ROUND(AVG(rating), 2) AS avg,
                COUNT(*)::int AS cnt
         FROM product_ratings
         WHERE product_id = $1`,
        [productId],
      );

      return {
        rating_avg: Number(result.rows[0]?.avg || 0),
        rating_count: Number(result.rows[0]?.cnt || 0),
      };
    },

    async findReviews(productId: number) {
      const result = await pool.query<ReviewRow>(
        `SELECT r.*, u.name
           FROM reviews r
           LEFT JOIN users u ON u.id = r.user_id
          WHERE r.product_id = $1
          ORDER BY r.created_at DESC`,
        [productId],
      );

      return result.rows || [];
    },

    async hasReview(productId: number, userId: number) {
      const result = await pool.query<{ id: number }>(
        `SELECT id FROM reviews WHERE user_id = $1 AND product_id = $2 LIMIT 1`,
        [userId, productId],
      );

      return Boolean(result.rows.length);
    },

    async hasRating(productId: number, userId: number) {
      const result = await pool.query<{ product_id: number }>(
        `SELECT product_id FROM product_ratings WHERE user_id = $1 AND product_id = $2 LIMIT 1`,
        [userId, productId],
      );

      return Boolean(result.rows.length);
    },

    async findDeliveredOrderForReview(productId: number, userId: number) {
      const result = await pool.query<{ id: number }>(
        `SELECT o.id
           FROM orders o
           JOIN order_items oi ON oi.order_id = o.id
          WHERE o.user_id = $1
            AND oi.product_id = $2
            AND o.status = 'delivered'
          ORDER BY o.id DESC
          LIMIT 1`,
        [userId, productId],
      );

      return result.rows[0] || null;
    },

    async createReview(userId: number, productId: number, rating: number, comment: string) {
      const result = await pool.query<ReviewRow>(
        `INSERT INTO reviews (user_id, product_id, rating, comment)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [userId, productId, rating, comment],
      );

      return result.rows[0];
    },

    async removeRating(productId: number, userId: number) {
      await pool.query(
        `DELETE FROM product_ratings
         WHERE user_id = $1 AND product_id = $2`,
        [userId, productId],
      );
    },
  };
}
