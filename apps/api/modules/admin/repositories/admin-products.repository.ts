import type { Pool } from "pg";

export type AdminProductInput = {
  title: string;
  description: string;
  category: string;
  price: number;
  stock: number;
  imageUrl: string;
  tileSlug: string;
  section: string;
  specsJson: string;
};

export type AdminProductCreateInput = AdminProductInput & {
  ownerUserId: number | undefined;
};

export function createAdminProductsRepository(pool: Pool) {
  return {
    async createProduct(input: AdminProductCreateInput) {
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
          input.imageUrl,
          input.tileSlug,
          input.section,
          input.ownerUserId,
          input.specsJson,
        ],
      );

      return result.rows[0].id;
    },

    async updateProduct(productId: number, input: AdminProductInput) {
      const result = await pool.query<{ id: number }>(
        `UPDATE products
         SET title = $1,
             description = $2,
             category = $3,
             price = $4,
             stock = $5,
             image_url = $6,
             tile_slug = $7,
             section = $8,
             specs_json = $9
         WHERE id = $10
         RETURNING id`,
        [
          input.title,
          input.description,
          input.category,
          input.price,
          input.stock,
          input.imageUrl,
          input.tileSlug,
          input.section,
          input.specsJson,
          productId,
        ],
      );

      return result.rows.length > 0;
    },

    async deleteProduct(productId: number) {
      const result = await pool.query<{ id: number }>(
        `DELETE FROM products
         WHERE id = $1
         RETURNING id`,
        [productId],
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

    async notifySellerFollowers(sellerUserId: number | undefined, title: string, body: string, link: string) {
      await pool.query(
        `INSERT INTO notifications (user_id, title, body, link)
         SELECT follower_user_id, $2, $3, $4
         FROM seller_follows
         WHERE seller_user_id = $1`,
        [sellerUserId, title, body, link],
      );
    },
  };
}
