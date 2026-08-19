import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

// Configure S3 Client for Railway Bucket / Cloudflare R2 / AWS S3
const r2Endpoint =
  process.env.RAILWAY_BUCKET_ENDPOINT ||
  process.env.CLOUDFLARE_R2_ENDPOINT ||
  process.env.AWS_S3_ENDPOINT ||
  process.env.AWS_ENDPOINT_URL ||
  process.env.S3_ENDPOINT;

const accessKeyId =
  process.env.RAILWAY_BUCKET_ACCESS_KEY_ID ||
  process.env.CLOUDFLARE_R2_ACCESS_KEY_ID ||
  process.env.AWS_ACCESS_KEY_ID ||
  process.env.S3_ACCESS_KEY_ID;

const secretAccessKey =
  process.env.RAILWAY_BUCKET_SECRET_ACCESS_KEY ||
  process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY ||
  process.env.AWS_SECRET_ACCESS_KEY ||
  process.env.S3_SECRET_ACCESS_KEY;

const bucketName =
  process.env.RAILWAY_BUCKET_NAME ||
  process.env.CLOUDFLARE_R2_BUCKET_NAME ||
  process.env.AWS_S3_BUCKET ||
  process.env.S3_BUCKET;

const publicUrl =
  process.env.RAILWAY_BUCKET_PUBLIC_URL ||
  process.env.CLOUDFLARE_R2_PUBLIC_URL ||
  process.env.AWS_S3_PUBLIC_URL ||
  process.env.S3_PUBLIC_URL;

let s3Client: S3Client | null = null;

if (r2Endpoint && accessKeyId && secretAccessKey) {
  s3Client = new S3Client({
    endpoint: r2Endpoint,
    region: process.env.AWS_REGION || "us-east-1",
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
    forcePathStyle: true, // Required for Railway S3 / MinIO buckets
  });
}

/**
 * Uploads a base64 encoded image exclusively to Railway Bucket / S3 Storage.
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
 * Uploads a Buffer exclusively to Railway Bucket / S3 Storage.
 */
export async function uploadBufferToR2(
  buffer: Buffer,
  fileName: string,
  contentType: string = "image/png",
): Promise<string | null> {
  if (!s3Client || !bucketName) {
    if (process.env.NODE_ENV === "test") {
      console.warn(
        "[Bucket Storage] Skipping S3 bucket upload in test environment.",
      );
      return `/mock-bucket/${fileName}`;
    }
    throw new Error(
      "[Bucket Storage Error] Railway Bucket / S3 Storage is not configured. Please add Railway Bucket environment variables (RAILWAY_BUCKET_ENDPOINT, RAILWAY_BUCKET_ACCESS_KEY_ID, RAILWAY_BUCKET_SECRET_ACCESS_KEY, RAILWAY_BUCKET_NAME).",
    );
  }

  try {
    const cleanKey = fileName.replace(/^\/+/, "");

    await s3Client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: cleanKey,
        Body: buffer,
        ContentType: contentType,
      }),
    );

    if (publicUrl) {
      const cleanPublicUrl = publicUrl.endsWith("/")
        ? publicUrl.slice(0, -1)
        : publicUrl;
      return `${cleanPublicUrl}/${cleanKey}`;
    }

    const cleanEndpoint = r2Endpoint?.endsWith("/")
      ? r2Endpoint.slice(0, -1)
      : r2Endpoint;
    return `${cleanEndpoint}/${bucketName}/${cleanKey}`;
  } catch (error: any) {
    console.error(
      "[Bucket Storage Error] Failed to upload asset to Railway Bucket / S3:",
      error,
    );
    throw new Error(`Bucket upload failed: ${error.message}`);
  }
}

/**
 * Deletes an object file from Railway Bucket / S3 Storage given its key or URL.
 */
export async function deleteFileFromR2(fileUrlOrKey: string): Promise<boolean> {
  if (!s3Client || !bucketName) {
    return false;
  }

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
    console.error(
      "[Bucket Storage Error] Failed to delete file from Railway Bucket / S3:",
      error,
    );
    return false;
  }
}
