"use server";

import React from "react";
import {renderToStream} from "@react-pdf/renderer";
import {MyReportPDF} from "@/service/pdf-service";
import {fetchAccountKeywords, fetchAccountLastMonthSummary, fetchAccountMonthlySummary} from "@/lib/google-ads";
import {generateReportInsights} from "@/lib/ai-service";
import {transformAdsData} from "@/lib/report-utils";
import {auth} from "@/lib/auth"; // Import your auth instance
import {headers} from "next/headers";
import {logAction} from "@/lib/audit";

async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
    const chunks: Uint8Array[] = [];
    for await (const chunk of stream) chunks.push(chunk as any);
    return Buffer.concat(chunks);
}

export async function generateClientReportAction(googleAccountId: string, clientName: string) {
    // 1. Identify the user performing the action
    const session = await auth.api.getSession({
        headers: await headers()
    });

    if (!session) {
        throw new Error("Unauthorized: You must be logged in to generate reports.");
    }

    const userId = session.user.id;

    try {
        console.log(`[Manual Report Gen] Initiating for ${clientName} by ${session.user.email}`);

        // 2. Fetch raw data in parallel
        const [rawSummary, rawKeywords, lastMonth] = await Promise.all([
            fetchAccountMonthlySummary(googleAccountId),
            fetchAccountKeywords(googleAccountId),
            fetchAccountLastMonthSummary(googleAccountId)
        ]);

        // 3. Transform raw metrics
        const baseData = transformAdsData(clientName, rawSummary, rawKeywords, lastMonth);

        // 4. Generate AI Insights
        const aiInsights = await generateReportInsights({
            ...baseData,
            customInstructions: ""
        });

        // 5. Combine data
        const finalData = {
            ...baseData,
            ai: aiInsights
        };

        // 6. Render PDF to Buffer
        const pdfElement = React.createElement(MyReportPDF, {data: finalData});
        const stream = await renderToStream(pdfElement as any);
        const buffer = await streamToBuffer(stream);

        // SUCCESS LOGGING
        await logAction(
            userId,
            "MANUAL_REPORT_GENERATE",
            "ad_accounts",
            googleAccountId,
            {clientName, fileName: `${clientName}_Report.pdf`}
        );

        return {
            success: true,
            pdfBase64: buffer.toString('base64'),
            fileName: `${clientName.replace(/\s+/g, '_')}_Report.pdf`
        };

    } catch (error: any) {
        // FAILURE LOGGING
        await logAction(
            userId,
            "MANUAL_REPORT_GENERATE_FAILED",
            "ad_accounts",
            googleAccountId,
            {clientName, error: error.message || "Unknown error"}
        );

        console.error("Manual Report Gen Error:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Internal Server Error"
        };
    }
}