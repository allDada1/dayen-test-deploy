import crypto from "crypto";
import fs from "fs";
import path from "path";
import multer from "multer";
import type { Request, RequestHandler } from "express";

export const ALLOWED_IMAGE_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/x-icon",
  "image/vnd.microsoft.icon",
  "image/gif",
]);

export const ALLOWED_IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".ico", ".gif"]);

export const UPLOAD_BUCKETS = {
  products: "products",
  tiles: "tiles",
  avatars: "avatars",
  sellerAvatars: "seller-avatars",
  sellerBanners: "seller-banners",
  support: "support",
  misc: "misc",
} as const;

export type UploadBucket = (typeof UPLOAD_BUCKETS)[keyof typeof UPLOAD_BUCKETS];

const ALLOWED_UPLOAD_BUCKETS = new Set<string>(Object.values(UPLOAD_BUCKETS));

type UploadRequest = Request & {
  uploadBucket?: UploadBucket;
};

type UploadedFileLike = {
  path?: string;
  filename?: string;
  mimetype?: string;
};

export function ensureDir(dirPath: string) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function getSafeImageExtension(filename: string) {
  const ext = path.extname(filename || "").toLowerCase();
  return ALLOWED_IMAGE_EXTENSIONS.has(ext) ? ext : ".png";
}

export function normalizeUploadBucket(value: unknown): UploadBucket {
  const bucket = String(value || "").trim();
  return ALLOWED_UPLOAD_BUCKETS.has(bucket) ? (bucket as UploadBucket) : UPLOAD_BUCKETS.misc;
}

export function setUploadBucket(bucket: UploadBucket): RequestHandler {
  return (req, _res, next) => {
    (req as UploadRequest).uploadBucket = bucket;
    next();
  };
}

export function setUploadBucketFromQuery(defaultBucket: UploadBucket = UPLOAD_BUCKETS.misc): RequestHandler {
  return (req, _res, next) => {
    (req as UploadRequest).uploadBucket = normalizeUploadBucket(req.query.bucket || defaultBucket);
    next();
  };
}

export function getRequestUploadBucket(req: Request): UploadBucket {
  return normalizeUploadBucket((req as UploadRequest).uploadBucket);
}

export function buildUploadUrl(bucket: UploadBucket, filename: string) {
  return `/uploads/${bucket}/${filename}`;
}

function isAllowedImageBytes(buffer: Buffer, mimetype?: string) {
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return mimetype === "image/png";
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return mimetype === "image/jpeg";
  }
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return mimetype === "image/webp";
  }
  if (buffer.length >= 6) {
    const header = buffer.subarray(0, 6).toString("ascii");
    if (header === "GIF87a" || header === "GIF89a") return mimetype === "image/gif";
  }
  if (buffer.length >= 4 && buffer[0] === 0x00 && buffer[1] === 0x00 && buffer[2] === 0x01 && buffer[3] === 0x00) {
    return mimetype === "image/x-icon" || mimetype === "image/vnd.microsoft.icon";
  }
  return false;
}

export async function validateUploadedImageFile(file?: UploadedFileLike) {
  if (!file?.path) return false;

  try {
    const handle = await fs.promises.open(file.path, "r");
    try {
      const buffer = Buffer.alloc(16);
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
      return isAllowedImageBytes(buffer.subarray(0, bytesRead), file.mimetype);
    } finally {
      await handle.close();
    }
  } catch {
    return false;
  }
}

export async function removeUploadedFile(file?: UploadedFileLike) {
  if (!file?.path) return;
  await fs.promises.unlink(file.path).catch(() => undefined);
}

export function createUploadMiddleware(uploadsDir: string) {
  ensureDir(uploadsDir);

  const storage = multer.diskStorage({
    destination: (req, _file, cb) => {
      const bucket = getRequestUploadBucket(req);
      const destinationDir = path.join(uploadsDir, bucket);
      ensureDir(destinationDir);
      cb(null, destinationDir);
    },
    filename: (req, file, cb) => {
      const bucket = getRequestUploadBucket(req);
      const safeExt = getSafeImageExtension(file?.originalname || "");
      const prefix = bucket.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "upload";
      cb(null, `${prefix}_${Date.now()}_${crypto.randomBytes(6).toString("hex")}${safeExt}`);
    },
  });

  return multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      const isAllowed = ALLOWED_IMAGE_MIME_TYPES.has(file.mimetype);
      cb(isAllowed ? null : new Error("bad_file_type"), isAllowed);
    },
  });
}
