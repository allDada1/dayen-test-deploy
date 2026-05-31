import express from "express";
import type { NextFunction, Response } from "express";
import type { Pool } from "pg";

import type { AuthenticatedRequest } from "../../../types/app";
import { badRequest, dbError, forbidden, notFound, ok } from "../../../utils/http";
import {
  AdminUsersServiceError,
  createAdminUsersService,
} from "../services/admin-users.service";

type AuthMiddleware = (req: AuthenticatedRequest, res: Response, next: NextFunction) => unknown;

type AdminUsersRouterOptions = {
  pool: Pool;
  authRequired: AuthMiddleware;
  adminRequired: AuthMiddleware;
};

function toId(value: unknown) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function handleServiceError(res: Response, error: unknown) {
  if (error instanceof AdminUsersServiceError) {
    if (error.code === "user_not_found") return notFound(res, error.code);
    if (
      error.code === "owner_only" ||
      error.code === "two_factor_setup_required" ||
      error.code === "cannot_moderate_self" ||
      error.code === "cannot_moderate_owner" ||
      error.code === "cannot_moderate_admin"
    ) {
      return forbidden(res, error.code);
    }
    return badRequest(res, error.code);
  }

  console.error("admin users error:", error);
  return dbError(res, error);
}

export function createAdminUsersController({
  pool,
  authRequired,
  adminRequired,
}: AdminUsersRouterOptions) {
  const router = express.Router();
  const service = createAdminUsersService(pool);

  router.get("/admin/users", authRequired, adminRequired, async (req, res) => {
    try {
      const result = await service.listUsers(req.query);
      return ok(res, result);
    } catch (error) {
      return handleServiceError(res, error);
    }
  });

  router.get("/admin/users/:id", authRequired, adminRequired, async (req, res) => {
    const id = toId(req.params.id);
    if (!id) return badRequest(res, "bad_user_id");

    try {
      const result = await service.getUser(id);
      return ok(res, result);
    } catch (error) {
      return handleServiceError(res, error);
    }
  });

  router.post("/admin/users/:id/warn", authRequired, adminRequired, async (req: AuthenticatedRequest, res) => {
    const id = toId(req.params.id);
    if (!id) return badRequest(res, "bad_user_id");
    if (!req.user) return forbidden(res);

    try {
      const user = await service.warnUser(req.user, id, req.body?.reason);
      return ok(res, { user });
    } catch (error) {
      return handleServiceError(res, error);
    }
  });

  router.post("/admin/users/:id/ban", authRequired, adminRequired, async (req: AuthenticatedRequest, res) => {
    const id = toId(req.params.id);
    if (!id) return badRequest(res, "bad_user_id");
    if (!req.user) return forbidden(res);

    try {
      const user = await service.banUser(req.user, id, {
        reason: req.body?.reason,
        banned_until: req.body?.banned_until,
      });
      return ok(res, { user });
    } catch (error) {
      return handleServiceError(res, error);
    }
  });

  router.post("/admin/users/:id/unban", authRequired, adminRequired, async (req: AuthenticatedRequest, res) => {
    const id = toId(req.params.id);
    if (!id) return badRequest(res, "bad_user_id");
    if (!req.user) return forbidden(res);

    try {
      const user = await service.unbanUser(req.user, id, req.body?.reason);
      return ok(res, { user });
    } catch (error) {
      return handleServiceError(res, error);
    }
  });

  router.patch("/admin/users/:id/profile", authRequired, adminRequired, async (req: AuthenticatedRequest, res) => {
    const id = toId(req.params.id);
    if (!id) return badRequest(res, "bad_user_id");
    if (!req.user) return forbidden(res);

    try {
      const user = await service.updateUserProfile(req.user, id, {
        name: req.body?.name,
        nickname: req.body?.nickname,
        avatar_url: req.body?.avatar_url,
        reason: req.body?.reason,
      });
      return ok(res, { user });
    } catch (error) {
      return handleServiceError(res, error);
    }
  });

  router.post("/admin/users/:id/grant-admin", authRequired, adminRequired, async (req: AuthenticatedRequest, res) => {
    const id = toId(req.params.id);
    if (!id) return badRequest(res, "bad_user_id");
    if (!req.user) return forbidden(res);

    try {
      const user = await service.setAdminRole(req.user, id, true, req.body?.reason);
      return ok(res, { user });
    } catch (error) {
      return handleServiceError(res, error);
    }
  });

  router.post("/admin/users/:id/revoke-admin", authRequired, adminRequired, async (req: AuthenticatedRequest, res) => {
    const id = toId(req.params.id);
    if (!id) return badRequest(res, "bad_user_id");
    if (!req.user) return forbidden(res);

    try {
      const user = await service.setAdminRole(req.user, id, false, req.body?.reason);
      return ok(res, { user });
    } catch (error) {
      return handleServiceError(res, error);
    }
  });

  router.get("/admin/audit-logs", authRequired, adminRequired, async (req, res) => {
    const targetUserId = req.query.target_user_id ? toId(req.query.target_user_id) : undefined;
    if (req.query.target_user_id && !targetUserId) return badRequest(res, "bad_user_id");

    try {
      const items = await service.listAuditLogs(targetUserId);
      return ok(res, { items });
    } catch (error) {
      return handleServiceError(res, error);
    }
  });

  router.get("/admin/action-logs", authRequired, adminRequired, async (req: AuthenticatedRequest, res) => {
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    if (!req.user) return forbidden(res);

    try {
      const items = await service.listActionLogs(req.user, limit);
      return ok(res, { items });
    } catch (error) {
      return handleServiceError(res, error);
    }
  });

  return router;
}
