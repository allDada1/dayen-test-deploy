import type { Request } from "express";

export type AppUser = {
  id: number;
  name: string;
  email: string;
  is_owner: boolean;
  is_admin: boolean;
  two_factor_enabled: boolean;
  is_seller: boolean;
  seller_access: boolean;
  nickname: string;
  avatar_url: string;
  theme: string;
  lang: string;
  email_verified: boolean;
  status: string;
  banned_until: string | Date | null;
  warning_count: number;
};

export type AuthenticatedRequest = Request & {
  user?: AppUser | null;
  token?: string;
};

export type SessionUserRow = {
  token: string;
  user_id: number | string;
  expires_at: string | Date;
  id: number | string;
  name: string | null;
  email: string | null;
  is_owner: boolean | null;
  is_admin: boolean | null;
  two_factor_enabled: boolean | null;
  is_seller: boolean | null;
  seller_access: boolean | null;
  nickname: string | null;
  avatar_url: string | null;
  theme: string | null;
  lang: string | null;
  email_verified: boolean | null;
  status: string | null;
  banned_until: string | Date | null;
  warning_count: number | string | null;
};
