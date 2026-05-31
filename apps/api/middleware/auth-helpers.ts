import type { Request } from "express";
import type { Pool } from "pg";

import type { AppUser, AuthenticatedRequest, SessionUserRow } from "../types/app";
import { readSessionCookie } from "../utils/auth-cookies";
import { hashSessionToken } from "../utils/crypto";

export function extractBearerToken(authorizationHeader?: string | null): string | null {
  const header = String(authorizationHeader || "").trim();
  const match = header.match(/^Bearer\s+(.+)$/i);

  return match ? String(match[1] || "").trim() || null : null;
}

export function extractFlexibleToken(req: Request): string | null {
  const bearer = extractBearerToken(req.headers.authorization);
  if (bearer) return bearer;

  const cookieToken = readSessionCookie(req);
  if (cookieToken) return cookieToken;

  const headerToken = String(
    req.headers["x-market-token"] || req.headers["x-auth-token"] || "",
  ).trim();
  if (headerToken) return headerToken;

  const queryToken = String(req.query.token || "").trim();
  return queryToken || null;
}

export function mapUser(row: Partial<SessionUserRow> | null | undefined): AppUser | null {
  if (!row) return null;

  return {
    id: Number(row.id),
    name: String(row.name || ""),
    email: String(row.email || ""),
    is_owner: !!row.is_owner,
    is_admin: !!row.is_admin,
    two_factor_enabled: !!row.two_factor_enabled,
    is_seller: !!row.is_seller,
    seller_access: !!row.seller_access || !!row.is_seller,
    nickname: String(row.nickname || ""),
    avatar_url: String(row.avatar_url || ""),
    theme: String(row.theme || "dark") || "dark",
    lang: String(row.lang || "ru") || "ru",
    email_verified: !!row.email_verified,
    status: String(row.status || "active") || "active",
    banned_until: row.banned_until || null,
    warning_count: Number(row.warning_count || 0),
  };
}

export async function readSessionWithUser(pool: Pool, token: string | null) {
  if (!token) return null;

  const tokenHash = hashSessionToken(token);
  const result = await pool.query<SessionUserRow>(
    `SELECT s.token, s.user_id, s.expires_at,
       u.id, u.name, u.email, COALESCE(u.is_owner, false) AS is_owner, u.is_admin,
            COALESCE(u.two_factor_enabled, false) AS two_factor_enabled,
            u.is_seller,
            (COALESCE(u.seller_access, false) OR COALESCE(u.is_seller, false)) AS seller_access,
            COALESCE(u.nickname, '') AS nickname,
            COALESCE(u.avatar_url, '') AS avatar_url,
            COALESCE(u.theme, 'dark') AS theme,
            COALESCE(u.lang, 'ru') AS lang,
            COALESCE(u.email_verified, false) AS email_verified,
            COALESCE(u.status, 'active') AS status,
            u.banned_until,
            COALESCE(u.warning_count, 0) AS warning_count
       FROM sessions s
       JOIN users u ON u.id = s.user_id
      WHERE s.token IN ($1, $2)
      LIMIT 1`,
    [tokenHash, token],
  );

  const row = result.rows[0] || null;
  if (!row) return null;

  const expiresAt = new Date(row.expires_at).getTime();
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    return null;
  }

  return row;
}

export async function attachUserFromToken(
  pool: Pool,
  req: AuthenticatedRequest,
  token: string | null,
) {
  const row = await readSessionWithUser(pool, token);
  if (!row) return null;

  req.user = mapUser(row);
  req.token = token || undefined;
  return req.user;
}

export async function resolveOptionalUserId(pool: Pool, authorizationHeader?: string | null) {
  try {
    const token = extractBearerToken(authorizationHeader);
    if (!token) return null;

    const row = await readSessionWithUser(pool, token);
    return row ? Number(row.user_id) || null : null;
  } catch (error) {
    console.error("resolveOptionalUserId error:", error);
    return null;
  }
}
