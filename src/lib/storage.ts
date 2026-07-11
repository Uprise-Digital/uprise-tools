import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

// Configure S3 client for Cloudflare R2
const r2Endpoint = process.env.CLOUDFLARE_R2_ENDPOINT;
const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
const bucketName = process.env.CLOUDFLARE_R2_BUCKET_NAME;
const publicUrl = process.env.CLOUDFLARE_R2_PUBLIC_URL;

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

/**
 * Uploads a base64 encoded image to Cloudflare R2.
 * Returns the public URL of the uploaded object, or null if credentials are missing or upload fails.
 */
export async function uploadImageToR2(
  base64Data: string,
  fileName: string,
): Promise<string | null> {
  if (!s3Client || !bucketName || !publicUrl) {
    console.warn("[R2 Storage] R2 Storage is not configured. Skipping upload.");
    return null;
  }

  try {
    const buffer = Buffer.from(base64Data, "base64");

    await s3Client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: fileName,
        Body: buffer,
        ContentType: "image/png",
      }),
    );

    // Build public access URL
    const cleanPublicUrl = publicUrl.endsWith("/")
      ? publicUrl.slice(0, -1)
      : publicUrl;
    return `${cleanPublicUrl}/${fileName}`;
  } catch (error) {
    console.error("[R2 Storage Error] Failed to upload image to R2:", error);
    return null;
  }
}
