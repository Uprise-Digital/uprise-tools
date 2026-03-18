import { NextResponse } from "next/server";
import { db } from "@/db";
import { reportSchedules } from "@/db/schema";
import { eq } from "drizzle-orm";
import { Resend } from 'resend';
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

async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
    const chunks: Uint8Array[] = [];
    for await (const chunk of stream) chunks.push(chunk as any);
    return Buffer.concat(chunks);
}

// Ensure Vercel allocates maximum time for AI and PDF rendering
export const maxDuration = 300;

export async function POST(request: Request) {
    // 1. Security Check: Only allow requests from your Cloudflare Worker
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.WORKER_SECRET_KEY}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const payload = await request.json();
        const { scheduleId, googleAccountId, clientName } = payload;
        const SYSTEM_ACTOR = "SYSTEM_AUTOMATION";

        // Fetch the schedule
        const schedule = await db.query.reportSchedules.findFirst({
            where: eq(reportSchedules.id, scheduleId)
        });

        if (!schedule) {
            return NextResponse.json({ error: `Schedule ${scheduleId} not found` }, { status: 404 });
        }

        // Parallel Data Fetching
        const [rawSummary, rawKeywords, lastMonth] = await Promise.all([
            fetchAccountMonthlySummary(googleAccountId),
            fetchAccountKeywords(googleAccountId),
            fetchAccountLastMonthSummary(googleAccountId)
        ]);

        const baseData = transformAdsData(clientName, rawSummary, rawKeywords, lastMonth);

        // Parallel AI Generation
        const [pdfAi, emailAi] = await Promise.all([
            generateReportInsights({ ...baseData, customInstructions: schedule.customAiInstructions }),
            generateEmailBody({ ...baseData, customInstructions: schedule.customAiInstructions })
        ]);

        // PDF Generation
        const pdfElement = React.createElement(MyReportPDF, { data: { ...baseData, ai: pdfAi } });
        const stream = await renderToStream(pdfElement as any);
        const pdfBuffer = await streamToBuffer(stream);

        // Email Dispatch
        const emailResult = await resend.emails.send({
            from: 'Uprise Digital <reports@uprisedigital.com.au>',
            to: schedule.recipientEmail,
            cc: cleanCcEmails(schedule.ccEmails),
            subject: schedule.emailSubject || `Performance Report: ${clientName}`,
            text: emailAi.emailBody,
            attachments: [{
                filename: `${clientName.replace(/\s+/g, '_')}_Report.pdf`,
                content: pdfBuffer,
            }],
        });

        if (emailResult.error) throw new Error(`Resend Error: ${emailResult.error.message}`);

        // Update DB and Log
        await db.update(reportSchedules)
            .set({ lastRunAt: new Date() })
            .where(eq(reportSchedules.id, scheduleId));

        await logAction(SYSTEM_ACTOR, "AUTOMATED_REPORT_SENT", "report_schedules", scheduleId.toString(), {
            clientName, recipient: schedule.recipientEmail, status: "SUCCESS"
        });

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error(`[Vercel API] Critical failure:`, error);
        // Returning a 500 status code triggers the Cloudflare Worker's 'catch' block
        // which initiates the queue retry mechanism.
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}