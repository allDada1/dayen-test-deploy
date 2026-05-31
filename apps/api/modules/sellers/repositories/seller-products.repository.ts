import type { Pool } from "pg";

export type SellerProductRow = Record<string, any>;

export type SellerProductListFilters = {
  q: string;
  tile: string;
  sort: "new" | "old" | "price_asc" | "price_desc" | "stock_asc" | "stock_desc";
  limit: number;
  offset: number;
};

export type SellerProductInput = {
  title: string;
  description: string;
  category: string;
  tileSlug: string;
  price: number;
  stock: number;
  coverImage: string;
  specsJson: string;
};

export type SellerAccessRow = {
  status: string | null;
  admin_comment: string | null;
  reviewed_at: string | null;
};

function buildSellerProductWhere(ownerUserId: number, filters: Pick<SellerProductListFilters, "q" | "tile">) {
  const where = ["owner_user_id = $1"];
  const params: Array<string | number> = [ownerUserId];
  let idx = 2;

  if (filters.q) {
    where.push(`(
      title ILIKE $${idx}
      OR description ILIKE $${idx}
      OR category ILIKE $${idx}
      OR tile_slug ILIKE $${idx}
    )`);
    params.push(`%${filters.q}%`);
    idx += 1;
  }

  if (filters.tile) {
    where.push(`tile_slug = $${idx}`);
    params.push(filters.tile);
  }

  return {
    whereSql: `WHERE ${where.join(" AND ")}`,
    params,
  };
}

function getSellerProductOrder(sort: SellerProductListFilters["sort"]) {
  if (sort === "old") return "ORDER BY id ASC";
  if (sort === "price_asc") return "ORDER BY price ASC, id DESC";
  if (sort === "price_desc") return "ORDER BY price DESC, id DESC";
  if (sort === "stock_asc") return "ORDER BY stock ASC, id DESC";
  if (sort === "stock_desc") return "ORDER BY stock DESC, id DESC";
  return "ORDER BY id DESC";
}

export function createSellerProductsRepository(pool: Pool) {
  return {
    async getSellerAccess(userId: number) {
      const result = await pool.query<SellerAccessRow>(
        `SELECT status,
                COALESCE(admin_comment, '') AS admin_comment,
                reviewed_at
         FROM seller_requests
         WHERE user_id = $1
         ORDER BY reviewed_at DESC NULLS LAST, id DESC
         LIMIT 1`,
        [userId],
      );

      return result.rows[0] || null;
    },

    async listProducts(ownerUserId: number, filters: SellerProductListFilters) {
      const { whereSql, params } = buildSellerProductWhere(ownerUserId, filters);
      const finalParams = params.slice();
      finalParams.push(filters.limit, filters.offset);

      const result = await pool.query<SellerProductRow>(
        `SELECT *
         FROM products
         ${whereSql}
         ${getSellerProductOrder(filters.sort)}
         LIMIT $${params.length + 1}
         OFFSET $${params.length + 2}`,
        finalParams,
      );

      return result.rows || [];
    },

    async countProducts(ownerUserId: number, filters: Pick<SellerProductListFilters, "q" | "tile">) {
      const { whereSql, params } = buildSellerProductWhere(ownerUserId, filters);
      const result = await pool.query<{ total: number }>(
        `SELECT COUNT(*)::int AS total
         FROM products
         ${whereSql}`,
        params,
      );

      return Number(result.rows[0]?.total || 0);
    },

    async listTiles(ownerUserId: number) {
      const result = await pool.query<{ tile_slug: string; category: string }>(
        `SELECT DISTINCT
           COALESCE(tile_slug, '') AS tile_slug,
           COALESCE(category, '') AS category
         FROM products
         WHERE owner_user_id = $1
         ORDER BY category ASC, tile_slug ASC`,
        [ownerUserId],
      );

      return result.rows || [];
    },

    async createProduct(ownerUserId: number, input: SellerProductInput) {
      const result = await pool.query<{ id: number }>(
        `INSERT INTO products
           (title, description, price, stock, category, image_url, tile_slug, section, owner_user_id, specs_json)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING id`,
        [
          input.title,
          input.description,
          input.price,
          input.stock,
          input.category,
          input.coverImage,
          input.tileSlug,
          "Игры",
          ownerUserId,
          input.specsJson,
        ],
      );

      return result.rows[0].id;
    },

    async updateProduct(ownerUserId: number, productId: number, input: SellerProductInput) {
      const result = await pool.query<{ id: number }>(
        `UPDATE products
         SET title = $1,
             description = $2,
             category = $3,
             price = $4,
             stock = $5,
             image_url = $6,
             tile_slug = $7,
             specs_json = COALESCE($8, specs_json)
         WHERE id = $9
           AND owner_user_id = $10
         RETURNING id`,
        [
          input.title,
          input.description,
          input.category,
          input.price,
          input.stock,
          input.coverImage,
          input.tileSlug,
          input.specsJson,
          productId,
          ownerUserId,
        ],
      );

      return result.rows.length > 0;
    },

    async deleteProductImages(productId: number) {
      await pool.query(
        `DELETE FROM product_images
         WHERE product_id = $1`,
        [productId],
      );
    },

    async deleteProduct(ownerUserId: number, productId: number) {
      const result = await pool.query<{ id: number }>(
        `DELETE FROM products
         WHERE id = $1
           AND owner_user_id = $2
         RETURNING id`,
        [productId, ownerUserId],
      );

      return result.rows.length > 0;
    },
  };
}
