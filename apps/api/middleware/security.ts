import type { NextFunction, Request, Response } from "express";
import { fail } from "../utils/http";

function parseOrigins(value: string) {
  return value
    .split(",")
    .map((item) => item.trim().replace(/\/$/, ""))
    .filter(Boolean);
}

export function getAllowedOrigins() {
  const appBaseUrl = String(process.env.APP_BASE_URL || "").trim();
  const configured = String(process.env.CORS_ORIGINS || process.env.FRONTEND_ORIGIN || "");
  const allowLocalhost =
    process.env.NODE_ENV !== "production" ||
    ["1", "true", "yes"].includes(String(process.env.ALLOW_LOCALHOST_ORIGINS || "").trim().toLowerCase());

  const origins = [
    ...parseOrigins(configured),
    ...parseOrigins(appBaseUrl),
  ];

  if (allowLocalhost) {
    origins.push("http://localhost:5173", "http://127.0.0.1:5173");
  }

  return new Set(origins);
}

export function securityHeaders(_req: Request, res: Response, next: NextFunction) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Cross-Origin-Resource-Policy", "same-origin");

  const csp = [
    "default-src 'self'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "img-src 'self' data: blob: https:",
    "script-src 'self' https://accounts.google.com",
    "style-src 'self' 'unsafe-inline'",
    "connect-src 'self' https://www.googleapis.com https://accounts.google.com",
  ].join("; ");
  res.setHeader("Content-Security-Policy", csp);

  next();
}

export function csrfOriginGuard(req: Request, res: Response, next: NextFunction) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method.toUpperCase())) return next();
  if (!String(req.path || req.originalUrl || "").startsWith("/api")) return next();

  const origin = String(req.headers.origin || "").trim().replace(/\/$/, "");
  const referer = String(req.headers.referer || "").trim();
  let refererOrigin = "";
  try {
    refererOrigin = referer ? new URL(referer).origin.replace(/\/$/, "") : "";
  } catch {
    return fail(res, 403, "bad_origin");
  }
  const sourceOrigin = origin || refererOrigin;

  if (!sourceOrigin) return next();
  if (getAllowedOrigins().has(sourceOrigin)) return next();

  return fail(res, 403, "bad_origin");
}
