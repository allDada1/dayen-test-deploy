import express from "express";
import type { NextFunction, Response } from "express";
import type { Pool } from "pg";

import type { AuthenticatedRequest } from "../../../types/app";
import { badRequest, conflict, dbError, notFound, ok, serverError } from "../../../utils/http";
import { parseOptionalString, parseRequiredString, parseSlug, toPositiveInt } from "../../../utils/validation";
import {
  createAdminCategoriesService,
  isUniqueError,
  parseActiveFlag,
  parseSortOrder,
} from "../services/admin-categories.service";
import { writeAdminAuditLog } from "../services/admin-audit.service";

type AuthMiddleware = (req: AuthenticatedRequest, res: Response, next: NextFunction) => unknown;

type AdminCategoriesRouterOptions = {
  pool: Pool;
  authRequired: AuthMiddleware;
  adminRequired: AuthMiddleware;
};

export function createAdminCategoriesRouter({
  pool,
  authRequired,
  adminRequired,
}: AdminCategoriesRouterOptions) {
  const router = express.Router();
  const categoriesService = createAdminCategoriesService(pool);

  router.get("/admin/categories", authRequired, adminRequired, async (_req, res) => {
    try {
      return ok(res, { items: await categoriesService.listCategories() });
    } catch (error) {
      console.error("GET /api/admin/categories error:", error);
      return serverError(res);
    }
  });

  router.get("/admin/categories/check-slug", authRequired, adminRequired, async (req, res) => {
    try {
      const slug = parseSlug(req.query.slug, { min: 1, max: 100 });
      const excludeIdRaw = req.query.exclude_id;
      const excludeId = excludeIdRaw === undefined || excludeIdRaw === "" ? -1 : toPositiveInt(excludeIdRaw);

      if (!slug) return badRequest(res, "missing_slug");
      if (excludeIdRaw !== undefined && excludeIdRaw !== "" && !excludeId) {
        return badRequest(res, "bad_exclude_id");
      }

      return ok(res, { available: await categoriesService.isSlugAvailable(slug, excludeId || -1) });
    } catch (error) {
      console.error("GET /api/admin/categories/check-slug error:", error);
      return serverError(res);
    }
  });

  router.post("/admin/categories", authRequired, adminRequired, async (req: AuthenticatedRequest, res) => {
    try {
      const section = parseRequiredString(req.body.section ?? "Игры", { min: 1, max: 120, normalize: true });
      const title = parseRequiredString(req.body.title, { min: 1, max: 160, normalize: true });
      const slug = parseSlug(req.body.slug, { min: 1, max: 100 });
      const iconUrl = parseOptionalString(req.body.icon_url, { max: 2000 });
      const emoji = parseOptionalString(req.body.emoji, { max: 32 }) ?? "";
      const sortOrder = parseSortOrder(req.body.sort_order, 0);
      const isActive = parseActiveFlag(req.body.is_active, 1);

      if (!section || !title || !slug) return badRequest(res, "missing_fields");
      if (iconUrl == null) return badRequest(res, "bad_icon_url");
      if (emoji == null) return badRequest(res, "bad_emoji");
      if (sortOrder == null) return badRequest(res, "bad_sort_order");

      const id = await categoriesService.createCategory({
        section,
        title,
        slug,
        iconUrl,
        emoji,
        sortOrder,
        isActive,
      });
      await writeAdminAuditLog(pool, {
        actor: req.user,
        action: "category.create",
        entityType: "category",
        entityId: id,
        summary: "Created catalog tile",
        metadata: { section, title, slug, sort_order: sortOrder, is_active: isActive },
      });

      return ok(res, { id });
    } catch (error) {
      console.error("POST /api/admin/categories error:", error);
      if (isUniqueError(error)) return conflict(res, "slug_taken");
      return dbError(res, error);
    }
  });

  router.patch("/admin/categories/:id", authRequired, adminRequired, async (req: AuthenticatedRequest, res) => {
    try {
      const id = toPositiveInt(req.params.id);
      if (!id) return badRequest(res, "bad_id");

      const payload: {
        section?: string;
        groupName?: string;
        title?: string;
        slug?: string;
        iconUrl?: string;
        emoji?: string;
        sortOrder?: number;
        isActive?: number;
      } = {};

      if (req.body.section !== undefined) {
        const section = parseRequiredString(req.body.section, { min: 1, max: 120, normalize: true });
        if (!section) return badRequest(res, "bad_section");
        payload.section = section;
      }

      if (req.body.icon_url !== undefined) {
        const iconUrl = parseOptionalString(req.body.icon_url, { max: 2000 });
        if (iconUrl == null) return badRequest(res, "bad_icon_url");
        payload.iconUrl = iconUrl;
      }

      if (req.body.group_name !== undefined) {
        const groupName = parseRequiredString(req.body.group_name, { min: 1, max: 120, normalize: true });
        if (!groupName) return badRequest(res, "bad_group_name");
        payload.groupName = groupName;
      }

      if (req.body.title !== undefined) {
        const title = parseRequiredString(req.body.title, { min: 1, max: 160, normalize: true });
        if (!title) return badRequest(res, "bad_title");
        payload.title = title;
      }

      if (req.body.slug !== undefined) {
        const slug = parseSlug(req.body.slug, { min: 1, max: 100 });
        if (!slug) return badRequest(res, "bad_slug");
        payload.slug = slug;
      }

      if (req.body.emoji !== undefined) {
        const emoji = parseOptionalString(req.body.emoji, { max: 32 });
        if (emoji == null) return badRequest(res, "bad_emoji");
        payload.emoji = emoji || "🎮";
      }

      if (req.body.sort_order !== undefined) {
        const sortOrder = parseSortOrder(req.body.sort_order);
        if (sortOrder == null) return badRequest(res, "bad_sort_order");
        payload.sortOrder = sortOrder;
      }

      if (req.body.is_active !== undefined) {
        payload.isActive = parseActiveFlag(req.body.is_active);
      }

      const result = await categoriesService.updateCategory(id, payload);

      if (result.empty) return badRequest(res, "no_fields");
      if (!result.updated) return notFound(res);
      await writeAdminAuditLog(pool, {
        actor: req.user,
        action: "category.update",
        entityType: "category",
        entityId: id,
        summary: "Updated catalog tile",
        metadata: payload,
      });
      return ok(res, { updated: 1 });
    } catch (error) {
      console.error("PATCH /api/admin/categories/:id error:", error);
      if (isUniqueError(error)) return conflict(res, "slug_taken");
      return serverError(res);
    }
  });

  router.post("/admin/categories/reorder", authRequired, adminRequired, async (req: AuthenticatedRequest, res) => {
    try {
      const orders = Array.isArray(req.body.orders) ? req.body.orders : [];
      if (!orders.length) return badRequest(res, "missing_orders");

      const clean: Array<{ id: number; sort_order: number }> = [];
      for (const item of orders) {
        const id = toPositiveInt(item?.id);
        const sortOrder = parseSortOrder(item?.sort_order);
        if (!id || sortOrder == null) continue;
        clean.push({ id, sort_order: sortOrder });
      }

      if (!clean.length) return badRequest(res, "bad_orders");

      await categoriesService.reorderCategories(clean);
      await writeAdminAuditLog(pool, {
        actor: req.user,
        action: "category.reorder",
        entityType: "category",
        summary: "Reordered catalog tiles",
        metadata: { orders: clean },
      });

      return ok(res, { updated: clean.length });
    } catch (error) {
      console.error("POST /api/admin/categories/reorder error:", error);
      return serverError(res);
    }
  });

  router.delete("/admin/categories/:id", authRequired, adminRequired, async (req: AuthenticatedRequest, res) => {
    try {
      const id = toPositiveInt(req.params.id);
      if (!id) return badRequest(res, "bad_id");

      const deleted = await categoriesService.deleteCategory(id);
      if (!deleted) return notFound(res);
      await writeAdminAuditLog(pool, {
        actor: req.user,
        action: "category.delete",
        entityType: "category",
        entityId: id,
        summary: "Deleted catalog tile",
      });
      return ok(res, { deleted: 1 });
    } catch (error) {
      console.error("DELETE /api/admin/categories/:id error:", error);
      return serverError(res);
    }
  });

  return router;
}
