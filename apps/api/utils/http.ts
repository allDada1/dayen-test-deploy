import type { Response } from "express";

type ResponseBody = Record<string, unknown>;

function errorBody(error: string, details?: unknown) {
  return details === undefined
    ? { ok: false, error }
    : { ok: false, error, details };
}

export function ok(res: Response, data: ResponseBody = {}) {
  return res.json({ ok: true, ...data });
}

export function created(res: Response, data: ResponseBody = {}) {
  return res.status(201).json({ ok: true, ...data });
}

export function badRequest(res: Response, error = "bad_request", details?: unknown) {
  return res.status(400).json(errorBody(error, details));
}

export function unauthorized(res: Response, error = "unauthorized", details?: unknown) {
  return res.status(401).json(errorBody(error, details));
}

export function forbidden(res: Response, error = "forbidden", details?: unknown) {
  return res.status(403).json(errorBody(error, details));
}

export function notFound(res: Response, error = "not_found", details?: unknown) {
  return res.status(404).json(errorBody(error, details));
}

export function conflict(res: Response, error = "conflict", details?: unknown) {
  return res.status(409).json(errorBody(error, details));
}

export function serverError(res: Response, error = "server_error", details?: unknown) {
  return res.status(500).json(errorBody(error, details));
}

export function dbError(res: Response, err: unknown, fallback = "db_error") {
  return res.status(500).json({
    ok: false,
    error: fallback,
    details: err instanceof Error ? err.message : String(err),
  });
}

export function fail(res: Response, status: number, error: string, details?: unknown) {
  return res.status(status).json(errorBody(error, details));
}
