"use server";

import { renderToStream } from "@react-pdf/renderer";
import { desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import React from "react";
import { Resend } from "resend";
import { db } from "@/db";
import { emailLogs, member, reportSchedules } from "@/db/schema";
import { generateEmailBody, generateReportInsights } from "@/lib/ai-service";
import { logAction, logEmail } from "@/lib/audit";
import { auth } from "@/lib/auth";
import { cleanCcEmails } from "@/lib/cleaners";
import {
  fetchAccountKeywords,
  fetchAccountLastMonthSummary,
  fetchAccountMonthlySummary,
} from "@/lib/google-ads";
import { transformAdsData } from "@/lib/report-utils";
import { MyReportPDF } from "@/service/pdf-service";

const resend = new Resend(process.env.RESEND_API_KEY);

async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of stream) chunks.push(chunk as any);
  return Buffer.concat(chunks);
}

export async function executeReportJobDirectly(params: {
  scheduleId: number;
  googleAccountId: string;
  clientName: string;
  userId: string;
}) {
  const { scheduleId, googleAccountId, clientName, userId } = params;

  const schedule = await db.query.reportSchedules.findFirst({
    where: eq(reportSchedules.id, scheduleId),
  });
  if (!schedule) throw new Error(`Schedule ${scheduleId} not found`);

  const [rawSummary, rawKeywords, lastMonth] = await Promise.all([
    fetchAccountMonthlySummary(googleAccountId),
    fetchAccountKeywords(googleAccountId),
    fetchAccountLastMonthSummary(googleAccountId),
  ]);

  const baseData = transformAdsData(
    clientName,
    rawSummary,
    rawKeywords,
    lastMonth,
  );

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

  const pdfElement = React.createElement(MyReportPDF, {
    data: { ...baseData, ai: pdfAi },
  });
  const stream = await renderToStream(pdfElement as any);
  const pdfBuffer = await streamToBuffer(stream);

  const emailSubjectText =
    schedule.emailSubject || `Performance Report: ${clientName}`;

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
      emailType: "on_demand_report",
      status: "failed",
      error: emailResult.error.message,
    });
    throw new Error(`Resend Error: ${emailResult.error.message}`);
  }

  await logEmail({
    adAccountId: schedule.adAccountId,
    recipient: schedule.recipientEmail,
    subject: emailSubjectText,
    emailType: "on_demand_report",
    status: "success",
    resendId: emailResult.data?.id,
  });

  await db
    .update(reportSchedules)
    .set({ lastRunAt: new Date() })
    .where(eq(reportSchedules.id, scheduleId));

  await logAction(
    userId,
    "MANUAL_RULE_TEST",
    "report_schedules",
    scheduleId.toString(),
    { clientName, recipient: schedule.recipientEmail, status: "SUCCESS" },
  );

  return { success: true };
}

/**
 * Handles both creating new schedules and updating existing ones.
 */
export async function saveReportScheduleAction(data: {
  id?: number | null;
  adAccountId: number;
  clientName: string;
  frequency: string;
  dayOfMonth: number;
  recipientEmail: string;
  ccEmails: string;
  useAiSummary: boolean;
  customAiInstructions: string;
  customMessage: string;
}) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });
    if (!session) throw new Error("Unauthorized");

    let orgId = session.session?.activeOrganizationId;
    if (!orgId) {
      const userMember = await db.query.member.findFirst({
        where: eq(member.userId, session.user.id),
      });
      orgId = userMember?.organizationId;
    }
    if (!orgId) throw new Error("No active organization found");

    const payload = {
      adAccountId: data.adAccountId,
      organizationId: orgId,
      frequency: data.frequency,
      dayOfMonth: data.dayOfMonth,
      recipientEmail: data.recipientEmail,
      ccEmails: data.ccEmails,
      emailSubject: `Monthly Performance Report - ${data.clientName}`,
      useAiSummary: data.useAiSummary,
      customAiInstructions: data.customAiInstructions,
      customMessage: data.customMessage,
      isActive: true,
    };

    if (data.id) {
      // UPDATE existing record
      await db
        .update(reportSchedules)
        .set(payload)
        .where(eq(reportSchedules.id, data.id));
    } else {
      // INSERT new record
      await db.insert(reportSchedules).values(payload);
    }

    revalidatePath("/accounts");
    return { success: true };
  } catch (error) {
    console.error("Failed to save schedule:", error);
    return { success: false, error: "Failed to save automation rule." };
  }
}

/**
 * Deletes a specific report schedule by ID.
 */
export async function deleteReportScheduleAction(id: number) {
  try {
    await db.delete(reportSchedules).where(eq(reportSchedules.id, id));

    revalidatePath("/accounts");
    return { success: true };
  } catch (error) {
    console.error("Failed to delete schedule:", error);
    return { success: false, error: "Failed to delete automation rule." };
  }
}

export async function triggerManualQueueTestAction(params: {
  scheduleId: number;
  googleAccountId: string;
  clientName: string;
  isTest: boolean;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  try {
    console.log(
      "[Automation Action] Executing report generation and email dispatch directly on server...",
    );
    await executeReportJobDirectly({
      scheduleId: params.scheduleId,
      googleAccountId: params.googleAccountId,
      clientName: params.clientName,
      userId: session.user.id,
    });

    revalidatePath("/accounts");
    return { success: true };
  } catch (error: any) {
    console.error("Failed to trigger manual test:", error);
    return { success: false, error: error.message };
  }
}

export async function getEmailSendingHistoryAction(adAccountId: number) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) throw new Error("Unauthorized");

    const history = await db.query.emailLogs.findMany({
      where: eq(emailLogs.adAccountId, adAccountId),
      orderBy: [desc(emailLogs.sentAt)],
      limit: 20,
    });

    return { success: true, history };
  } catch (error: any) {
    console.error("Failed to fetch email sending history:", error);
    return { success: false, error: error.message, history: [] };
  }
}
