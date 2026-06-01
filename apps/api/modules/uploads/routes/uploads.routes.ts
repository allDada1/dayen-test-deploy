import express from "express";

import type { NextFunction, Response } from "express";
import { uploadRateLimit } from "../../../middleware/rate-limit";
import { isCloudinaryConfigured, uploadImageToCloudinary } from "../../../services/media-storage";
import type { AppUser, AuthenticatedRequest } from "../../../types/app";
import { badRequest, fail, ok } from "../../../utils/http";
import {
  buildUploadUrl,
  getRequestUploadBucket,
  removeUploadedFile,
  setUploadBucketFromQuery,
  UPLOAD_BUCKETS,
  validateUploadedImageFile,
} from "../../../utils/upload";

type UploadMiddleware = {
  single: (fieldName: string) => any;
};

type AuthMiddleware = (req: AuthenticatedRequest, res: Response, next: NextFunction) => unknown;

type UploadsRouterOptions = {
  authRequired: AuthMiddleware;
  upload: UploadMiddleware;
};

export function canUserUploadToBucket(
  user: Pick<AppUser, "is_owner" | "is_admin" | "two_factor_enabled" | "is_seller" | "seller_access">,
  bucket: string,
) {
  const privilegedUploadAccess = user.is_owner || (user.is_admin && user.two_factor_enabled);

  if (bucket === UPLOAD_BUCKETS.support) return true;
  if (bucket === UPLOAD_BUCKETS.avatars) return true;
  if (bucket === UPLOAD_BUCKETS.sellerAvatars || bucket === UPLOAD_BUCKETS.sellerBanners) return true;
  if (bucket === UPLOAD_BUCKETS.products) return privilegedUploadAccess || user.seller_access || user.is_seller;
  if (bucket === UPLOAD_BUCKETS.tiles || bucket === UPLOAD_BUCKETS.misc) return privilegedUploadAccess;

  return false;
}

export function createUploadsRouter({ authRequired, upload }: UploadsRouterOptions) {
  const router = express.Router();

  function requireUploadAccess(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    const user = req.user;
    if (!user) return fail(res, 401, "unauthorized");

    const bucket = getRequestUploadBucket(req);
    if (!canUserUploadToBucket(user, bucket)) return fail(res, 403, "no_access");

    return next();
  }

  router.post(
    "/uploads/image",
    authRequired,
    setUploadBucketFromQuery(UPLOAD_BUCKETS.products),
    requireUploadAccess,
    uploadRateLimit,
    upload.single("image"),
    async (req: AuthenticatedRequest & { file?: { filename?: string; path?: string; mimetype?: string } }, res) => {
      const bucket = getRequestUploadBucket(req);

      if (!req.file?.filename) {
        return badRequest(res, "no_file");
      }

      if (!(await validateUploadedImageFile(req.file))) {
        await removeUploadedFile(req.file);
        return badRequest(res, "bad_file_type");
      }

      if (isCloudinaryConfigured()) {
        try {
          const url = await uploadImageToCloudinary(req.file, bucket);
          await removeUploadedFile(req.file);
          return ok(res, { url });
        } catch (error) {
          await removeUploadedFile(req.file);
          console.error("POST /api/uploads/image cloudinary error:", error);
          return fail(res, 500, "upload_failed");
        }
      }

      return ok(res, { url: buildUploadUrl(bucket, req.file.filename) });
    },
  );

  return router;
}
