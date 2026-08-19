import fs from "node:fs";
import path from "node:path";
import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

// Configure S3 client for Cloudflare R2 or AWS S3
const r2Endpoint =
  process.env.CLOUDFLARE_R2_ENDPOINT || process.env.AWS_S3_ENDPOINT;
const accessKeyId =
  process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey =
  process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY ||
  process.env.AWS_SECRET_ACCESS_KEY;
const bucketName =
  process.env.CLOUDFLARE_R2_BUCKET_NAME || process.env.AWS_S3_BUCKET;
const publicUrl =
  process.env.CLOUDFLARE_R2_PUBLIC_URL || process.env.AWS_S3_PUBLIC_URL;

let s3Client: S3Client | null = null;

if (r2Endpoint && accessKeyId && secretAccessKey) {
  s3Client = new S3Client({
    endpoint: r2Endpoint,
    region: "auto",
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
}

const LOCAL_UPLOADS_DIR = path.join(process.cwd(), "public", "uploads");

function ensureLocalDirExists(dirPath: string) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Uploads a base64 encoded image to Cloudflare R2 / S3 or Local Railway Persistent Volume.
 * Returns the public URL of the uploaded object, or local fallback path if credentials are missing.
 */
export async function uploadImageToR2(
  base64Data: string,
  fileName: string,
): Promise<string | null> {
  const cleanBase64 = base64Data.replace(/^data:image\/\w+;base64,/, "");
  const buffer = Buffer.from(cleanBase64, "base64");
  return uploadBufferToR2(buffer, fileName, "image/png");
}

/**
 * Uploads a Buffer to Cloudflare R2 / S3 or Local Railway Persistent Volume.
 */
export async function uploadBufferToR2(
  buffer: Buffer,
  fileName: string,
  contentType: string = "image/png",
): Promise<string | null> {
  // 1. If S3 / R2 is configured, upload to S3 / Cloudflare R2
  if (s3Client && bucketName && publicUrl) {
    try {
      await s3Client.send(
        new PutObjectCommand({
          Bucket: bucketName,
          Key: fileName,
          Body: buffer,
          ContentType: contentType,
        }),
      );

      const cleanPublicUrl = publicUrl.endsWith("/")
        ? publicUrl.slice(0, -1)
        : publicUrl;
      return `${cleanPublicUrl}/${fileName}`;
    } catch (error) {
      console.error(
        "[Storage Error] Cloudflare R2 / S3 upload failed, attempting local volume fallback:",
        error,
      );
    }
  }

  // 2. Local Railway Persistent Volume Fallback (/app/public/uploads)
  try {
    const sanitizedRelativePath = fileName
      .split("/")
      .map((part) => part.replace(/[^a-zA-Z0-9_.-]/g, "_"))
      .join("/");

    const filePath = path.join(LOCAL_UPLOADS_DIR, sanitizedRelativePath);
    const fileDir = path.dirname(filePath);

    ensureLocalDirExists(fileDir);
    fs.writeFileSync(filePath, buffer);

    console.log(
      `[Storage] Asset stored locally on Railway persistent volume: /uploads/${sanitizedRelativePath}`,
    );
    return `/uploads/${sanitizedRelativePath}`;
  } catch (localErr) {
    console.error(
      "[Local Storage Error] Failed to write asset to local volume:",
      localErr,
    );
    return null;
  }
}

/**
 * Deletes an object file from Cloudflare R2 / S3 or Local Railway Persistent Volume.
 */
export async function deleteFileFromR2(fileUrlOrKey: string): Promise<boolean> {
  // 1. If S3 / R2 configured
  if (s3Client && bucketName) {
    try {
      let key = fileUrlOrKey;
      if (publicUrl && key.startsWith(publicUrl)) {
        key = key.replace(publicUrl, "").replace(/^\/+/, "");
      }

      await s3Client.send(
        new DeleteObjectCommand({
          Bucket: bucketName,
          Key: key,
        }),
      );

      return true;
    } catch (error) {
      console.error("[Storage Error] S3 / R2 delete failed:", error);
    }
  }

  // 2. Local Volume Deletion
  try {
    const cleanPath = fileUrlOrKey
      .replace(/^\/uploads\//, "")
      .split("/")
      .map((part) => part.replace(/[^a-zA-Z0-9_.-]/g, "_"))
      .join("/");

    const filePath = path.join(LOCAL_UPLOADS_DIR, cleanPath);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
  } catch (err) {
    console.error("[Local Storage Error] Failed to delete local file:", err);
  }

  return false;
}
