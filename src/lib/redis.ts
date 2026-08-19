import Redis from "ioredis";

const redisUrl = process.env.REDIS_URL || process.env.UPSTASH_REDIS_URL;

export function createRedisConnection() {
  if (!redisUrl) {
    console.warn(
      "[Redis] Warning: No REDIS_URL found in environment variables. Falling back to local redis://localhost:6379",
    );
  }

  return new Redis(redisUrl || "redis://localhost:6379", {
    maxRetriesPerRequest: null, // Required by BullMQ
    enableReadyCheck: false,
    tls: redisUrl?.startsWith("rediss://") ? {} : undefined,
  });
}

export const redisConnection = createRedisConnection();
