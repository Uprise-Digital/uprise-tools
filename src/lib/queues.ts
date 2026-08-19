import { Queue } from "bullmq";
import { redisConnection } from "./redis";

export const ONBOARDING_QUEUE_NAME = "client-onboarding-queue";
export const BRIEFING_QUEUE_NAME = "morning-briefing-queue";
export const SYNC_QUEUE_NAME = "ad-sync-queue";
export const AUDIT_QUEUE_NAME = "lp-audit-queue";

/**
 * BullMQ Queues initialized with Redis Connection
 */
export const onboardingQueue = new Queue(ONBOARDING_QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 5000, // 5s, 25s, 125s retries
    },
    removeOnComplete: { age: 86400, count: 500 }, // Keep last 500 completed jobs for 24h
    removeOnFail: { age: 604800, count: 1000 }, // Keep failed jobs for 7 days
  },
});

export const briefingQueue = new Queue(BRIEFING_QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: "fixed", delay: 10000 },
    removeOnComplete: { count: 200 },
  },
});

export const syncQueue = new Queue(SYNC_QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 10000 },
    removeOnComplete: { count: 300 },
  },
});

export const auditQueue = new Queue(AUDIT_QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 2,
    removeOnComplete: { count: 200 },
  },
});
