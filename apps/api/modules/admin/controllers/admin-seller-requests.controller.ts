import express from "express";
import type { NextFunction, Response } from "express";
import type { Pool } from "pg";

import type { AuthenticatedRequest } from "../../../types/app";
import { badRequest, dbError, notFound, ok } from "../../../utils/http";
import { toPositiveInt } from "../../../utils/validation";
import { createAdminSellerRequestsService } from "../services/admin-seller-requests.service";
import { writeAdminAuditLog } from "../services/admin-audit.service";

type AuthMiddleware = (req: AuthenticatedRequest, res: Response, next: NextFunction) => unknown;

type AdminSellerRequestsRouterOptions = {
  pool: Pool;
  authRequired: AuthMiddleware;
  adminRequired: AuthMiddleware;
};

function parseRequestId(value: unknown) {
  const id = toPositiveInt(value);
  return id || null;
}

export function createAdminSellerRequestsRouter({
  pool,
  authRequired,
  adminRequired,
}: AdminSellerRequestsRouterOptions) {
  const router = express.Router();
  const sellerRequestsService = createAdminSellerRequestsService(pool);

  router.get("/admin/seller-requests", authRequired, adminRequired, async (_req, res) => {
    try {
      const items = await sellerRequestsService.listRequests();
      return ok(res, { items, requests: items });
    } catch (error) {
      console.error("GET seller-requests:", error);
      return dbError(res, error);
    }
  });

  router.post("/admin/seller-requests/:id/approve", authRequired, adminRequired, async (req: AuthenticatedRequest, res) => {
    const id = parseRequestId(req.params.id);
    if (!id) return badRequest(res, "bad_id");

    try {
      const approved = await sellerRequestsService.approveRequest(id);
      if (!approved) return notFound(res, "not_pending");
      await writeAdminAuditLog(pool, {
        actor: req.user,
        action: "seller_request.approve",
        entityType: "seller_request",
        entityId: id,
        summary: "Approved seller request",
      });

      return ok(res);
    } catch (error) {
      console.error("APPROVE seller:", error);
      return dbError(res, error);
    }
  });

  router.post("/admin/seller-requests/:id/reject", authRequired, adminRequired, async (req: AuthenticatedRequest, res) => {
    const id = parseRequestId(req.params.id);
    if (!id) return badRequest(res, "bad_id");

    try {
      const adminComment = String(req.body?.admin_comment || "").trim();
      const rejected = await sellerRequestsService.rejectRequest(id, adminComment);
      if (!rejected) return notFound(res, "not_pending");
      await writeAdminAuditLog(pool, {
        actor: req.user,
        action: "seller_request.reject",
        entityType: "seller_request",
        entityId: id,
        summary: "Rejected seller request",
        metadata: { admin_comment: adminComment },
      });

      return ok(res);
    } catch (error) {
      console.error("REJECT seller:", error);
      return dbError(res, error);
    }
  });

  router.post("/admin/seller-requests/:id/revoke", authRequired, adminRequired, async (req: AuthenticatedRequest, res) => {
    const id = parseRequestId(req.params.id);
    if (!id) return badRequest(res, "bad_id");

    try {
      const adminComment = String(req.body?.admin_comment || "").trim();
      const revoked = await sellerRequestsService.revokeRequest(id, adminComment);
      if (!revoked) return notFound(res, "not_found");
      await writeAdminAuditLog(pool, {
        actor: req.user,
        action: "seller_request.revoke",
        entityType: "seller_request",
        entityId: id,
        summary: "Revoked seller access",
        metadata: { admin_comment: adminComment },
      });

      return ok(res);
    } catch (error) {
      console.error("REVOKE seller:", error);
      return dbError(res, error);
    }
  });

  router.post("/admin/seller-requests/:id/restore", authRequired, adminRequired, async (req: AuthenticatedRequest, res) => {
    const id = parseRequestId(req.params.id);
    if (!id) return badRequest(res, "bad_id");

    try {
      const adminComment = String(req.body?.admin_comment || "").trim();
      const restored = await sellerRequestsService.restoreRequest(id, adminComment);
      if (!restored) return notFound(res, "not_found");
      await writeAdminAuditLog(pool, {
        actor: req.user,
        action: "seller_request.restore",
        entityType: "seller_request",
        entityId: id,
        summary: "Restored seller access",
        metadata: { admin_comment: adminComment },
      });

      return ok(res);
    } catch (error) {
      console.error("RESTORE seller:", error);
      return dbError(res, error);
    }
  });

  return router;
}
