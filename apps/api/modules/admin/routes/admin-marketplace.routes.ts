import express from "express";
import type { NextFunction, Response } from "express";
import type { Pool } from "pg";

import type { AuthenticatedRequest } from "../../../types/app";
import { badRequest, conflict, notFound, ok, serverError } from "../../../utils/http";
import { parseOptionalString, parseRequiredString, parseSlug, toPositiveInt } from "../../../utils/validation";
import { writeAdminAuditLog } from "../services/admin-audit.service";

type AuthMiddleware = (req: AuthenticatedRequest, res: Response, next: NextFunction) => unknown;

type AdminMarketplaceRouterOptions = {
  pool: Pool;
  authRequired: AuthMiddleware;
  adminRequired: AuthMiddleware;
};

function isUniqueError(error: unknown) {
  const msg = String((error as { message?: string })?.message || error).toLowerCase();
  return msg.includes("unique") || msg.includes("duplicate key");
}

function parsePageKey(value: unknown) {
  const pageKey = String(value || "").trim().toLowerCase();
  return /^[a-z0-9:_-]{2,120}$/.test(pageKey) ? pageKey : "";
}

export function createAdminMarketplaceRouter({ pool, authRequired, adminRequired }: AdminMarketplaceRouterOptions) {
  const router = express.Router();

  router.get("/admin/sections", authRequired, adminRequired, async (_req, res) => {
    try {
      const result = await pool.query(
        `SELECT id, title, slug, icon_url, emoji, sort_order, is_active
         FROM marketplace_sections
         ORDER BY sort_order ASC, id ASC`,
      );
      return ok(res, { items: result.rows || [] });
    } catch (error) {
      console.error("GET /api/admin/sections error:", error);
      return serverError(res);
    }
  });

  router.post("/admin/sections", authRequired, adminRequired, async (req: AuthenticatedRequest, res) => {
    try {
      const title = parseRequiredString(req.body.title, { min: 1, max: 120, normalize: true });
      const slug = parseSlug(req.body.slug, { min: 1, max: 100 });
      const iconUrl = parseOptionalString(req.body.icon_url, { max: 2000 });
      const emoji = parseOptionalString(req.body.emoji, { max: 32 });
      const sortOrder = Number(req.body.sort_order ?? 0);
      const isActive = req.body.is_active === undefined ? 1 : req.body.is_active ? 1 : 0;

      if (!title || !slug) return badRequest(res, "missing_fields");
      if (iconUrl == null || emoji == null || !Number.isFinite(sortOrder)) return badRequest(res, "bad_payload");

      const result = await pool.query<{ id: number }>(
        `INSERT INTO marketplace_sections (title, slug, icon_url, emoji, sort_order, is_active)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        [title, slug, iconUrl, emoji, Math.round(sortOrder), isActive],
      );
      await writeAdminAuditLog(pool, {
        actor: req.user,
        action: "section.create",
        entityType: "marketplace_section",
        entityId: result.rows[0].id,
        summary: "Created marketplace section",
        metadata: { title, slug, sort_order: Math.round(sortOrder), is_active: isActive },
      });

      return ok(res, { id: result.rows[0].id });
    } catch (error) {
      console.error("POST /api/admin/sections error:", error);
      if (isUniqueError(error)) return conflict(res, "slug_taken");
      return serverError(res);
    }
  });

  router.patch("/admin/sections/:id", authRequired, adminRequired, async (req: AuthenticatedRequest, res) => {
    try {
      const id = toPositiveInt(req.params.id);
      if (!id) return badRequest(res, "bad_id");

      const fields: string[] = [];
      const params: unknown[] = [];
      let idx = 1;

      if (req.body.title !== undefined) {
        const title = parseRequiredString(req.body.title, { min: 1, max: 120, normalize: true });
        if (!title) return badRequest(res, "bad_title");
        fields.push(`title = $${idx++}`);
        params.push(title);
      }

      if (req.body.slug !== undefined) {
        const slug = parseSlug(req.body.slug, { min: 1, max: 100 });
        if (!slug) return badRequest(res, "bad_slug");
        fields.push(`slug = $${idx++}`);
        params.push(slug);
      }

      if (req.body.icon_url !== undefined) {
        const iconUrl = parseOptionalString(req.body.icon_url, { max: 2000 });
        if (iconUrl == null) return badRequest(res, "bad_icon_url");
        fields.push(`icon_url = $${idx++}`);
        params.push(iconUrl);
      }

      if (req.body.emoji !== undefined) {
        const emoji = parseOptionalString(req.body.emoji, { max: 32 });
        if (emoji == null) return badRequest(res, "bad_emoji");
        fields.push(`emoji = $${idx++}`);
        params.push(emoji);
      }

      if (req.body.sort_order !== undefined) {
        const sortOrder = Number(req.body.sort_order);
        if (!Number.isFinite(sortOrder)) return badRequest(res, "bad_sort_order");
        fields.push(`sort_order = $${idx++}`);
        params.push(Math.round(sortOrder));
      }

      if (req.body.is_active !== undefined) {
        fields.push(`is_active = $${idx++}`);
        params.push(req.body.is_active ? 1 : 0);
      }

      if (!fields.length) return badRequest(res, "no_fields");

      params.push(id);
      const result = await pool.query(
        `UPDATE marketplace_sections SET ${fields.join(", ")} WHERE id = $${idx} RETURNING id`,
        params,
      );

      if (!result.rows.length) return notFound(res);
      await writeAdminAuditLog(pool, {
        actor: req.user,
        action: "section.update",
        entityType: "marketplace_section",
        entityId: id,
        summary: "Updated marketplace section",
        metadata: req.body || {},
      });
      return ok(res, { updated: 1 });
    } catch (error) {
      console.error("PATCH /api/admin/sections/:id error:", error);
      if (isUniqueError(error)) return conflict(res, "slug_taken");
      return serverError(res);
    }
  });

  router.delete("/admin/sections/:id", authRequired, adminRequired, async (req: AuthenticatedRequest, res) => {
    try {
      const id = toPositiveInt(req.params.id);
      if (!id) return badRequest(res, "bad_id");

      const result = await pool.query(`DELETE FROM marketplace_sections WHERE id = $1 RETURNING id`, [id]);
      if (!result.rows.length) return notFound(res);
      await writeAdminAuditLog(pool, {
        actor: req.user,
        action: "section.delete",
        entityType: "marketplace_section",
        entityId: id,
        summary: "Deleted marketplace section",
      });
      return ok(res, { deleted: 1 });
    } catch (error) {
      console.error("DELETE /api/admin/sections/:id error:", error);
      return serverError(res);
    }
  });

  router.get("/admin/home-banner", authRequired, adminRequired, async (_req, res) => {
    try {
      const result = await pool.query(
        `SELECT id, eyebrow, title, description, cta_label, cta_href, image_url, is_active, sort_order
         FROM home_hero_banners
         ORDER BY id ASC
         LIMIT 1`,
      );

      return ok(res, { banner: result.rows[0] || null });
    } catch (error) {
      console.error("GET /api/admin/home-banner error:", error);
      return serverError(res);
    }
  });

  router.put("/admin/home-banner", authRequired, adminRequired, async (req: AuthenticatedRequest, res) => {
    try {
      const eyebrow = parseOptionalString(req.body.eyebrow, { max: 120, normalize: true });
      const title = parseOptionalString(req.body.title, { max: 200, normalize: true });
      const description = parseOptionalString(req.body.description, { max: 500, normalize: true });
      const ctaLabel = parseOptionalString(req.body.cta_label, { max: 120, normalize: true });
      const ctaHref = parseOptionalString(req.body.cta_href, { max: 500, normalize: true });
      const imageUrl = parseOptionalString(req.body.image_url, { max: 2000 });
      const sortOrder = Number(req.body.sort_order ?? 0);
      const isActive = req.body.is_active ? 1 : 0;

      if ([eyebrow, title, description, ctaLabel, ctaHref, imageUrl].some((value) => value == null) || !Number.isFinite(sortOrder)) {
        return badRequest(res, "bad_payload");
      }

      const current = await pool.query(`SELECT id FROM home_hero_banners ORDER BY id ASC LIMIT 1`);
      if (current.rows.length) {
        await pool.query(
          `UPDATE home_hero_banners
           SET eyebrow = $1, title = $2, description = $3, cta_label = $4, cta_href = $5, image_url = $6, is_active = $7, sort_order = $8
           WHERE id = $9`,
          [eyebrow, title, description, ctaLabel, ctaHref || "/catalog", imageUrl, isActive, Math.round(sortOrder), current.rows[0].id],
        );
      } else {
        await pool.query(
          `INSERT INTO home_hero_banners (eyebrow, title, description, cta_label, cta_href, image_url, is_active, sort_order)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [eyebrow, title, description, ctaLabel, ctaHref || "/catalog", imageUrl, isActive, Math.round(sortOrder)],
        );
      }
      await writeAdminAuditLog(pool, {
        actor: req.user,
        action: "banner.update",
        entityType: "home_banner",
        entityId: "home",
        summary: "Updated home banner",
        metadata: { title, cta_href: ctaHref, is_active: isActive },
      });

      return ok(res, { updated: 1 });
    } catch (error) {
      console.error("PUT /api/admin/home-banner error:", error);
      return serverError(res);
    }
  });

  router.get("/admin/page-banners/:pageKey", authRequired, adminRequired, async (req, res) => {
    try {
      const pageKey = parsePageKey(req.params.pageKey);
      if (!pageKey) return badRequest(res, "bad_page_key");

      const result = await pool.query(
        `SELECT id, page_key, eyebrow, title, description, cta_label, cta_href, image_url, is_active, sort_order
         FROM page_banners
         WHERE page_key = $1
         ORDER BY id ASC
         LIMIT 1`,
        [pageKey],
      );

      return ok(res, { banner: result.rows[0] || null });
    } catch (error) {
      console.error("GET /api/admin/page-banners/:pageKey error:", error);
      return serverError(res);
    }
  });

  router.put("/admin/page-banners/:pageKey", authRequired, adminRequired, async (req: AuthenticatedRequest, res) => {
    try {
      const pageKey = parsePageKey(req.params.pageKey);
      if (!pageKey) return badRequest(res, "bad_page_key");

      const eyebrow = parseOptionalString(req.body.eyebrow, { max: 120, normalize: true });
      const title = parseOptionalString(req.body.title, { max: 200, normalize: true });
      const description = parseOptionalString(req.body.description, { max: 500, normalize: true });
      const ctaLabel = parseOptionalString(req.body.cta_label, { max: 120, normalize: true });
      const ctaHref = parseOptionalString(req.body.cta_href, { max: 500, normalize: true });
      const imageUrl = parseOptionalString(req.body.image_url, { max: 2000 });
      const sortOrder = Number(req.body.sort_order ?? 0);
      const isActive = req.body.is_active ? 1 : 0;

      if ([eyebrow, title, description, ctaLabel, ctaHref, imageUrl].some((value) => value == null) || !Number.isFinite(sortOrder)) {
        return badRequest(res, "bad_payload");
      }

      await pool.query(
        `INSERT INTO page_banners (page_key, eyebrow, title, description, cta_label, cta_href, image_url, is_active, sort_order, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
         ON CONFLICT (page_key)
         DO UPDATE SET
           eyebrow = EXCLUDED.eyebrow,
           title = EXCLUDED.title,
           description = EXCLUDED.description,
           cta_label = EXCLUDED.cta_label,
           cta_href = EXCLUDED.cta_href,
           image_url = EXCLUDED.image_url,
           is_active = EXCLUDED.is_active,
           sort_order = EXCLUDED.sort_order,
           updated_at = NOW()`,
        [pageKey, eyebrow, title, description, ctaLabel, ctaHref, imageUrl, isActive, Math.round(sortOrder)],
      );
      await writeAdminAuditLog(pool, {
        actor: req.user,
        action: "banner.update",
        entityType: "page_banner",
        entityId: pageKey,
        summary: "Updated page banner",
        metadata: { page_key: pageKey, title, cta_href: ctaHref, is_active: isActive },
      });

      return ok(res, { updated: 1 });
    } catch (error) {
      console.error("PUT /api/admin/page-banners/:pageKey error:", error);
      return serverError(res);
    }
  });

  return router;
}
