import crypto from "crypto";

export function hashPassword(password: string, saltHex: string) {
  const salt = Buffer.from(saltHex, "hex");
  const hash = crypto.pbkdf2Sync(password, salt, 120000, 32, "sha256");
  return hash.toString("hex");
}

export function makeSalt() {
  return crypto.randomBytes(16).toString("hex");
}

export function makeToken() {
  return crypto.randomBytes(24).toString("hex");
}

export function hashSessionToken(token: string) {
  return crypto.createHash("sha256").update(String(token || "")).digest("hex");
}

export function nowPlusDays(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}
