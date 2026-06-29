import { renderToStream } from "@react-pdf/renderer";
import { handleCallback } from "@vercel/queue";
import { eq } from "drizzle-orm";
import React from "react";
import { Resend } from "resend";
import { db } from "@/db";
import { reportSchedules } from "@/db/schema";
import { generateEmailBody, generateReportInsights } from "@/lib/ai-service";
import { logAction, logEmail } from "@/lib/audit";
import { cleanCcEmails } from "@/lib/cleaners";
import {
  fetchAccountKeywords,
  fetchAccountLastMonthSummary,
  fetchAccountMonthlySummary,
} from "@/lib/google-ads";
import { transformAdsData } from "@/lib/report-utils";
import { MyReportPDF } from "@/service/pdf-service";

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

  console.log(
    `[Queue] Processing report for: ${clientName} (ID: ${scheduleId})`,
  );

  let schedule: any = null;
  try {
    // 1. Fetch the schedule configuration
    schedule = await db.query.reportSchedules.findFirst({
      where: eq(reportSchedules.id, scheduleId),
    });
    if (!schedule) throw new Error(`Schedule ${scheduleId} not found`);

    // 2. Fetch Google Ads data in parallel to save time
    const [rawSummary, rawKeywords, lastMonth] = await Promise.all([
      fetchAccountMonthlySummary(googleAccountId),
      fetchAccountKeywords(googleAccountId),
      fetchAccountLastMonthSummary(googleAccountId),
    ]);

    // 3. Transform raw API data into report-friendly format
    const baseData = transformAdsData(
      clientName,
      rawSummary,
      rawKeywords,
      lastMonth,
    );

    // 4. Generate AI Insights and Email Body in parallel
    const [pdfAi, emailAi] = await Promise.all([
      generateReportInsights({
        ...baseData,
        customInstructions: schedule.customAiInstructions,
      }),
      generateEmailBody({
        ...baseData,
        customInstructions: schedule.customAiInstructions,
      }),
    ]);

    // 5. Render React-PDF to Buffer
    const pdfElement = React.createElement(MyReportPDF, {
      data: { ...baseData, ai: pdfAi },
    });
    const stream = await renderToStream(pdfElement as any);
    const pdfBuffer = await streamToBuffer(stream);

    const emailSubjectText =
      schedule.emailSubject || `Performance Report: ${clientName}`;

    // 6. Send the email via Resend
    // cleanCcEmails converts "test@test.com, dev@test.com" into ["test@test.com", "dev@test.com"]
    const emailResult = await resend.emails.send({
      from: "Uprise Digital <reports@uprisedigital.com.au>",
      to: schedule.recipientEmail,
      cc: cleanCcEmails(schedule.ccEmails),
      subject: emailSubjectText,
      text: emailAi.emailBody,
      attachments: [
        {
          filename: `${clientName.replace(/\s+/g, "_")}_Report.pdf`,
          content: pdfBuffer,
        },
      ],
    });

    if (emailResult.error) {
      await logEmail({
        adAccountId: schedule.adAccountId,
        recipient: schedule.recipientEmail,
        subject: emailSubjectText,
        emailType: "scheduled_report",
        status: "failed",
        error: emailResult.error.message,
      });
      throw new Error(`Resend API Error: ${emailResult.error.message}`);
    }

    await logEmail({
      adAccountId: schedule.adAccountId,
      recipient: schedule.recipientEmail,
      subject: emailSubjectText,
      emailType: "scheduled_report",
      status: "success",
      resendId: emailResult.data?.id,
    });

    // 7. Success: Update the schedule's last run timestamp
    await db
      .update(reportSchedules)
      .set({ lastRunAt: new Date() })
      .where(eq(reportSchedules.id, scheduleId));

    // 8. Audit Log - Wrapped in try/catch so logging errors don't trigger re-sends
    try {
      await logAction(
        ACTOR,
        "AUTOMATED_REPORT_SENT",
        "report_schedules",
        scheduleId.toString(),
        { clientName, recipient: schedule.recipientEmail, status: "SUCCESS" },
      );
    } catch (auditErr) {
      console.error("[Queue] Audit logging failed:", auditErr);
    }

    console.log(`[Queue] Successfully delivered report for ${clientName}`);
  } catch (error: any) {
    // 9. Failure: Log the error and re-throw to allow Vercel Queue to retry
    try {
      const adAccId =
        typeof schedule !== "undefined" && schedule
          ? schedule.adAccountId
          : null;
      const rec =
        typeof schedule !== "undefined" && schedule
          ? schedule.recipientEmail
          : "unknown@uprisedigital.com.au";
      const sub =
        typeof schedule !== "undefined" && schedule
          ? schedule.emailSubject || `Performance Report: ${clientName}`
          : `Performance Report: ${clientName || "Unknown Client"}`;

      await logEmail({
        adAccountId: adAccId,
        recipient: rec,
        subject: sub,
        emailType: "scheduled_report",
        status: "failed",
        error: error.message || "Unknown worker error",
      });
    } catch (logErr) {
      console.error("[Queue] Failed to write failure emailLog:", logErr);
    }

    try {
      await logAction(
        ACTOR,
        "AUTOMATED_REPORT_FAILED",
        "report_schedules",
        scheduleId?.toString() || "UNKNOWN",
        {
          clientName,
          error: error.message || "Unknown error",
          status: "FAILURE",
        },
      );
    } catch (auditErr) {
      console.error("[Queue] Failed to log failure audit:", auditErr);
    }

    console.error(`[Queue] Worker Failure:`, error.message);

    // Throwing here triggers the Queue Retry Policy (up to 10 times)
    throw error;
  }
});
