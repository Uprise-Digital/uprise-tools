import { renderToStream } from "@react-pdf/renderer";
import { eq, and, or, isNull, lt, ne } from "drizzle-orm";
import { NextResponse } from "next/server";
import React from "react";
import { Resend } from "resend";
import { db } from "@/db";
import { adAccounts, reportSchedules, user } from "@/db/schema";
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

// Ensure Next.js/Railway allocates maximum time for AI and PDF rendering
export const maxDuration = 300;

// Shared report processing logic
async function processReportPayload(payload: {
  scheduleId: number;
  googleAccountId: string;
  clientName: string;
  userId?: string;
}) {
  const { scheduleId, googleAccountId, clientName, userId } = payload;
  const ACTOR = userId || "SYSTEM_AUTOMATION";

  console.log(
    `[Report Engine] Processing report for: ${clientName} (ID: ${scheduleId})`
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
      lastMonth
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

    // 8. Audit Log
    try {
      await logAction(
        ACTOR,
        "AUTOMATED_REPORT_SENT",
        "report_schedules",
        scheduleId.toString(),
        { clientName, recipient: schedule.recipientEmail, status: "SUCCESS" }
      );
    } catch (auditErr) {
      console.error("[Report Engine] Audit logging failed:", auditErr);
    }

    console.log(`[Report Engine] Successfully delivered report for ${clientName}`);
    return { success: true };
  } catch (error: any) {
    // 9. Failure: Log the error
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
        error: error.message || "Unknown cron error",
      });
    } catch (logErr) {
      console.error("[Report Engine] Failed to write failure emailLog:", logErr);
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
        }
      );
    } catch (auditErr) {
      console.error("[Report Engine] Failed to log failure audit:", auditErr);
    }

    console.error(`[Report Engine] Failure:`, error.message);
    throw error;
  }
}

/**
 * GET Handler (Automated Cron Job)
 * Queries all report schedules due today and runs them sequentially.
 */
export async function GET(request: Request) {
  // Security Check
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.WORKER_SECRET_KEY}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Determine today's day of the month (Melbourne context is fine)
    const today = new Date().getDate();
    console.log(`[Cron] Checking scheduled reports due today (day ${today})...`);

    // Fetch schedules that are active, due today, and not run in the last 20 hours
    const dueSchedules = await db
      .select({
        id: reportSchedules.id,
        adAccountId: reportSchedules.adAccountId,
        recipientEmail: reportSchedules.recipientEmail,
        dayOfMonth: reportSchedules.dayOfMonth,
        lastRunAt: reportSchedules.lastRunAt,
        googleAccountId: adAccounts.googleAccountId,
        clientName: adAccounts.name,
      })
      .from(reportSchedules)
      .innerJoin(adAccounts, eq(reportSchedules.adAccountId, adAccounts.id))
      .where(
        and(
          eq(reportSchedules.isActive, true),
          eq(reportSchedules.dayOfMonth, today),
          or(
            isNull(reportSchedules.lastRunAt),
            lt(reportSchedules.lastRunAt, new Date(Date.now() - 20 * 60 * 60 * 1000))
          )
        )
      );

    console.log(`[Cron] Found ${dueSchedules.length} schedules to process.`);
    const results: any[] = [];

    // Run them sequentially so we do not hit API rate limits or overflow PDF memory streams
    for (const schedule of dueSchedules) {
      try {
        await processReportPayload({
          scheduleId: schedule.id,
          googleAccountId: schedule.googleAccountId,
          clientName: schedule.clientName,
        });
        results.push({ scheduleId: schedule.id, clientName: schedule.clientName, status: "SUCCESS" });
      } catch (err: any) {
        results.push({
          scheduleId: schedule.id,
          clientName: schedule.clientName,
          status: "FAILED",
          error: err.message || "Unknown error",
        });
      }
    }

    return NextResponse.json({
      success: true,
      processed: dueSchedules.length,
      results,
    });
  } catch (error: any) {
    console.error("[Cron] Daily schedule processor failed:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * POST Handler (Manual Trigger for Single Job)
 */
export async function POST(request: Request) {
  // Security Check
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.WORKER_SECRET_KEY}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const payload = await request.json();
    if (!payload.scheduleId || !payload.googleAccountId) {
      return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
    }

    await processReportPayload({
      scheduleId: Number(payload.scheduleId),
      googleAccountId: payload.googleAccountId,
      clientName: payload.clientName || "Unknown Client",
      userId: payload.userId,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
