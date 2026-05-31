type StringOptions = {
  min?: number;
  max?: number;
  normalize?: boolean;
};

type SlugOptions = {
  min?: number;
  max?: number;
};

type RatingOptions = {
  min?: number;
  max?: number;
};

export function toPositiveInt(value: unknown) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export function toNonNegativeInt(value: unknown) {
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 ? n : null;
}

export function getTrimmedString(value: unknown, fallback = "") {
  return String(value ?? fallback).trim();
}

export function normalizeSpaces(value: unknown) {
  return getTrimmedString(value).replace(/\s+/g, " ");
}

export function parseRequiredString(value: unknown, { min = 1, max = Infinity, normalize = false }: StringOptions = {}) {
  const s = normalize ? normalizeSpaces(value) : getTrimmedString(value);
  if (s.length < min || s.length > max) return null;
  return s;
}

export function parseOptionalString(value: unknown, { max = Infinity, normalize = false }: Omit<StringOptions, "min"> = {}) {
  if (value == null) return "";
  const s = normalize ? normalizeSpaces(value) : getTrimmedString(value);
  if (s.length > max) return null;
  return s;
}

export function parseEnum(value: unknown, allowed: string[], fallback: string | null = null) {
  const s = getTrimmedString(value).toLowerCase();
  return allowed.includes(s) ? s : fallback;
}

export function parseEmail(value: unknown) {
  const s = getTrimmedString(value).toLowerCase();
  if (!s || s.length < 5 || !/^\S+@\S+\.\S+$/.test(s)) return null;
  const domain = s.split("@")[1] || "";
  const blockedDomains = new Set([
    "gmai.com",
    "gmial.com",
    "gnail.com",
    "gmail.ru",
    "mail.con",
    "mai.com",
    "yadnex.ru",
    "yanedx.ru",
    "hotnail.com",
  ]);
  if (blockedDomains.has(domain)) return null;
  return s;
}

export function parseSlug(value: unknown, { min = 3, max = 40 }: SlugOptions = {}) {
  const s = getTrimmedString(value).toLowerCase();
  if (s.length < min || s.length > max) return null;
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(s)) return null;
  return s;
}

export function parsePriceNumber(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function parseStockNumber(value: unknown, fallback = 0) {
  const n = Number(value ?? fallback);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function parseRating(value: unknown, { min = 1, max = 5 }: RatingOptions = {}) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n) || n < min || n > max) return null;
  return n;
}

export function parseIdArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((n) => toPositiveInt(n)).filter(Boolean))] as number[];
}
