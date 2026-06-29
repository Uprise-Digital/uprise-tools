import type {
  ExecutionContext,
  MessageBatch,
  Queue,
  ScheduledEvent,
} from "@cloudflare/workers-types";
// 1. Swapped Neon for the standard pg Client
import { Client } from "pg";
import { processReport } from "./processor";

export interface Env {
  DATABASE_URL: string;
  REPORT_QUEUE: Queue<any>;
  WORKER_SECRET_KEY: string;
  NEXT_PUBLIC_APP_URL: string;
}

export default {
  // 1. CLOUDFLARE CRON
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    console.log("[Cron] Waking up to check for pending reports...");

    // Initialize the standard PG client
    const client = new Client({ connectionString: env.DATABASE_URL });

    try {
      await client.connect();
      const today = new Date().getDate();

      // Fetch pending schedules using standard parameterized query
      const query = `
        SELECT rs.*, ad.google_account_id, ad.name as account_name 
        FROM report_schedules rs
        JOIN ad_accounts ad ON rs.ad_account_id = ad.id
        WHERE rs.is_active = true 
        AND rs.day_of_month = $1
        AND (rs.last_run_at IS NULL OR rs.last_run_at < NOW() - INTERVAL '20 hours')
      `;

      const result = await client.query(query, [today]);
      const pendingSchedules = result.rows;

      console.log(
        `[Cron] Found ${pendingSchedules.length} schedules to process today.`,
      );

      // Push each one to the Cloudflare Queue
      for (const schedule of pendingSchedules) {
        await env.REPORT_QUEUE.send({
          scheduleId: schedule.id,
          googleAccountId: schedule.google_account_id,
          clientName: schedule.account_name,
        });
      }
    } catch (error) {
      console.error("[Cron] Failed to fetch or enqueue schedules:", error);
    } finally {
      // Always close the connection in serverless/edge functions
      ctx.waitUntil(client.end());
    }
  },

  // 2. CLOUDFLARE QUEUE CONSUMER
  async queue(batch: MessageBatch<any>, env: Env): Promise<void> {
    for (const message of batch.messages) {
      try {
        await processReport(message.body, env);
        message.ack();
      } catch (error) {
        console.error(
          `[Queue] Failed to process message ${message.id}:`,
          error,
        );
        message.retry();
      }
    }
  },

  // 3. MANUAL TRIGGER
  async fetch(request: Request, env: Env) {
    if (request.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${env.WORKER_SECRET_KEY}`) {
      return new Response("Unauthorized", { status: 401 });
    }

    try {
      const payload = await request.json();

      if (
        !payload.scheduleId ||
        !payload.googleAccountId ||
        !payload.clientName
      ) {
        return new Response("Missing required fields", { status: 400 });
      }

      await env.REPORT_QUEUE.send(payload);

      return new Response(
        JSON.stringify({ success: true, message: "Enqueued" }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    } catch (error: any) {
      return new Response(`Bad Request: ${error.message}`, { status: 400 });
    }
  },
};
