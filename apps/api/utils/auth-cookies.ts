import type { Request, Response } from "express";

const SESSION_COOKIE = "dayen_session";
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

function isSecureCookieEnabled(req?: Request) {
  const forced = String(process.env.COOKIE_SECURE || "").trim().toLowerCase();
  if (["1", "true", "yes"].includes(forced)) return true;
  if (["0", "false", "no"].includes(forced)) return false;
  return process.env.NODE_ENV === "production" || req?.secure || req?.headers["x-forwarded-proto"] === "https";
}

function getCookieSameSite(req?: Request) {
  const configured = String(process.env.COOKIE_SAMESITE || "").trim().toLowerCase();
  if (configured === "none") return "none";
  if (configured === "strict") return "strict";
  if (configured === "lax") return "lax";
  return isSecureCookieEnabled(req) ? "none" : "lax";
}

export function readCookie(req: Request, name: string) {
  const header = String(req.headers.cookie || "");
  if (!header) return "";

  for (const chunk of header.split(";")) {
    const [rawKey, ...rawValue] = chunk.trim().split("=");
    if (rawKey === name) return decodeURIComponent(rawValue.join("=") || "");
  }
  return "";
}

export function readSessionCookie(req: Request) {
  return readCookie(req, SESSION_COOKIE);
}

export function setSessionCookie(res: Response, token: string, req?: Request) {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: isSecureCookieEnabled(req),
    sameSite: getCookieSameSite(req),
    path: "/",
    maxAge: THIRTY_DAYS_MS,
  });
}

export function clearSessionCookie(res: Response, req?: Request) {
  res.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    secure: isSecureCookieEnabled(req),
    sameSite: getCookieSameSite(req),
    path: "/",
  });
}
