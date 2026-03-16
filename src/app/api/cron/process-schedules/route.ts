import { db } from "@/db";
import { reportSchedules } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { send } from "@vercel/queue";
import {logAction} from "@/lib/audit";

export async function GET(req: Request) {
    const SYSTEM_ACTOR = "SYSTEM_AUTOMATION";

    // 1. Auth check
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        console.error("[Cron] Unauthorized attempt to trigger schedules.");
        return new Response('Unauthorized', { status: 401 });
    }

    const today = new Date();
    const currentDay = today.getDate();

    try {
        // 2. Find pending schedules
        const pendingSchedules = await db.query.reportSchedules.findMany({
            where: and(
                eq(reportSchedules.isActive, true),
                eq(reportSchedules.dayOfMonth, currentDay),
                sql`${reportSchedules.lastRunAt} IS NULL OR ${reportSchedules.lastRunAt} < NOW() - INTERVAL '20 hours'`
            ),
            with: { account: true }
        });

        if (pendingSchedules.length === 0) {
            return new Response("No reports due today.");
        }

        // 3. Enqueue tasks
        const queueResults = await Promise.allSettled(
            pendingSchedules.map((schedule) =>
                send("google-ads-reports", {
                    scheduleId: schedule.id,
                    googleAccountId: schedule.account.googleAccountId,
                    clientName: schedule.account.name
                })
            )
        );

        const successful = queueResults.filter(r => r.status === 'fulfilled').length;
        const failed = queueResults.filter(r => r.status === 'rejected').length;

        // 4. LOG SUCCESS/PARTIAL SUCCESS
        await logAction(
            SYSTEM_ACTOR,
            "CRON_ENQUEUE_REPORTS",
            "report_schedules",
            "BATCH",
            {
                dayOfMonth: currentDay,
                totalFound: pendingSchedules.length,
                successfulEnqueued: successful,
                failedEnqueued: failed,
                scheduleIds: pendingSchedules.map(s => s.id)
            }
        );

        return new Response(`Enqueued ${successful} reports.`, { status: 200 });

    } catch (error: any) {
        // 5. LOG CRITICAL CRON FAILURE
        await logAction(
            SYSTEM_ACTOR,
            "CRON_CRITICAL_FAILURE",
            "system",
            "CRON_ROUTE",
            {
                error: error.message || "Unknown error",
                dayOfMonth: currentDay
            }
        );

        console.error("[Cron] Critical Error:", error);
        return new Response("Internal Server Error", { status: 500 });
    }
}