import type { Pool } from "pg";

import { createAdminToolsRepository } from "../repositories/admin-tools.repository";

export function createAdminToolsService(pool: Pool) {
  const repository = createAdminToolsRepository(pool);

  return {
    fixTileSlugs: repository.fixTileSlugs,
  };
}
