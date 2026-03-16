import { db } from "@/db";
import { reportSchedules } from "@/db/schema";
import { eq } from "drizzle-orm";
import { Resend } from 'resend';
import { handleCallback } from "@vercel/queue";
import { generateReportInsights, generateEmailBody } from "@/lib/ai-service";
import { MyReportPDF } from "@/service/pdf-service";
import { renderToStream } from "@react-pdf/renderer";
import React from "react";
import {
    fetchAccountMonthlySummary,
    fetchAccountKeywords,
    fetchAccountLastMonthSummary
} from "@/lib/google-ads";
import { transformAdsData } from "@/lib/report-utils";
import {logAction} from "@/lib/audit";

const resend = new Resend(process.env.RESEND_API_KEY);

async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
    const chunks: Uint8Array[] = [];
    for await (const chunk of stream) chunks.push(chunk as any);
    return Buffer.concat(chunks);
}

export const maxDuration = 300;

export const POST = handleCallback(async (payload: any) => {
    const { scheduleId, googleAccountId, clientName } = payload;
    const SYSTEM_ACTOR = "SYSTEM_AUTOMATION";

    try {
        // 1. Fetch the schedule
        const schedule = await db.query.reportSchedules.findFirst({
            where: eq(reportSchedules.id, scheduleId)
        });
        if (!schedule) throw new Error(`Schedule ${scheduleId} not found`);

        // 2. Fetch raw Ads data in parallel
        const [rawSummary, rawKeywords, lastMonth] = await Promise.all([
            fetchAccountMonthlySummary(googleAccountId),
            fetchAccountKeywords(googleAccountId),
            fetchAccountLastMonthSummary(googleAccountId)
        ]);

        // 3. Transform data
        const baseData = transformAdsData(clientName, rawSummary, rawKeywords, lastMonth);

        // 4. Parallel AI generation
        const [pdfAi, emailAi] = await Promise.all([
            generateReportInsights({
                ...baseData,
                customInstructions: schedule.customAiInstructions
            }),
            generateEmailBody({
                ...baseData,
                customInstructions: schedule.customAiInstructions
            })
        ]);

        // 5. Render PDF to Buffer
        const pdfElement = React.createElement(MyReportPDF, { data: { ...baseData, ai: pdfAi } });
        const stream = await renderToStream(pdfElement as any);
        const pdfBuffer = await streamToBuffer(stream);

        // 6. Send via Resend
        const emailResult = await resend.emails.send({
            from: 'Uprise Digital <reports@uprisedigital.com.au>',
            to: schedule.recipientEmail,
            cc: schedule.ccEmails || undefined,
            subject: schedule.emailSubject || `Performance Report: ${clientName}`,
            text: emailAi.emailBody,
            attachments: [
                {
                    filename: `${clientName.replace(/\s+/g, '_')}_Report.pdf`,
                    content: pdfBuffer,
                },
            ],
        });

        if (emailResult.error) throw new Error(`Resend Error: ${emailResult.error.message}`);

        // 7. Update schedule state
        await db.update(reportSchedules)
            .set({ lastRunAt: new Date() })
            .where(eq(reportSchedules.id, scheduleId));

        // SUCCESS LOGGING
        await logAction(
            SYSTEM_ACTOR,
            "AUTOMATED_REPORT_SENT",
            "report_schedules",
            scheduleId.toString(),
            {
                clientName,
                recipient: schedule.recipientEmail,
                status: "SUCCESS"
            }
        );

        console.log(`[Queue Worker] Successfully sent report for ${clientName}`);

    } catch (error: any) {
        // FAILURE LOGGING
        // We log the failure before throwing so we have a record even if Vercel retries
        await logAction(
            SYSTEM_ACTOR,
            "AUTOMATED_REPORT_FAILED",
            "report_schedules",
            scheduleId?.toString() || "UNKNOWN",
            {
                clientName,
                error: error.message || "Unknown error",
                status: "FAILURE"
            }
        );

        console.error(`[Queue Worker] Critical failure for ${clientName}:`, error);
        throw error; // Let Vercel Queue retry based on your policy
    }
});