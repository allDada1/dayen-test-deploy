import type { NextFunction, Response } from "express";
import type { Pool } from "pg";

import type { AuthenticatedRequest } from "../types/app";
import { forbidden, serverError, unauthorized } from "../utils/http";
import {
  attachUserFromToken,
  extractBearerToken,
  extractFlexibleToken,
} from "./auth-helpers";
import { readSessionCookie } from "../utils/auth-cookies";

type AuthMiddlewareOptions = {
  pool: Pool;
};

function isModerationInfoRoute(req: AuthenticatedRequest) {
  const path = req.originalUrl || req.path || "";
  return (
    (req.method === "GET" && path.includes("/api/auth/me")) ||
    path.includes("/api/notifications")
  );
}

async function authorize(req: AuthenticatedRequest, res: Response, pool: Pool, token: string | null) {
  if (!token) {
    unauthorized(res, "no_token");
    return false;
  }

  const user = await attachUserFromToken(pool, req, token);
  if (!user) {
    unauthorized(res, "bad_token");
    return false;
  }

  const canReadModerationInfo = isModerationInfoRoute(req);

  if (!user.is_admin && !user.is_owner && user.status === "banned" && !canReadModerationInfo) {
    unauthorized(res, "account_banned");
    return false;
  }

  if (!user.is_admin && !user.is_owner && user.status === "temporarily_banned") {
    const bannedUntil = user.banned_until ? new Date(user.banned_until).getTime() : 0;
    if ((!bannedUntil || bannedUntil > Date.now()) && !canReadModerationInfo) {
      unauthorized(res, "account_temporarily_banned", { banned_until: user.banned_until });
      return false;
    }
  }

  return true;
}

export function createAuthMiddleware({ pool }: AuthMiddlewareOptions) {
  async function authRequired(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const token = extractBearerToken(req.headers.authorization) || readSessionCookie(req);
      const ok = await authorize(req, res, pool, token);
      if (!ok) return;

      return next();
    } catch (error) {
      console.error("authRequired error:", error);
      return serverError(res);
    }
  }

  async function authRequiredFlexible(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const token = extractFlexibleToken(req);
      const ok = await authorize(req, res, pool, token);
      if (!ok) return;

      return next();
    } catch (error) {
      console.error("authRequiredFlexible error:", error);
      return serverError(res);
    }
  }

  async function optionalAuth(req: AuthenticatedRequest, _res: Response, next: NextFunction) {
    try {
      const token = extractBearerToken(req.headers.authorization);
      if (!token) return next();

      await attachUserFromToken(pool, req, token);
      return next();
    } catch (error) {
      console.error("optionalAuth error:", error);
      return next();
    }
  }

  function adminRequired(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    if (!req.user?.is_admin && !req.user?.is_owner) {
      return forbidden(res, "admin_only");
    }
    if (!req.user.two_factor_enabled) {
      return forbidden(res, "two_factor_setup_required");
    }

    return next();
  }

  function ownerRequired(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    if (!req.user?.is_owner) {
      return forbidden(res, "owner_only");
    }
    if (!req.user.two_factor_enabled) {
      return forbidden(res, "two_factor_setup_required");
    }

    return next();
  }

  return {
    authRequired,
    authRequiredFlexible,
    optionalAuth,
    adminRequired,
    ownerRequired,
  };
}
