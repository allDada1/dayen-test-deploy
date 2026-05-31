import { AsyncLocalStorage } from "async_hooks";
import type { NextFunction, Request, Response } from "express";

type RequestContext = {
  ip: string;
  userAgent: string;
};

const requestStore = new AsyncLocalStorage<RequestContext>();

export function requestContext(req: Request, _res: Response, next: NextFunction) {
  requestStore.run(
    {
      ip: String(req.ip || req.socket.remoteAddress || ""),
      userAgent: String(req.headers["user-agent"] || "").slice(0, 500),
    },
    next,
  );
}

export function getRequestContext() {
  return requestStore.getStore() || null;
}
