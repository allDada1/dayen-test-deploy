import express from "express";
import type { NextFunction, Response } from "express";
import type { Pool } from "pg";

import type { AuthenticatedRequest } from "../../../types/app";
import { dbError, ok } from "../../../utils/http";
import { createAdminToolsService } from "../services/admin-tools.service";

type AuthMiddleware = (req: AuthenticatedRequest, res: Response, next: NextFunction) => unknown;

type AdminToolsRouterOptions = {
  pool: Pool;
  authRequired: AuthMiddleware;
  adminRequired: AuthMiddleware;
};

export function createAdminToolsRouter({ pool, authRequired, adminRequired }: AdminToolsRouterOptions) {
  const router = express.Router();
  const adminToolsService = createAdminToolsService(pool);

  router.post("/admin/fix-tile-slugs", authRequired, adminRequired, async (_req, res) => {
    try {
      await adminToolsService.fixTileSlugs();

      return ok(res);
    } catch (error) {
      console.error("fix-tile-slugs error:", error);
      return dbError(res, error);
    }
  });

  return router;
}
