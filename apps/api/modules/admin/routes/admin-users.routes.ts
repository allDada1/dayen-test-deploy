import type { NextFunction, Response } from "express";
import type { Pool } from "pg";

import type { AuthenticatedRequest } from "../../../types/app";
import { createAdminUsersController } from "../controllers/admin-users.controller";

type AuthMiddleware = (req: AuthenticatedRequest, res: Response, next: NextFunction) => unknown;

type AdminUsersRouterOptions = {
  pool: Pool;
  authRequired: AuthMiddleware;
  adminRequired: AuthMiddleware;
};

export function createAdminUsersRouter(options: AdminUsersRouterOptions) {
  return createAdminUsersController(options);
}
