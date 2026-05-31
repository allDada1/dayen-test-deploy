import crypto from "crypto";
import express from "express";
import { OAuth2Client } from "google-auth-library";
import type { NextFunction, Request, Response } from "express";
import type { Pool } from "pg";

import type { AuthenticatedRequest } from "../../../types/app";
import {
  badRequest,
  conflict,
  created,
  dbError,
  forbidden,
  notFound,
  ok,
  serverError,
  unauthorized,
} from "../../../utils/http";
import { clearSessionCookie, setSessionCookie } from "../../../utils/auth-cookies";
import { hashSessionToken } from "../../../utils/crypto";
import {
  authLoginRateLimit,
  authRegisterRateLimit,
  authSensitiveRateLimit,
} from "../../../middleware/rate-limit";
import { buildTotpOtpAuthUrl, generateTotpSecret, verifyTotpCode } from "../../../utils/totp";
import { parseEmail, parseRequiredString } from "../../../utils/validation";
import { writeAdminAuditLog } from "../../admin/services/admin-audit.service";

type AuthMiddleware = (req: AuthenticatedRequest, res: Response, next: NextFunction) => unknown;

type EmailService = {
  appBaseUrl?: string;
  sendPasswordResetEmail: (payload: { to: string; name: string; resetUrl: string }) => Promise<unknown>;
  sendEmailVerificationEmail: (payload: {
    to: string;
    name: string;
    verifyUrl: string;
  }) => Promise<unknown>;
};

type AuthRouterOptions = {
  pool: Pool;
  authRequired: AuthMiddleware;
  hashPassword: (password: string, salt: string) => string;
  makeSalt: () => string;
  makeToken: () => string;
  nowPlusDays: (days: number) => string;
  emailService: EmailService;
};

type GooglePayload = {
  email?: string;
  sub?: string;
  user_id?: string;
  email_verified?: boolean | string;
  name?: string;
  given_name?: string;
  picture?: string;
};

type UserRecord = {
  id: number;
  name: string;
  email: string;
  is_owner?: boolean | null;
  is_admin: boolean;
  two_factor_secret?: string | null;
  two_factor_enabled?: boolean | null;
  is_seller?: boolean | null;
  seller_access?: boolean | null;
  nickname?: string | null;
  avatar_url?: string | null;
  theme?: string | null;
  lang?: string | null;
  email_verified?: boolean | null;
  status?: string | null;
  banned_until?: string | Date | null;
  warning_count?: number | null;
  pass_salt?: string;
  pass_hash?: string;
};

let googleOAuthClient: OAuth2Client | null = null;

function getGoogleOAuthClient(clientId: string) {
  if (!clientId) return null;
  if (googleOAuthClient) return googleOAuthClient;

  googleOAuthClient = new OAuth2Client(clientId);
  return googleOAuthClient;
}

async function verifyGoogleCredential(credential: string, clientId: string) {
  const client = getGoogleOAuthClient(clientId);
  if (!client) throw new Error("google_not_configured");

  const ticket = await client.verifyIdToken({ idToken: credential, audience: clientId });
  return (ticket.getPayload() || {}) as GooglePayload;
}

async function verifyGoogleAccessToken(accessToken: string) {
  const token = String(accessToken || "").trim();
  if (!token) throw new Error("missing_google_access_token");

  const response = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error("bad_google_access_token");
  }

  return (await response.json().catch(() => ({}))) as GooglePayload;
}

function hashResetToken(token: string) {
  return crypto.createHash("sha256").update(String(token || "")).digest("hex");
}

function nowPlusMinutes(minutes: number) {
  const d = new Date();
  d.setMinutes(d.getMinutes() + minutes);
  return d.toISOString();
}

function makeEmailVerificationToken() {
  return `${crypto.randomBytes(24).toString("hex")}${crypto.randomBytes(12).toString("hex")}`;
}

function toAuthUser(user: UserRecord) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    is_owner: !!user.is_owner,
    is_admin: !!user.is_admin,
    two_factor_enabled: !!user.two_factor_enabled,
    is_seller: !!user.is_seller,
    seller_access: !!user.seller_access || !!user.is_seller,
    nickname: user.nickname || "",
    avatar_url: user.avatar_url || "",
    theme: user.theme || "dark",
    lang: user.lang || "ru",
    email_verified: !!user.email_verified,
    status: user.status || "active",
    banned_until: user.banned_until || null,
    warning_count: Number(user.warning_count || 0),
  };
}

function getAccountAccessError(user: UserRecord) {
  if (user.is_admin || user.is_owner) return null;

  if (user.status === "banned") {
    return { code: "account_banned", details: undefined };
  }

  if (user.status === "temporarily_banned") {
    const bannedUntil = user.banned_until ? new Date(user.banned_until).getTime() : 0;
    if (!bannedUntil || bannedUntil > Date.now()) {
      return {
        code: "account_temporarily_banned",
        details: { banned_until: user.banned_until || null },
      };
    }
  }

  return null;
}

function passwordPolicyError(password: string) {
  const value = String(password || "");
  if (value.length < 10) return "bad_password";
  if (!/[a-zа-я]/i.test(value) || !/\d/.test(value)) return "weak_password";
  return "";
}

async function createSession(pool: Pool, userId: number, token: string, expiresAt: string) {
  await pool.query(
    `INSERT INTO sessions (token, user_id, expires_at)
     VALUES ($1, $2, $3)`,
    [hashSessionToken(token), userId, expiresAt],
  );
}

function requireTotpForEnabledUser(user: UserRecord, code: unknown) {
  if (!user.two_factor_enabled) return "";
  const value = String(code || "").trim();
  if (!value) return "two_factor_required";
  return verifyTotpCode(String(user.two_factor_secret || ""), value) ? "" : "bad_2fa_code";
}

export function createAuthRouter({
  pool,
  authRequired,
  hashPassword,
  makeSalt,
  makeToken,
  nowPlusDays,
  emailService,
}: AuthRouterOptions) {
  const router = express.Router();

  router.get("/auth/google-config", (_req, res) => {
    const clientId = String(process.env.GOOGLE_CLIENT_ID || "").trim();
    if (!clientId) return notFound(res, "google_not_configured");
    return ok(res, { clientId });
  });

  router.get("/auth/telegram-config", (_req, res) => {
    const botUsername = String(process.env.TELEGRAM_BOT_USERNAME || "").trim();
    const botToken = String(process.env.TELEGRAM_BOT_TOKEN || "").trim();
    const loginUrl = String(process.env.TELEGRAM_LOGIN_URL || "").trim().replace(/\/$/, "");

    const missing: string[] = [];
    if (!botUsername) missing.push("TELEGRAM_BOT_USERNAME");
    if (!botToken) missing.push("TELEGRAM_BOT_TOKEN");
    if (!loginUrl) missing.push("TELEGRAM_LOGIN_URL");

    const isPublicUrl = /^https?:\/\//i.test(loginUrl) && !/localhost|127\.0\.0\.1/i.test(loginUrl);
    const enabled = missing.length === 0 && isPublicUrl;

    return ok(res, {
      enabled,
      mode: enabled ? "widget_callback" : "setup_required",
      botUsername: botUsername || "",
      loginUrl: loginUrl || "",
      authUrl: enabled ? `${loginUrl}/api/auth/telegram/start` : "",
      callbackUrl: loginUrl ? `${loginUrl}/auth/telegram/callback` : "",
      missing,
      note: enabled
        ? "Telegram login готов к подключению публичного callback-потока."
        : "Для реального Telegram login нужен бот и публичный URL, добавленный в настройках бота.",
    });
  });

  router.get("/auth/telegram/start", (_req, res) => badRequest(res, "telegram_login_not_enabled_yet"));
  router.get("/auth/telegram/callback", (_req, res) => badRequest(res, "telegram_login_not_enabled_yet"));

  router.post("/auth/google", authLoginRateLimit, async (req, res) => {
    const credential = String(req.body?.credential || "").trim();
    const accessToken = String(req.body?.access_token || "").trim();
    const clientId = String(process.env.GOOGLE_CLIENT_ID || "").trim();

    if (!clientId) return serverError(res, "google_not_configured");
    if (!credential && !accessToken) return badRequest(res, "missing_google_credential");

    try {
      const payload = credential
        ? await verifyGoogleCredential(credential, clientId)
        : await verifyGoogleAccessToken(accessToken);

      const email = String(payload.email || "").trim().toLowerCase();
      const googleSub = String(payload.sub || payload.user_id || "").trim();
      const emailVerified = payload.email_verified === true || payload.email_verified === "true";
      const name = String(payload.name || payload.given_name || "Google User").trim() || "Google User";
      const avatarUrl = String(payload.picture || "").trim();

      if (!email || !googleSub) return unauthorized(res, "bad_google_credentials");
      if (!emailVerified) return unauthorized(res, "google_email_not_verified");

      const userResult = await pool.query<UserRecord>(
        `SELECT id, name, email, COALESCE(is_owner, false) AS is_owner, is_admin,
                COALESCE(two_factor_enabled, false) AS two_factor_enabled, two_factor_secret,
                is_seller, seller_access, nickname, avatar_url, theme, lang,
                email_verified, status, banned_until, warning_count
           FROM users
          WHERE LOWER(email) = $1
          LIMIT 1`,
        [email],
      );

      let user = userResult.rows[0];

      if (!user) {
        const salt = makeSalt();
        const generatedPassword = `google:${googleSub}:${makeToken()}`;
        const passHash = hashPassword(generatedPassword, salt);

        const createdUser = await pool.query<UserRecord>(
          `INSERT INTO users (name, email, pass_salt, pass_hash, is_admin, avatar_url, email_verified)
           VALUES ($1, $2, $3, $4, false, $5, true)
           RETURNING id, name, email, COALESCE(is_owner, false) AS is_owner, is_admin,
                     COALESCE(two_factor_enabled, false) AS two_factor_enabled, two_factor_secret,
                     is_seller, seller_access, nickname, avatar_url, theme, lang,
                     email_verified, status, banned_until, warning_count`,
          [name, email, salt, passHash, avatarUrl],
        );

        user = createdUser.rows[0];
      } else if (!user.avatar_url && avatarUrl) {
        const updated = await pool.query<UserRecord>(
          `UPDATE users SET avatar_url = $1, email_verified = true WHERE id = $2
           RETURNING id, name, email, COALESCE(is_owner, false) AS is_owner, is_admin,
                     COALESCE(two_factor_enabled, false) AS two_factor_enabled, two_factor_secret,
                     is_seller, seller_access, nickname, avatar_url, theme, lang,
                     email_verified, status, banned_until, warning_count`,
          [avatarUrl, user.id],
        );
        user = updated.rows[0] || user;
      } else if (!user.email_verified) {
        const updated = await pool.query<UserRecord>(
          `UPDATE users SET email_verified = true WHERE id = $1
           RETURNING id, name, email, COALESCE(is_owner, false) AS is_owner, is_admin,
                     COALESCE(two_factor_enabled, false) AS two_factor_enabled, two_factor_secret,
                     is_seller, seller_access, nickname, avatar_url, theme, lang,
                     email_verified, status, banned_until, warning_count`,
          [user.id],
        );
        user = updated.rows[0] || user;
      }

      const accessError = getAccountAccessError(user);
      if (accessError) return unauthorized(res, accessError.code, accessError.details);

      const totpError = requireTotpForEnabledUser(user, req.body?.totp_code);
      if (totpError) return unauthorized(res, totpError);

      const token = makeToken();
      const expiresAt = nowPlusDays(30);

      await createSession(pool, user.id, token, expiresAt);
      setSessionCookie(res, token, req);

      return ok(res, {
        token,
        user: toAuthUser(user),
      });
    } catch (error) {
      console.error("POST /api/auth/google error:", error);
      return unauthorized(res, "bad_google_credentials");
    }
  });

  router.post("/auth/register", authRegisterRateLimit, async (req, res) => {
    const name = parseRequiredString(req.body?.name, { min: 2, max: 80, normalize: true });
    const email = parseEmail(req.body?.email);
    const password = String(req.body?.password || "");

    if (!name) return badRequest(res, "bad_name");
    if (!email) return badRequest(res, "bad_email");
    const passwordError = passwordPolicyError(password);
    if (passwordError) return badRequest(res, passwordError);

    const salt = makeSalt();
    const passHash = hashPassword(password, salt);

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const rUser = await client.query<UserRecord>(
        `INSERT INTO users (name, email, pass_salt, pass_hash, is_admin)
         VALUES ($1, $2, $3, $4, false)
         RETURNING id, name, email, COALESCE(is_owner, false) AS is_owner, is_admin,
                   COALESCE(two_factor_enabled, false) AS two_factor_enabled, two_factor_secret,
                   is_seller, seller_access, nickname, avatar_url, theme, lang,
                   email_verified, status, banned_until, warning_count`,
        [name, email, salt, passHash],
      );

      const user = rUser.rows[0];
      const rawVerificationToken = makeEmailVerificationToken();
      const verificationHash = hashResetToken(rawVerificationToken);
      const verificationExpiresAt = nowPlusMinutes(60 * 24);
      const baseUrl = String(
        emailService?.appBaseUrl || process.env.APP_BASE_URL || "http://localhost:5173",
      ).replace(/\/$/, "");
      const verifyUrl = `${baseUrl}/verify-email?token=${encodeURIComponent(rawVerificationToken)}`;

      await client.query(
        `DELETE FROM email_verification_tokens WHERE user_id = $1 OR expires_at <= NOW() OR used_at IS NOT NULL`,
        [user.id],
      );
      await client.query(
        `INSERT INTO email_verification_tokens (user_id, token_hash, expires_at)
         VALUES ($1, $2, $3)`,
        [user.id, verificationHash, verificationExpiresAt],
      );

      await client.query("COMMIT");

      let emailMessage = "Регистрация успешна. Подтвердите почту и затем войдите в аккаунт.";
      try {
        const emailResult = (await emailService.sendEmailVerificationEmail({
          to: user.email,
          name: user.name,
          verifyUrl,
        })) as { mode?: string };

        if (emailResult.mode === "console_fallback") {
          emailMessage = "Регистрация успешна. Почтовый сервис не настроен, тестовая ссылка выведена в лог сервера.";
        }
      } catch (mailError) {
        console.error("POST /api/auth/register verification email error:", mailError);
        emailMessage = "Регистрация успешна, но письмо пока не отправлено. Откройте подтверждение почты и запросите письмо ещё раз.";
      }

      return created(res, {
        message: emailMessage,
        email: user.email,
      });
    } catch (error) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("POST /api/auth/register rollback error:", rollbackError);
      }

      const err = error as { message?: string; code?: string };
      const msg = String(err?.message || err).toLowerCase();
      const code = String(err?.code || "");

      if (
        code === "23505" ||
        msg.includes("unique") ||
        msg.includes("duplicate key") ||
        msg.includes("users_email_key")
      ) {
        return conflict(res, "email_taken");
      }

      console.error("POST /api/auth/register error:", error);
      return dbError(res, error);
    } finally {
      client.release();
    }
  });

  router.post("/auth/login", authLoginRateLimit, async (req, res) => {
    const email = parseEmail(req.body?.email);
    const password = String(req.body?.password || "");

    if (!email) return badRequest(res, "bad_email");
    if (!password) return badRequest(res, "bad_password");

    try {
      const result = await pool.query<UserRecord>(
        `SELECT * FROM users WHERE LOWER(email) = $1 LIMIT 1`,
        [email],
      );

      const user = result.rows[0];
      if (!user || !user.pass_salt || !user.pass_hash) {
        return unauthorized(res, "bad_credentials");
      }

      const calc = hashPassword(password, user.pass_salt);
      if (calc !== user.pass_hash) {
        return unauthorized(res, "bad_credentials");
      }

      const accessError = getAccountAccessError(user);
      if (accessError) return unauthorized(res, accessError.code, accessError.details);

      const totpError = requireTotpForEnabledUser(user, req.body?.totp_code);
      if (totpError) return unauthorized(res, totpError);

      const token = makeToken();
      const expiresAt = nowPlusDays(30);

      await createSession(pool, user.id, token, expiresAt);
      setSessionCookie(res, token, req);

      return ok(res, {
        token,
        user: toAuthUser(user),
      });
    } catch (error) {
      console.error("POST /api/auth/login error:", error);
      return dbError(res, error);
    }
  });

  router.post("/auth/verify-email", authSensitiveRateLimit, async (req, res) => {
    const token = String(req.body?.token || "").trim();
    if (!token) return badRequest(res, "missing_token");

    try {
      const tokenHash = hashResetToken(token);
      const result = await pool.query<{ id: number; user_id: number }>(
        `SELECT evt.id, evt.user_id
           FROM email_verification_tokens evt
          WHERE evt.token_hash = $1
            AND evt.used_at IS NULL
            AND evt.expires_at > NOW()
          LIMIT 1`,
        [tokenHash],
      );

      const row = result.rows[0];
      if (!row) return badRequest(res, "bad_or_expired_verification_token");

      await pool.query(`UPDATE users SET email_verified = true WHERE id = $1`, [row.user_id]);
      await pool.query(`UPDATE email_verification_tokens SET used_at = NOW() WHERE id = $1`, [row.id]);
      await pool.query(`DELETE FROM email_verification_tokens WHERE user_id = $1 AND id <> $2`, [row.user_id, row.id]);

      return ok(res, { message: "Email подтверждён." });
    } catch (error) {
      console.error("POST /api/auth/verify-email error:", error);
      return serverError(res, "verify_email_failed");
    }
  });

  router.post("/auth/verify-email/resend", authRequired, authSensitiveRateLimit, async (req: AuthenticatedRequest, res) => {
    if (!req.user?.id) return unauthorized(res, "unauthorized");
    if (req.user.email_verified) return conflict(res, "email_already_verified");

    try {
      const result = await pool.query<{ id: number; name: string; email: string }>(
        `SELECT id, name, email FROM users WHERE id = $1 LIMIT 1`,
        [req.user.id],
      );

      const user = result.rows[0];
      if (!user) return notFound(res, "user_not_found");

      const rawVerificationToken = makeEmailVerificationToken();
      const verificationHash = hashResetToken(rawVerificationToken);
      const verificationExpiresAt = nowPlusMinutes(60 * 24);
      const baseUrl = String(
        emailService?.appBaseUrl || process.env.APP_BASE_URL || "http://localhost:5173",
      ).replace(/\/$/, "");
      const verifyUrl = `${baseUrl}/verify-email?token=${encodeURIComponent(rawVerificationToken)}`;

      await pool.query(
        `DELETE FROM email_verification_tokens WHERE user_id = $1 OR expires_at <= NOW() OR used_at IS NOT NULL`,
        [user.id],
      );
      await pool.query(
        `INSERT INTO email_verification_tokens (user_id, token_hash, expires_at)
         VALUES ($1, $2, $3)`,
        [user.id, verificationHash, verificationExpiresAt],
      );

      let message = "Письмо с подтверждением отправлено повторно.";
      try {
        const emailResult = (await emailService.sendEmailVerificationEmail({
          to: user.email,
          name: user.name,
          verifyUrl,
        })) as { mode?: string };

        if (emailResult.mode === "console_fallback") {
          message = "Почтовый сервис не настроен. Тестовая ссылка выведена в лог сервера.";
        }
      } catch (mailError) {
        console.error("POST /api/auth/verify-email/resend email error:", mailError);
        message = "Запрос сохранен, но письмо пока не отправлено. Попробуйте повторить позже.";
      }

      return ok(res, { message });
    } catch (error) {
      console.error("POST /api/auth/verify-email/resend error:", error);
      return serverError(res, "verification_email_failed");
    }
  });

  router.post("/auth/verify-email/resend-public", authSensitiveRateLimit, async (req, res) => {
    const email = parseEmail(req.body?.email);
    if (!email) return badRequest(res, "bad_email");

    try {
      const result = await pool.query<{ id: number; name: string; email: string; email_verified: boolean | null }>(
        `SELECT id, name, email, email_verified FROM users WHERE LOWER(email) = $1 LIMIT 1`,
        [email],
      );

      const user = result.rows[0];
      if (!user) {
        return ok(res, { message: "Если аккаунт существует, письмо с подтверждением отправлено." });
      }

      if (user.email_verified) return conflict(res, "email_already_verified");

      const rawVerificationToken = makeEmailVerificationToken();
      const verificationHash = hashResetToken(rawVerificationToken);
      const verificationExpiresAt = nowPlusMinutes(60 * 24);
      const baseUrl = String(
        emailService?.appBaseUrl || process.env.APP_BASE_URL || "http://localhost:5173",
      ).replace(/\/$/, "");
      const verifyUrl = `${baseUrl}/verify-email?token=${encodeURIComponent(rawVerificationToken)}`;

      await pool.query(
        `DELETE FROM email_verification_tokens WHERE user_id = $1 OR expires_at <= NOW() OR used_at IS NOT NULL`,
        [user.id],
      );
      await pool.query(
        `INSERT INTO email_verification_tokens (user_id, token_hash, expires_at)
         VALUES ($1, $2, $3)`,
        [user.id, verificationHash, verificationExpiresAt],
      );

      let message = "Письмо с подтверждением отправлено повторно.";
      try {
        const emailResult = (await emailService.sendEmailVerificationEmail({
          to: user.email,
          name: user.name,
          verifyUrl,
        })) as { mode?: string };

        if (emailResult.mode === "console_fallback") {
          message = "Почтовый сервис не настроен. Тестовая ссылка выведена в лог сервера.";
        }
      } catch (mailError) {
        console.error("POST /api/auth/verify-email/resend-public email error:", mailError);
        message = "Запрос сохранен, но письмо пока не отправлено. Попробуйте повторить позже.";
      }

      return ok(res, { message });
    } catch (error) {
      console.error("POST /api/auth/verify-email/resend-public error:", error);
      return serverError(res, "verification_email_failed");
    }
  });

  router.post("/auth/forgot-password", authSensitiveRateLimit, async (req, res) => {
    const email = parseEmail(req.body?.email);
    if (!email) return badRequest(res, "bad_email");

    const genericMessage = "Если аккаунт существует, письмо со ссылкой уже отправлено.";

    try {
      const result = await pool.query<{ id: number; name: string; email: string }>(
        `SELECT id, name, email FROM users WHERE LOWER(email) = $1 LIMIT 1`,
        [email],
      );

      const user = result.rows[0];
      if (!user) return ok(res, { message: genericMessage });

      const rawToken = `${makeToken()}${makeToken()}`;
      const tokenHash = hashResetToken(rawToken);
      const expiresAt = nowPlusMinutes(30);
      const baseUrl = String(emailService?.appBaseUrl || process.env.APP_BASE_URL || "http://localhost:5173").replace(/\/$/, "");
      const resetUrl = `${baseUrl}/reset-password?token=${encodeURIComponent(rawToken)}`;

      await pool.query(`DELETE FROM password_reset_tokens WHERE user_id = $1 OR expires_at <= NOW()`, [user.id]);
      await pool.query(
        `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
         VALUES ($1, $2, $3)`,
        [user.id, tokenHash, expiresAt],
      );

      let message = genericMessage;
      try {
        const emailResult = (await emailService.sendPasswordResetEmail({
          to: user.email,
          name: user.name,
          resetUrl,
        })) as { mode?: string };

        if (emailResult.mode === "console_fallback") {
          message = "Почтовый сервис не настроен. Тестовая ссылка выведена в лог сервера.";
        }
      } catch (mailError) {
        console.error("POST /api/auth/forgot-password email error:", mailError);
        message = "Запрос сохранен, но письмо пока не отправлено. Попробуйте повторить позже.";
      }

      return ok(res, { message });
    } catch (error) {
      console.error("POST /api/auth/forgot-password error:", error);
      return serverError(res, "reset_email_failed");
    }
  });

  router.post("/auth/reset-password", authSensitiveRateLimit, async (req, res) => {
    const token = String(req.body?.token || "").trim();
    const password = String(req.body?.password || "");

    if (!token) return badRequest(res, "missing_token");
    const passwordError = passwordPolicyError(password);
    if (passwordError) return badRequest(res, passwordError);

    try {
      const tokenHash = hashResetToken(token);
      const result = await pool.query<{ id: number; user_id: number }>(
        `SELECT prt.id, prt.user_id
           FROM password_reset_tokens prt
          WHERE prt.token_hash = $1
            AND prt.used_at IS NULL
            AND prt.expires_at > NOW()
          LIMIT 1`,
        [tokenHash],
      );

      const row = result.rows[0];
      if (!row) return badRequest(res, "bad_or_expired_token");

      const salt = makeSalt();
      const passHash = hashPassword(password, salt);

      await pool.query(`UPDATE users SET pass_salt = $1, pass_hash = $2 WHERE id = $3`, [salt, passHash, row.user_id]);
      await pool.query(`UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1`, [row.id]);
      await pool.query(`DELETE FROM sessions WHERE user_id = $1`, [row.user_id]);

      return ok(res, { message: "Пароль обновлён. Теперь можно войти заново." });
    } catch (error) {
      console.error("POST /api/auth/reset-password error:", error);
      return serverError(res, "reset_password_failed");
    }
  });

  router.post("/auth/change-password", authRequired, authSensitiveRateLimit, async (req: AuthenticatedRequest, res) => {
    if (!req.user?.id) return unauthorized(res, "unauthorized");

    const currentPassword = String(req.body?.current_password || "");
    const nextPassword = String(req.body?.new_password || "");
    const totpCode = String(req.body?.totp_code || "").trim();

    if (!currentPassword) return badRequest(res, "bad_password");
    const passwordError = passwordPolicyError(nextPassword);
    if (passwordError) return badRequest(res, passwordError);

    try {
      const result = await pool.query<UserRecord>(
        `SELECT id, name, email, COALESCE(is_owner, false) AS is_owner, is_admin,
                COALESCE(two_factor_enabled, false) AS two_factor_enabled, two_factor_secret,
                pass_salt, pass_hash
           FROM users
          WHERE id = $1
          LIMIT 1`,
        [req.user.id],
      );

      const user = result.rows[0];
      if (!user) return notFound(res, "user_not_found");
      if (!user.pass_salt || !user.pass_hash || hashPassword(currentPassword, user.pass_salt) !== user.pass_hash) {
        return unauthorized(res, "bad_credentials");
      }
      if (hashPassword(nextPassword, user.pass_salt) === user.pass_hash) {
        return badRequest(res, "same_password");
      }
      if (user.two_factor_enabled) {
        if (!totpCode) return badRequest(res, "missing_2fa_code");
        if (!verifyTotpCode(String(user.two_factor_secret || ""), totpCode)) return unauthorized(res, "bad_2fa_code");
      }

      const salt = makeSalt();
      const passHash = hashPassword(nextPassword, salt);
      const currentToken = String(req.token || "");
      const currentTokenHash = hashSessionToken(currentToken);

      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query(`UPDATE users SET pass_salt = $1, pass_hash = $2 WHERE id = $3`, [salt, passHash, user.id]);
        await client.query(`DELETE FROM password_reset_tokens WHERE user_id = $1`, [user.id]);
        await client.query(
          `DELETE FROM sessions
           WHERE user_id = $1
             AND token NOT IN ($2, $3)`,
          [user.id, currentTokenHash, currentToken],
        );
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }

      return ok(res, { message: "password_changed" });
    } catch (error) {
      console.error("POST /api/auth/change-password error:", error);
      return serverError(res, "change_password_failed");
    }
  });

  router.get("/auth/2fa/status", authRequired, (req: AuthenticatedRequest, res) => {
    const privileged = !!req.user?.is_owner || !!req.user?.is_admin;
    return ok(res, {
      enabled: !!req.user?.two_factor_enabled,
      required: privileged,
    });
  });

  router.post("/auth/2fa/setup", authRequired, authSensitiveRateLimit, async (req: AuthenticatedRequest, res) => {
    if (!req.user?.id) return unauthorized(res, "unauthorized");

    try {
      const userResult = await pool.query<UserRecord>(
        `SELECT id, name, email, COALESCE(is_owner, false) AS is_owner, is_admin,
                COALESCE(two_factor_enabled, false) AS two_factor_enabled
           FROM users
          WHERE id = $1
          LIMIT 1`,
        [req.user.id],
      );
      const user = userResult.rows[0];
      if (!user) return notFound(res, "user_not_found");
      if (user.two_factor_enabled) return conflict(res, "two_factor_already_enabled");

      const secret = generateTotpSecret();
      await pool.query(
        `UPDATE users
            SET two_factor_secret = $1,
                two_factor_enabled = false
          WHERE id = $2`,
        [secret, user.id],
      );

      return ok(res, {
        secret,
        otpauth_url: buildTotpOtpAuthUrl({ secret, email: user.email }),
      });
    } catch (error) {
      console.error("POST /api/auth/2fa/setup error:", error);
      return dbError(res, error);
    }
  });

  router.post("/auth/2fa/enable", authRequired, authSensitiveRateLimit, async (req: AuthenticatedRequest, res) => {
    if (!req.user?.id) return unauthorized(res, "unauthorized");
    const code = String(req.body?.code || "").trim();
    if (!code) return badRequest(res, "missing_2fa_code");

    try {
      const result = await pool.query<UserRecord>(
        `SELECT id, name, email, COALESCE(is_owner, false) AS is_owner, is_admin,
                COALESCE(two_factor_enabled, false) AS two_factor_enabled, two_factor_secret,
                is_seller, seller_access, nickname, avatar_url, theme, lang,
                email_verified, status, banned_until, warning_count
           FROM users
          WHERE id = $1
          LIMIT 1`,
        [req.user.id],
      );

      const user = result.rows[0];
      if (!user) return notFound(res, "user_not_found");
      if (!user.two_factor_secret) return badRequest(res, "two_factor_not_configured");
      if (!verifyTotpCode(user.two_factor_secret, code)) return unauthorized(res, "bad_2fa_code");

      const updated = await pool.query<UserRecord>(
        `UPDATE users
            SET two_factor_enabled = true
          WHERE id = $1
      RETURNING id, name, email, COALESCE(is_owner, false) AS is_owner, is_admin,
                COALESCE(two_factor_enabled, false) AS two_factor_enabled, two_factor_secret,
                is_seller, seller_access, nickname, avatar_url, theme, lang,
                email_verified, status, banned_until, warning_count`,
        [user.id],
      );

      return ok(res, { user: toAuthUser(updated.rows[0] || user) });
    } catch (error) {
      console.error("POST /api/auth/2fa/enable error:", error);
      return dbError(res, error);
    }
  });

  router.post("/auth/2fa/disable", authRequired, authSensitiveRateLimit, async (req: AuthenticatedRequest, res) => {
    if (!req.user?.id) return unauthorized(res, "unauthorized");
    const code = String(req.body?.code || "").trim();
    const password = String(req.body?.password || "");
    if (!code) return badRequest(res, "missing_2fa_code");
    if (!password) return badRequest(res, "bad_password");

    try {
      const result = await pool.query<UserRecord>(
        `SELECT id, name, email, COALESCE(is_owner, false) AS is_owner, is_admin,
                COALESCE(two_factor_enabled, false) AS two_factor_enabled, two_factor_secret,
                is_seller, seller_access, nickname, avatar_url, theme, lang,
                email_verified, status, banned_until, warning_count,
                pass_salt, pass_hash
           FROM users
          WHERE id = $1
          LIMIT 1`,
        [req.user.id],
      );

      const user = result.rows[0];
      if (!user) return notFound(res, "user_not_found");
      if (!user.two_factor_enabled || !user.two_factor_secret) return conflict(res, "two_factor_not_enabled");
      if (!verifyTotpCode(user.two_factor_secret, code)) return unauthorized(res, "bad_2fa_code");
      if (!user.pass_salt || !user.pass_hash || hashPassword(password, user.pass_salt) !== user.pass_hash) {
        return unauthorized(res, "bad_credentials");
      }

      const updated = await pool.query<UserRecord>(
        `UPDATE users
            SET two_factor_enabled = false,
                two_factor_secret = ''
          WHERE id = $1
      RETURNING id, name, email, COALESCE(is_owner, false) AS is_owner, is_admin,
                COALESCE(two_factor_enabled, false) AS two_factor_enabled, two_factor_secret,
                is_seller, seller_access, nickname, avatar_url, theme, lang,
                email_verified, status, banned_until, warning_count`,
        [user.id],
      );

      return ok(res, { user: toAuthUser(updated.rows[0] || user) });
    } catch (error) {
      console.error("POST /api/auth/2fa/disable error:", error);
      return dbError(res, error);
    }
  });

  router.get("/auth/me", authRequired, (req: AuthenticatedRequest, res) => {
    if (req.token) setSessionCookie(res, req.token, req);
    return ok(res, { user: req.user });
  });

  router.post("/auth/logout", authRequired, async (req: AuthenticatedRequest, res) => {
    try {
      await pool.query(`DELETE FROM sessions WHERE token IN ($1, $2)`, [hashSessionToken(req.token || ""), req.token || ""]);
      clearSessionCookie(res, req);
      return ok(res);
    } catch (error) {
      console.error("POST /api/auth/logout error:", error);
      return dbError(res, error);
    }
  });

  router.post("/admin/make-admin", authRequired, authSensitiveRateLimit, async (req: AuthenticatedRequest, res) => {
    const email = parseEmail(req.body?.email);
    const reason = String(req.body?.reason || "owner grant admin").trim().slice(0, 500);

    if (!req.user?.is_owner) return forbidden(res, "owner_only");
    if (!req.user?.two_factor_enabled) return forbidden(res, "two_factor_setup_required");
    if (!email) return badRequest(res, "bad_email");

    try {
      const result = await pool.query<{ id: number }>(
        `UPDATE users
         SET is_admin = TRUE
         WHERE LOWER(email) = $1
           AND COALESCE(is_owner, false) = FALSE
         RETURNING id`,
        [email],
      );

      if (!result.rows.length) return notFound(res, "user_not_found");
      await writeAdminAuditLog(pool, {
        actor: req.user,
        action: "user.admin_granted",
        entityType: "user",
        entityId: result.rows[0].id,
        targetUserId: Number(result.rows[0].id),
        summary: "Granted admin role",
        metadata: { reason, source: "owner_make_admin_endpoint" },
      });
      return ok(res);
    } catch (error) {
      console.error("POST /api/admin/make-admin error:", error);
      return dbError(res, error);
    }
  });

  return router;
}
