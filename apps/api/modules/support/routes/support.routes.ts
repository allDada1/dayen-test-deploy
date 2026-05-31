import express from "express";
import type { Pool } from "pg";

import { supportTicketRateLimit } from "../../../middleware/rate-limit";
import type { AuthenticatedRequest } from "../../../types/app";
import { badRequest, created, ok, serverError } from "../../../utils/http";
import { parseEmail, parseEnum, parseOptionalString, parseRequiredString, toPositiveInt } from "../../../utils/validation";
import { writeAdminAuditLog } from "../../admin/services/admin-audit.service";

type AuthMiddleware = (req: AuthenticatedRequest, res: express.Response, next: express.NextFunction) => unknown;

type SupportRouterOptions = {
  pool: Pool;
  optionalAuth: AuthMiddleware;
  authRequired: AuthMiddleware;
  adminRequired: AuthMiddleware;
};

const ticketCategories = ["site", "order", "payment", "seller", "account", "other"];
const ticketStatuses = ["new", "in_review", "resolved", "closed"];
const ticketPriorities = ["normal", "high"];
const MAX_TICKET_IMAGES = 5;
const SUPPORT_UPLOAD_URL_PATTERN = /^\/uploads\/support\/[A-Za-z0-9][A-Za-z0-9._-]{0,240}$/;

export function isSafeSupportImageUrl(value: unknown) {
  const url = String(value || "").trim();
  if (!url) return true;
  return SUPPORT_UPLOAD_URL_PATTERN.test(url);
}

function parseImageUrls(value: unknown) {
  if (value == null) return [];
  if (!Array.isArray(value)) return null;

  const urls = value.map((item) => String(item || "").trim()).filter(Boolean);
  if (urls.length > MAX_TICKET_IMAGES) return null;
  if (urls.some((url) => url.length > 1000)) return null;
  if (urls.some((url) => !isSafeSupportImageUrl(url))) return null;

  return urls;
}

export async function ensureSupportTicketsTable(pool: Pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS support_tickets (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      email TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'site',
      page_url TEXT NOT NULL DEFAULT '',
      image_url TEXT NOT NULL DEFAULT '',
      image_urls_json TEXT NOT NULL DEFAULT '[]',
      message TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'new',
      priority TEXT NOT NULL DEFAULT 'normal',
      admin_note TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      resolved_at TIMESTAMPTZ
    )
  `);
  await pool.query(`ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS image_url TEXT NOT NULL DEFAULT ''`);
  await pool.query(`ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS image_urls_json TEXT NOT NULL DEFAULT '[]'`);
}

async function notifyAdminsAboutSupportTicket(pool: Pool, ticketId: number, category: string, email: string) {
  try {
    await pool.query(
      `INSERT INTO notifications (user_id, title, body, link)
       SELECT id, $1, $2, $3
       FROM users
       WHERE is_admin = TRUE OR COALESCE(is_owner, false) = TRUE`,
      [
        `Новый тикет поддержки #${ticketId}`,
        `Тип: ${category}. Отправитель: ${email}.`,
        `/admin/support?status=new&ticket=${ticketId}`,
      ],
    );
  } catch (error) {
    console.error("create support ticket admin notification failed", error);
  }
}

export function createSupportRouter({ pool, optionalAuth, authRequired, adminRequired }: SupportRouterOptions) {
  const router = express.Router();

  router.post("/support/tickets", optionalAuth, supportTicketRateLimit, async (req: AuthenticatedRequest, res) => {
    const email = parseEmail(req.body?.email || req.user?.email);
    const category = parseEnum(req.body?.category, ticketCategories, "site");
    const pageUrl = parseOptionalString(req.body?.page_url, { max: 500, normalize: true });
    const imageUrl = parseOptionalString(req.body?.image_url, { max: 1000, normalize: true });
    const imageUrls = parseImageUrls(req.body?.image_urls);
    const message = parseRequiredString(req.body?.message, { min: 10, max: 3000, normalize: true });

    if (!email) return badRequest(res, "bad_email");
    if (!category) return badRequest(res, "bad_support_category");
    if (pageUrl === null) return badRequest(res, "bad_support_page");
    if (imageUrl === null) return badRequest(res, "bad_support_image");
    if (!isSafeSupportImageUrl(imageUrl)) return badRequest(res, "bad_support_image");
    if (imageUrls === null) return badRequest(res, "bad_support_image");
    if (!message) return badRequest(res, "bad_support_message");

    try {
      const allImageUrls = imageUrls.length ? imageUrls : imageUrl ? [imageUrl] : [];
      await ensureSupportTicketsTable(pool);
      const result = await pool.query(
        `INSERT INTO support_tickets (user_id, email, category, page_url, image_url, image_urls_json, message)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, status, created_at`,
        [req.user?.id || null, email, category, pageUrl, allImageUrls[0] || "", JSON.stringify(allImageUrls), message],
      );
      const ticket = result.rows[0];

      await notifyAdminsAboutSupportTicket(pool, Number(ticket.id), category, email);

      return created(res, {
        ticket,
        message: "Обращение принято. Мы сохранили его в поддержке.",
      });
    } catch (error) {
      console.error("POST /api/support/tickets error:", error);
      return serverError(res);
    }
  });

  router.get("/admin/support-tickets", authRequired, adminRequired, async (req, res) => {
    const status = parseEnum(req.query?.status, ["all", ...ticketStatuses], "all");
    const category = parseEnum(req.query?.category, ["all", ...ticketCategories], "all");
    const priority = parseEnum(req.query?.priority, ["all", ...ticketPriorities], "all");
    const query = parseOptionalString(req.query?.q, { max: 200, normalize: true });
    const page = toPositiveInt(req.query?.page) || 1;
    const limit = Math.min(toPositiveInt(req.query?.limit) || 25, 100);
    const offset = (page - 1) * limit;

    if (query === null) return badRequest(res, "bad_support_query");

    const where: string[] = [];
    const params: unknown[] = [];

    if (status !== "all") {
      params.push(status);
      where.push(`st.status = $${params.length}`);
    }

    if (category !== "all") {
      params.push(category);
      where.push(`st.category = $${params.length}`);
    }

    if (priority !== "all") {
      params.push(priority);
      where.push(`st.priority = $${params.length}`);
    }

    if (query) {
      params.push(`%${query}%`);
      where.push(`(
        st.id::text ILIKE $${params.length}
        OR st.email ILIKE $${params.length}
        OR COALESCE(u.name, '') ILIKE $${params.length}
        OR st.category ILIKE $${params.length}
        OR st.page_url ILIKE $${params.length}
        OR st.message ILIKE $${params.length}
        OR st.admin_note ILIKE $${params.length}
      )`);
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    try {
      await ensureSupportTicketsTable(pool);
      const [itemsResult, countResult] = await Promise.all([
        pool.query(
          `SELECT st.*, u.name AS user_name
           FROM support_tickets st
           LEFT JOIN users u ON u.id = st.user_id
           ${whereSql}
           ORDER BY st.created_at DESC, st.id DESC
           LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
          [...params, limit, offset],
        ),
        pool.query(
          `SELECT COUNT(*)::int AS total
           FROM support_tickets st
           LEFT JOIN users u ON u.id = st.user_id
           ${whereSql}`,
          params,
        ),
      ]);

      const total = Number(countResult.rows[0]?.total || 0);
      return ok(res, {
        items: itemsResult.rows,
        total,
        page,
        limit,
        total_pages: Math.max(1, Math.ceil(total / limit)),
      });
    } catch (error) {
      console.error("GET /api/admin/support-tickets error:", error);
      return serverError(res);
    }
  });

  router.patch("/admin/support-tickets/:id", authRequired, adminRequired, async (req: AuthenticatedRequest, res) => {
    const id = toPositiveInt(req.params.id);
    const status = parseEnum(req.body?.status, ticketStatuses, null);
    const priority = parseEnum(req.body?.priority, ticketPriorities, null);
    const adminNote = parseOptionalString(req.body?.admin_note, { max: 2000, normalize: true });

    if (!id) return badRequest(res, "bad_ticket_id");
    if (!status && !priority && adminNote === "") return badRequest(res, "nothing_to_update");
    if (adminNote === null) return badRequest(res, "bad_admin_note");

    const updates: string[] = [];
    const params: unknown[] = [];

    if (status) {
      params.push(status);
      updates.push(`status = $${params.length}`);
      updates.push(`resolved_at = CASE WHEN $${params.length} IN ('resolved', 'closed') THEN NOW() ELSE resolved_at END`);
    }

    if (priority) {
      params.push(priority);
      updates.push(`priority = $${params.length}`);
    }

    if (adminNote !== "") {
      params.push(adminNote);
      updates.push(`admin_note = $${params.length}`);
    }

    params.push(id);

    try {
      await ensureSupportTicketsTable(pool);
      const result = await pool.query(
        `UPDATE support_tickets
         SET ${updates.join(", ")}, updated_at = NOW()
         WHERE id = $${params.length}
         RETURNING *`,
        params,
      );

      if (!result.rows[0]) return badRequest(res, "ticket_not_found");
      await writeAdminAuditLog(pool, {
        actor: req.user,
        action: "support_ticket.update",
        entityType: "support_ticket",
        entityId: id,
        summary: "Updated support ticket",
        metadata: { status, priority, admin_note: adminNote },
      });
      return ok(res, { ticket: result.rows[0] });
    } catch (error) {
      console.error("PATCH /api/admin/support-tickets/:id error:", error);
      return serverError(res);
    }
  });

  return router;
}
