import express from "express";
import type { NextFunction, Response } from "express";
import type { Pool } from "pg";

import type { AuthenticatedRequest } from "../../../types/app";
import { badRequest, conflict, dbError, notFound, ok, serverError } from "../../../utils/http";
import { buildUploadUrl, removeUploadedFile, setUploadBucket, UPLOAD_BUCKETS, validateUploadedImageFile } from "../../../utils/upload";
import { parseEnum, parseOptionalString, parseRequiredString } from "../../../utils/validation";

type AuthMiddleware = (req: AuthenticatedRequest, res: Response, next: NextFunction) => unknown;

type UploadMiddleware = {
  single: (fieldName: string) => any;
};

type ProductRow = Record<string, any>;

type ProfileUserRow = {
  id: number;
  name: string;
  email: string;
  is_owner: boolean;
  is_admin: boolean;
  two_factor_enabled: boolean;
  nickname: string;
  avatar_url: string;
  theme: string;
  lang: string;
};

type ProfileRouterOptions = {
  pool: Pool;
  authRequired: AuthMiddleware;
  upload: UploadMiddleware;
  attachImagesToProducts?: (rows: ProductRow[]) => Promise<ProductRow[]>;
  withProductStats?: (
    rows: ProductRow[],
    userId: number,
    callback: (rows: ProductRow[]) => unknown,
  ) => Promise<unknown>;
};

type AvatarRequest = AuthenticatedRequest & {
  file?: {
    filename?: string;
    path?: string;
    mimetype?: string;
  };
};

export function createProfileRouter({
  pool,
  authRequired,
  upload,
  attachImagesToProducts,
  withProductStats,
}: ProfileRouterOptions) {
  const router = express.Router();

  async function readUserById(userId: number) {
    const r = await pool.query<ProfileUserRow>(
      `SELECT id, name, email, COALESCE(is_owner, false) AS is_owner, is_admin,
              COALESCE(two_factor_enabled, false) AS two_factor_enabled,
              COALESCE(nickname, '') AS nickname,
              COALESCE(avatar_url, '') AS avatar_url,
              COALESCE(theme, 'dark') AS theme,
              COALESCE(lang, 'ru') AS lang
         FROM users
        WHERE id = $1`,
      [userId],
    );
    return r.rows[0] || null;
  }

  async function updateProfileHandler(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user?.id) return notFound(res);

      const hasName = Object.prototype.hasOwnProperty.call(req.body || {}, "name");
      const hasNickname = Object.prototype.hasOwnProperty.call(req.body || {}, "nickname");
      const hasTheme = Object.prototype.hasOwnProperty.call(req.body || {}, "theme");
      const hasLang = Object.prototype.hasOwnProperty.call(req.body || {}, "lang");

      const current = await readUserById(req.user.id);
      if (!current) return notFound(res);

      const nextName = hasName
        ? parseRequiredString(req.body.name, { min: 2, max: 120 })
        : String(current.name || "").trim();
      const nextNickname = hasNickname
        ? parseOptionalString(req.body.nickname, { max: 32, normalize: true })
        : String(current.nickname || "").trim();
      const nextTheme = hasTheme
        ? parseEnum(req.body.theme, ["dark", "light"], null)
        : parseEnum(current.theme, ["dark", "light"], "dark");
      const nextLang = hasLang
        ? parseEnum(req.body.lang, ["ru", "kz", "en"], null)
        : parseEnum(current.lang, ["ru", "kz", "en"], "ru");

      if (!nextName) return badRequest(res, "bad_name");
      if (nextNickname === null) return badRequest(res, "bad_nickname");
      if (!nextTheme) return badRequest(res, "bad_theme");
      if (!nextLang) return badRequest(res, "bad_lang");

      if (nextNickname) {
        const dupe = await pool.query<{ id: number }>(
          `SELECT id
             FROM users
            WHERE LOWER(COALESCE(nickname, '')) = LOWER($1)
              AND id <> $2
            LIMIT 1`,
          [nextNickname, req.user.id],
        );
        if (dupe.rows[0]) return conflict(res, "nickname_taken");
      }

      const updated = await pool.query<ProfileUserRow>(
        `UPDATE users
            SET name = $1,
                nickname = $2,
                theme = $3,
                lang = $4
          WHERE id = $5
      RETURNING id, name, email, COALESCE(is_owner, false) AS is_owner, is_admin,
                COALESCE(two_factor_enabled, false) AS two_factor_enabled,
                COALESCE(nickname, '') AS nickname,
                COALESCE(avatar_url, '') AS avatar_url,
                COALESCE(theme, 'dark') AS theme,
                COALESCE(lang, 'ru') AS lang`,
        [nextName, nextNickname, nextTheme, nextLang, req.user.id],
      );

      return ok(res, { user: updated.rows[0] || null });
    } catch (error) {
      console.error("PATCH /api/profile error:", error);
      return dbError(res, error);
    }
  }

  router.patch("/profile", authRequired, updateProfileHandler);
  router.post("/profile", authRequired, updateProfileHandler);

  router.get("/profile/products", authRequired, async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user?.id) return notFound(res);

      const result = await pool.query<ProductRow>(
        `SELECT *
           FROM products
          WHERE owner_user_id = $1
          ORDER BY id DESC`,
        [req.user.id],
      );

      let rows = result.rows || [];

      try {
        if (typeof attachImagesToProducts === "function") {
          rows = await attachImagesToProducts(rows);
        }
      } catch (error) {
        console.error("profile products attachImages error:", error);
      }

      if (typeof withProductStats === "function") {
        return await withProductStats(rows, req.user.id, (out) => ok(res, { items: out || [] }));
      }

      return ok(res, { items: rows });
    } catch (error) {
      console.error("GET /api/profile/products error:", error);
      return serverError(res);
    }
  });

  router.post("/profile/avatar", authRequired, setUploadBucket(UPLOAD_BUCKETS.avatars), upload.single("avatar"), async (req: AvatarRequest, res) => {
    try {
      if (!req.file?.filename) return badRequest(res, "missing_file");
      if (!req.user?.id) return notFound(res);
      if (!(await validateUploadedImageFile(req.file))) {
        await removeUploadedFile(req.file);
        return badRequest(res, "bad_file_type");
      }

      const avatarUrl = buildUploadUrl(UPLOAD_BUCKETS.avatars, req.file.filename);
      const updated = await pool.query<ProfileUserRow>(
        `UPDATE users
            SET avatar_url = $1
          WHERE id = $2
      RETURNING id, name, email, COALESCE(is_owner, false) AS is_owner, is_admin,
                COALESCE(two_factor_enabled, false) AS two_factor_enabled,
                COALESCE(nickname, '') AS nickname,
                COALESCE(avatar_url, '') AS avatar_url,
                COALESCE(theme, 'dark') AS theme,
                COALESCE(lang, 'ru') AS lang`,
        [avatarUrl, req.user.id],
      );

      return ok(res, { avatar_url: avatarUrl, user: updated.rows[0] || null });
    } catch (error) {
      console.error("POST /api/profile/avatar error:", error);
      return serverError(res);
    }
  });

  router.delete("/profile/avatar", authRequired, async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user?.id) return notFound(res);

      const updated = await pool.query<ProfileUserRow>(
        `UPDATE users
            SET avatar_url = ''
          WHERE id = $1
      RETURNING id, name, email, COALESCE(is_owner, false) AS is_owner, is_admin,
                COALESCE(two_factor_enabled, false) AS two_factor_enabled,
                COALESCE(nickname, '') AS nickname,
                COALESCE(avatar_url, '') AS avatar_url,
                COALESCE(theme, 'dark') AS theme,
                COALESCE(lang, 'ru') AS lang`,
        [req.user.id],
      );

      return ok(res, { avatar_url: "", user: updated.rows[0] || null });
    } catch (error) {
      console.error("DELETE /api/profile/avatar error:", error);
      return serverError(res);
    }
  });

  return router;
}
