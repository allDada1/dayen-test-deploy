import type { NextFunction, Request, Response } from "express";
import { fail } from "../utils/http";

type Bucket = {
  count: number;
  resetAt: number;
};

type RateLimitOptions = {
  windowMs: number;
  max: number;
  keyPrefix: string;
  key?: (req: Request) => string;
};

const buckets = new Map<string, Bucket>();

function getIp(req: Request) {
  return String(req.ip || req.socket.remoteAddress || "unknown");
}

setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}, 60_000).unref();

export function createRateLimit(options: RateLimitOptions) {
  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const rawKey = options.key ? options.key(req) : getIp(req);
    const key = `${options.keyPrefix}:${rawKey}`;
    const current = buckets.get(key);

    if (!current || current.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + options.windowMs });
      return next();
    }

    current.count += 1;
    if (current.count > options.max) {
      const retryAfter = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
      res.setHeader("Retry-After", String(retryAfter));
      return fail(res, 429, "rate_limited", { retry_after: retryAfter });
    }

    return next();
  };
}

export const authLoginRateLimit = createRateLimit({
  keyPrefix: "auth-login",
  windowMs: 15 * 60 * 1000,
  max: 8,
  key: (req) => {
    const email = String((req.body as { email?: unknown })?.email || "").trim().toLowerCase();
    return `${getIp(req)}:${email || "no-email"}`;
  },
});

export const authSensitiveRateLimit = createRateLimit({
  keyPrefix: "auth-sensitive",
  windowMs: 15 * 60 * 1000,
  max: 6,
});

export const authRegisterRateLimit = createRateLimit({
  keyPrefix: "auth-register",
  windowMs: 30 * 60 * 1000,
  max: 10,
});

export const uploadRateLimit = createRateLimit({
  keyPrefix: "upload",
  windowMs: 60 * 60 * 1000,
  max: 60,
  key: (req) => `${getIp(req)}:${String((req as { user?: { id?: unknown } }).user?.id || "anon")}`,
});

export const supportTicketRateLimit = createRateLimit({
  keyPrefix: "support-ticket",
  windowMs: 60 * 60 * 1000,
  max: 6,
  key: (req) => {
    const email = String((req.body as { email?: unknown })?.email || "").trim().toLowerCase();
    const userId = String((req as { user?: { id?: unknown } }).user?.id || "guest");
    return `${getIp(req)}:${userId}:${email || "no-email"}`;
  },
});

export const productFeedbackRateLimit = createRateLimit({
  keyPrefix: "product-feedback",
  windowMs: 60 * 60 * 1000,
  max: 30,
  key: (req) => `${getIp(req)}:${String((req as { user?: { id?: unknown } }).user?.id || "anon")}`,
});
