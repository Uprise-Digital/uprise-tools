import { Worker, Job } from "bullmq";
import { eq } from "drizzle-orm";
import { db } from "./db";
import { backgroundTasks } from "./db/schema";
import { redisConnection } from "./lib/redis";
import {
  ONBOARDING_QUEUE_NAME,
  BRIEFING_QUEUE_NAME,
  SYNC_QUEUE_NAME,
} from "./lib/queues";

console.log(
  "[Worker] Starting Uprise Tools Redis Background Worker process...",
);

/**
 * 1. Client Onboarding Worker
 */
export const onboardingWorker = new Worker(
  ONBOARDING_QUEUE_NAME,
  async (job: Job<{ onboardingId: number; organizationId: string }>) => {
    const { onboardingId, organizationId } = job.data;
    console.log(
      `[Worker - Onboarding] Processing Job #${job.id} for Client Onboarding ID: ${onboardingId}`,
    );

    // Create background task tracking record in DB
    const [taskRecord] = await db
      .insert(backgroundTasks)
      .values({
        organizationId: organizationId || "default-org",
        name: `Automated Onboarding (ID: ${onboardingId})`,
        status: "running",
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning({ id: backgroundTasks.id });

    try {
      const { triggerOnboardingAutomation } = await import(
        "./actions/client-onboarding.actions"
      );
      await triggerOnboardingAutomation(onboardingId);

      if (taskRecord?.id) {
        await db
          .update(backgroundTasks)
          .set({ status: "completed", updatedAt: new Date() })
          .where(eq(backgroundTasks.id, taskRecord.id));
      }

      console.log(
        `[Worker - Onboarding] Job #${job.id} completed successfully.`,
      );
    } catch (err: any) {
      console.error(`[Worker - Onboarding] Job #${job.id} failed:`, err);
      if (taskRecord?.id) {
        await db
          .update(backgroundTasks)
          .set({
            status: "failed",
            error: err.message || String(err),
            updatedAt: new Date(),
          })
          .where(eq(backgroundTasks.id, taskRecord.id));
      }
      throw err; // Trigger BullMQ retry
    }
  },
  {
    connection: redisConnection,
    concurrency: 3, // Process up to 3 onboardings in parallel
  },
);

/**
 * 2. Morning Briefing Worker
 */
export const briefingWorker = new Worker(
  BRIEFING_QUEUE_NAME,
  async (job: Job<{ organizationId?: string }>) => {
    console.log(
      `[Worker - Briefing] Processing Job #${job.id} - Morning Briefing Dispatch`,
    );
    const { sendMorningBriefingAction } = await import(
      "./actions/briefing.actions"
    );
    const result = await sendMorningBriefingAction();
    if (!result.success) {
      throw new Error(result.error || "Briefing send failed");
    }
  },
  {
    connection: redisConnection,
    concurrency: 2,
  },
);

/**
 * 3. Google Ads Sync Worker
 */
export const syncWorker = new Worker(
  SYNC_QUEUE_NAME,
  async (
    job: Job<{ startDate: string; endDate: string; organizationId?: string }>,
  ) => {
    const { startDate, endDate, organizationId } = job.data;
    console.log(
      `[Worker - Sync] Processing Job #${job.id} - Portfolio Sync (${startDate} to ${endDate})`,
    );
    const { syncAgencyPortfolioAction } = await import(
      "./actions/agency.actions"
    );
    await syncAgencyPortfolioAction(startDate, endDate, { organizationId });
  },
  {
    connection: redisConnection,
    concurrency: 2,
  },
);

// Graceful shutdown handling
process.on("SIGTERM", async () => {
  console.log("[Worker] Shutting down workers gracefully...");
  await Promise.all([
    onboardingWorker.close(),
    briefingWorker.close(),
    syncWorker.close(),
  ]);
  process.exit(0);
});
