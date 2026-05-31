import crypto from "crypto";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const STEP_SECONDS = 30;
const DIGITS = 6;

function base32Encode(buffer: Buffer) {
  let bits = "";
  let output = "";

  for (const byte of buffer) {
    bits += byte.toString(2).padStart(8, "0");
  }

  for (let i = 0; i < bits.length; i += 5) {
    const chunk = bits.slice(i, i + 5).padEnd(5, "0");
    output += BASE32_ALPHABET[parseInt(chunk, 2)];
  }

  return output;
}

function base32Decode(value: string) {
  const clean = String(value || "").replace(/=+$/g, "").replace(/\s+/g, "").toUpperCase();
  let bits = "";

  for (const char of clean) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index < 0) continue;
    bits += index.toString(2).padStart(5, "0");
  }

  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }

  return Buffer.from(bytes);
}

function generateCode(secret: string, counter: number) {
  const key = base32Decode(secret);
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));

  const hmac = crypto.createHmac("sha1", key).update(msg).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  return String(binary % 10 ** DIGITS).padStart(DIGITS, "0");
}

export function generateTotpSecret() {
  return base32Encode(crypto.randomBytes(20));
}

export function verifyTotpCode(secret: string, code: string, window = 1) {
  const cleanCode = String(code || "").replace(/\s+/g, "");
  if (!/^\d{6}$/.test(cleanCode)) return false;

  const counter = Math.floor(Date.now() / 1000 / STEP_SECONDS);
  for (let delta = -window; delta <= window; delta += 1) {
    const expected = generateCode(secret, counter + delta);
    if (crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(cleanCode))) return true;
  }
  return false;
}

export function buildTotpOtpAuthUrl(input: { secret: string; email: string; issuer?: string }) {
  const issuer = input.issuer || "Dayen";
  const label = `${issuer}:${input.email}`;
  const params = new URLSearchParams({
    secret: input.secret,
    issuer,
    algorithm: "SHA1",
    digits: String(DIGITS),
    period: String(STEP_SECONDS),
  });
  return `otpauth://totp/${encodeURIComponent(label)}?${params.toString()}`;
}
