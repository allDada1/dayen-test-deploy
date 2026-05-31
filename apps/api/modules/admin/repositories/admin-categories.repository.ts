import type { Pool } from "pg";

export type CategoryCreateInput = {
  section: string;
  title: string;
  slug: string;
  iconUrl: string;
  emoji: string;
  sortOrder: number;
  isActive: number;
};

export type CategoryUpdateInput = {
  section?: string;
  groupName?: string;
  title?: string;
  slug?: string;
  iconUrl?: string;
  emoji?: string;
  sortOrder?: number;
  isActive?: number;
};

export type CategoryOrderInput = {
  id: number;
  sort_order: number;
};

export function createAdminCategoriesRepository(pool: Pool) {
  return {
    async listCategories() {
      const result = await pool.query(
        `SELECT id, group_name, section, title, slug, icon_url, emoji, sort_order, is_active
         FROM categories
         ORDER BY section ASC, sort_order ASC, id ASC`,
      );

      return result.rows || [];
    },

    async isSlugAvailable(slug: string, excludeId: number) {
      const result = await pool.query<{ id: number }>(
        `SELECT id
         FROM categories
         WHERE slug = $1 AND id <> $2
         LIMIT 1`,
        [slug, excludeId || -1],
      );

      return result.rows.length === 0;
    },

    async createCategory(input: CategoryCreateInput) {
      const result = await pool.query<{ id: number }>(
        `INSERT INTO categories
         (group_name, section, title, slug, icon_url, emoji, sort_order, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id`,
        [
          input.section,
          input.section,
          input.title,
          input.slug,
          input.iconUrl,
          input.emoji,
          input.sortOrder,
          input.isActive,
        ],
      );

      return result.rows[0].id;
    },

    async updateCategory(id: number, input: CategoryUpdateInput) {
      const fields: string[] = [];
      const params: unknown[] = [];
      let idx = 1;

      if (input.section !== undefined) {
        fields.push(`section = $${idx++}`);
        params.push(input.section);

        if (input.groupName === undefined) {
          fields.push(`group_name = $${idx++}`);
          params.push(input.section);
        }
      }

      if (input.iconUrl !== undefined) {
        fields.push(`icon_url = $${idx++}`);
        params.push(input.iconUrl);
      }

      if (input.groupName !== undefined) {
        fields.push(`group_name = $${idx++}`);
        params.push(input.groupName);
      }

      if (input.title !== undefined) {
        fields.push(`title = $${idx++}`);
        params.push(input.title);
      }

      if (input.slug !== undefined) {
        fields.push(`slug = $${idx++}`);
        params.push(input.slug);
      }

      if (input.emoji !== undefined) {
        fields.push(`emoji = $${idx++}`);
        params.push(input.emoji || "🎮");
      }

      if (input.sortOrder !== undefined) {
        fields.push(`sort_order = $${idx++}`);
        params.push(input.sortOrder);
      }

      if (input.isActive !== undefined) {
        fields.push(`is_active = $${idx++}`);
        params.push(input.isActive);
      }

      if (!fields.length) return { updated: false, empty: true };

      params.push(id);
      const result = await pool.query<{ id: number }>(
        `UPDATE categories
         SET ${fields.join(", ")}
         WHERE id = $${idx}
         RETURNING id`,
        params,
      );

      return { updated: result.rows.length > 0, empty: false };
    },

    async reorderCategories(orders: CategoryOrderInput[]) {
      const valuesSql = orders.map((_, i) => `($${i * 2 + 1}, $${i * 2 + 2})`).join(", ");
      const params = orders.flatMap((item) => [item.id, item.sort_order]);

      await pool.query(
        `UPDATE categories AS c
         SET sort_order = v.sort_order
         FROM (VALUES ${valuesSql}) AS v(id, sort_order)
         WHERE c.id = v.id`,
        params,
      );

      return orders.length;
    },

    async deleteCategory(id: number) {
      const result = await pool.query<{ id: number }>(
        `DELETE FROM categories WHERE id = $1 RETURNING id`,
        [id],
      );

      return result.rows.length > 0;
    },
  };
}
