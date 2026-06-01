import { v2 as cloudinary } from "cloudinary";

type CloudinaryUploadFile = {
  path?: string;
};

const cloudName = String(process.env.CLOUDINARY_CLOUD_NAME || "").trim();
const apiKey = String(process.env.CLOUDINARY_API_KEY || "").trim();
const apiSecret = String(process.env.CLOUDINARY_API_SECRET || "").trim();
const baseFolder = String(process.env.CLOUDINARY_FOLDER || "dayen").trim().replace(/^\/+|\/+$/g, "");

export function isCloudinaryConfigured() {
  return Boolean(cloudName && apiKey && apiSecret);
}

export async function uploadImageToCloudinary(file: CloudinaryUploadFile, bucket: string) {
  if (!file.path) throw new Error("missing_upload_file");
  if (!isCloudinaryConfigured()) throw new Error("cloudinary_not_configured");

  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true,
  });

  const safeBucket = String(bucket || "uploads").replace(/[^a-z0-9_-]+/gi, "-").replace(/^-|-$/g, "") || "uploads";
  const folder = baseFolder ? `${baseFolder}/${safeBucket}` : safeBucket;

  const result = await cloudinary.uploader.upload(file.path, {
    folder,
    resource_type: "image",
    use_filename: false,
    unique_filename: true,
    overwrite: false,
  });

  return result.secure_url;
}
