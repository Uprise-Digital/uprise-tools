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
import { logAction } from "@/lib/audit";
import { cleanCcEmails } from "@/lib/cleaners";

const resend = new Resend(process.env.RESEND_API_KEY);

// Helper to convert the PDF stream to a buffer for Resend
async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
    const chunks: Uint8Array[] = [];
    for await (const chunk of stream) chunks.push(chunk as any);
    return Buffer.concat(chunks);
}

// Ensure the function has enough time for AI and PDF generation
export const maxDuration = 300;

/**
 * Vercel Queue Worker
 * This handles the heavy lifting of generating and sending reports.
 */
export const POST = handleCallback(async (payload: any) => {
    const { scheduleId, googleAccountId, clientName, userId } = payload;

    // Fallback to SYSTEM_AUTOMATION if no userId (Cron jobs)
    // Note: Ensure this ID exists in your 'user' table to satisfy FK constraints
    const ACTOR = userId || "SYSTEM_AUTOMATION";

    console.log(`[Queue] Processing report for: ${clientName} (ID: ${scheduleId})`);

    try {
        // 1. Fetch the schedule configuration
        const schedule = await db.query.reportSchedules.findFirst({
            where: eq(reportSchedules.id, scheduleId)
        });
        if (!schedule) throw new Error(`Schedule ${scheduleId} not found`);

        // 2. Fetch Google Ads data in parallel to save time
        const [rawSummary, rawKeywords, lastMonth] = await Promise.all([
            fetchAccountMonthlySummary(googleAccountId),
            fetchAccountKeywords(googleAccountId),
            fetchAccountLastMonthSummary(googleAccountId)
        ]);

        // 3. Transform raw API data into report-friendly format
        const baseData = transformAdsData(clientName, rawSummary, rawKeywords, lastMonth);

        // 4. Generate AI Insights and Email Body in parallel
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

        // 5. Render React-PDF to Buffer
        const pdfElement = React.createElement(MyReportPDF, {
            data: { ...baseData, ai: pdfAi }
        });
        const stream = await renderToStream(pdfElement as any);
        const pdfBuffer = await streamToBuffer(stream);

        // 6. Send the email via Resend
        // cleanCcEmails converts "test@test.com, dev@test.com" into ["test@test.com", "dev@test.com"]
        const emailResult = await resend.emails.send({
            from: 'Uprise Digital <reports@uprisedigital.com.au>',
            to: schedule.recipientEmail,
            cc: cleanCcEmails(schedule.ccEmails),
            subject: schedule.emailSubject || `Performance Report: ${clientName}`,
            text: emailAi.emailBody,
            attachments: [
                {
                    filename: `${clientName.replace(/\s+/g, '_')}_Report.pdf`,
                    content: pdfBuffer,
                },
            ],
        });

        if (emailResult.error) {
            throw new Error(`Resend API Error: ${emailResult.error.message}`);
        }

        // 7. Success: Update the schedule's last run timestamp
        await db.update(reportSchedules)
            .set({ lastRunAt: new Date() })
            .where(eq(reportSchedules.id, scheduleId));

        // 8. Audit Log - Wrapped in try/catch so logging errors don't trigger re-sends
        try {
            await logAction(
                ACTOR,
                "AUTOMATED_REPORT_SENT",
                "report_schedules",
                scheduleId.toString(),
                { clientName, recipient: schedule.recipientEmail, status: "SUCCESS" }
            );
        } catch (auditErr) {
            console.error("[Queue] Audit logging failed:", auditErr);
        }

        console.log(`[Queue] Successfully delivered report for ${clientName}`);

    } catch (error: any) {
        // 9. Failure: Log the error and re-throw to allow Vercel Queue to retry
        try {
            await logAction(
                ACTOR,
                "AUTOMATED_REPORT_FAILED",
                "report_schedules",
                scheduleId?.toString() || "UNKNOWN",
                {
                    clientName,
                    error: error.message || "Unknown error",
                    status: "FAILURE"
                }
            );
        } catch (auditErr) {
            console.error("[Queue] Failed to log failure audit:", auditErr);
        }

        console.error(`[Queue] Worker Failure:`, error.message);

        // Throwing here triggers the Queue Retry Policy (up to 10 times)
        throw error;
    }
});