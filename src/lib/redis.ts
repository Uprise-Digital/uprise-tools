import Redis from "ioredis";

const redisUrl =
  process.env.REDIS_URL ||
  process.env.UPSTASH_REDIS_URL ||
  process.env.REDIS_PRIVATE_URL ||
  process.env.REDISURL ||
  process.env.REDIS_PUBLIC_URL;

export function createRedisConnection() {
  if (!redisUrl) {
    console.warn(
      "[Redis] Warning: No REDIS_URL found in environment variables. Falling back to local redis://localhost:6379",
    );
  }

  const client = new Redis(redisUrl || "redis://localhost:6379", {
    maxRetriesPerRequest: null, // Required by BullMQ
    enableReadyCheck: false,
    tls: redisUrl?.startsWith("rediss://") ? {} : undefined,
  });

  client.on("error", (err) => {
    // Suppress unhandled rejections when Redis is offline or not configured
    console.warn("[Redis] Connection error:", err.message || err);
  });

  return client;
}

export const redisConnection = createRedisConnection();
