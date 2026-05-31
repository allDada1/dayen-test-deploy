import type { Pool } from "pg";

export function createAdminToolsRepository(pool: Pool) {
  return {
    async fixTileSlugs() {
      await pool.query(`
        UPDATE products p
        SET category = c.title
        FROM categories c
        WHERE c.slug = p.tile_slug
      `);
    },
  };
}
