import { Client } from '@neondatabase/serverless';
import { processReport } from './processor';

export default {
    // 1. CLOUDFLARE CRON (Replaces Vercel Cron)
    async scheduled(event: ScheduledEvent, env: any, ctx: ExecutionContext) {
        const client = new Client(env.DATABASE_URL);
        await client.connect();

        // Logic: Find schedules where day_of_month == today
        const today = new Date().getDate();
        const { rows: pendingSchedules } = await client.query(
            `SELECT rs.*, ad.google_account_id, ad.name as account_name 
       FROM report_schedules rs
       JOIN ad_accounts ad ON rs.ad_account_id = ad.id
       WHERE rs.is_active = true 
       AND rs.day_of_month = $1
       AND (rs.last_run_at IS NULL OR rs.last_run_at < NOW() - INTERVAL '20 hours')`,
            [today]
        );

        for (const schedule of pendingSchedules) {
            await env.REPORT_QUEUE.send({
                scheduleId: schedule.id,
                googleAccountId: schedule.google_account_id,
                clientName: schedule.account_name,
                userId: null
            });
        }

        ctx.waitUntil(client.end());
    },

    // 2. CLOUDFLARE QUEUE (The Ported Logic)
    async queue(batch: MessageBatch<any>, env: any): Promise<void> {
        for (const message of batch.messages) {
            await processReport(message.body, env);
            message.ack();
        }
    },

    // 3. MANUAL TRIGGER (From Vercel/Postman)
    async fetch(request: Request, env: any) {
        const payload = await request.json();
        await env.REPORT_QUEUE.send(payload);
        return new Response("Manual trigger enqueued");
    }
};