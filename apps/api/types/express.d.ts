import type { AppUser } from "./app";

declare global {
  namespace Express {
    interface Request {
      user?: AppUser | null;
      token?: string;
    }
  }
}

export {};
