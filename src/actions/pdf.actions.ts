"use server";

import { renderToStream } from "@react-pdf/renderer";
import { headers } from "next/headers";
import React from "react";
import { generateReportInsights } from "@/lib/ai-service";
import { logAction } from "@/lib/audit";
import { auth } from "@/lib/auth"; // Import your auth instance
import {
  fetchAccountKeywords,
  fetchAccountLastMonthSummary,
  fetchAccountMonthlySummary,
} from "@/lib/google-ads";
import { transformAdsData } from "@/lib/report-utils";
import { MyReportPDF } from "@/service/pdf-service";

async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of stream) chunks.push(chunk as any);
  return Buffer.concat(chunks);
}

export async function generateClientReportAction(
  googleAccountId: string,
  clientName: string,
  startDate?: string, // New parameter
  endDate?: string, // New parameter
) {
  // 1. Identify the user performing the action
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    throw new Error("Unauthorized: You must be logged in to generate reports.");
  }

  const userId = session.user.id;

  try {
    const dateContext =
      startDate && endDate
        ? `${startDate} to ${endDate}`
        : "standard timeframe";
    console.log(
      `[Manual Report Gen] Initiating for ${clientName} (${dateContext}) by ${session.user.email}`,
    );

    // 2. Fetch raw data in parallel (pass the dates to your fetchers)
    const [rawSummary, rawKeywords, lastMonth] = await Promise.all([
      fetchAccountMonthlySummary(googleAccountId, startDate, endDate),
      fetchAccountKeywords(googleAccountId, startDate, endDate),
      fetchAccountLastMonthSummary(googleAccountId, startDate, endDate), // You may need to adjust how "last month" logic works for custom ranges
    ]);

    console.log("Data is", rawSummary, rawKeywords, lastMonth);

    // 3. Transform raw metrics
    const baseData = transformAdsData(
      clientName,
      rawSummary,
      rawKeywords,
      lastMonth,
    );

    // 4. Generate AI Insights
    const aiInsights = await generateReportInsights({
      ...baseData,
      customInstructions: "",
    });

    // --- NEW: Format the date range for the PDF ---
    let displayDate = "Current Month"; // Default text if no dates provided
    if (startDate && endDate) {
      // Converts "2026-05-11" to "May 11, 2026"
      const formatStr = (d: string) =>
        new Date(d).toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
        });
      displayDate = `${formatStr(startDate)} — ${formatStr(endDate)}`;
    }

    // 5. Combine data
    const finalData = {
      ...baseData,
      ai: aiInsights,
      dateRange: displayDate, // Pass the formatted date string to the PDF
    };

    // 6. Render PDF to Buffer
    const pdfElement = React.createElement(MyReportPDF, { data: finalData });
    const stream = await renderToStream(pdfElement as any);
    const buffer = await streamToBuffer(stream);

    // SUCCESS LOGGING
    await logAction(
      userId,
      "MANUAL_REPORT_GENERATE",
      "ad_accounts",
      googleAccountId,
      { clientName, fileName: `${clientName}_Report.pdf` },
    );

    return {
      success: true,
      pdfBase64: buffer.toString("base64"),
      fileName: `${clientName.replace(/\s+/g, "_")}_Report.pdf`,
    };
  } catch (error: any) {
    // FAILURE LOGGING
    await logAction(
      userId,
      "MANUAL_REPORT_GENERATE_FAILED",
      "ad_accounts",
      googleAccountId,
      { clientName, error: error.message || "Unknown error" },
    );

    console.error("Manual Report Gen Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Internal Server Error",
    };
  }
}
