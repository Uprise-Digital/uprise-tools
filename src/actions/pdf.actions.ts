"use server";

import React from "react";
import { renderToStream } from "@react-pdf/renderer";
import { MyReportPDF } from "@/service/pdf-service";
import { fetchAccountMonthlySummary, fetchAccountKeywords } from "@/lib/google-ads";

async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
    const chunks: Uint8Array[] = [];
    for await (const chunk of stream) chunks.push(chunk as any);
    return Buffer.concat(chunks);
}

export async function generateClientReportAction(googleAccountId: string, clientName: string) {
    try {
        const [rawSummary, rawKeywords] = await Promise.all([
            fetchAccountMonthlySummary(googleAccountId),
            fetchAccountKeywords(googleAccountId)
        ]);

        let totals = {
            cost: 0,
            clicks: 0,
            impressions: 0,
            conversions: 0,
        };

        const campaigns = rawSummary.map((row: any) => {
            const cost = Number(row.metrics.costMicros) / 1_000_000;
            const conv = Number(row.metrics.conversions);
            const clicks = Number(row.metrics.clicks);

            totals.cost += cost;
            totals.clicks += clicks;
            totals.impressions += Number(row.metrics.impressions);
            totals.conversions += conv;

            return {
                name: row.campaign.name,
                conversions: conv,
                costPerConv: conv > 0 ? (cost / conv).toFixed(2) : "0.00",
                spend: cost.toFixed(2),
                clicks: clicks,
                ctr: (Number(row.metrics.ctr) * 100).toFixed(2),
                cpc: (Number(row.metrics.averageCpc) / 1_000_000).toFixed(2)
            };
        });

        const keywords = rawKeywords.map((row: any) => {
            const kwCost = Number(row.metrics.costMicros) / 1_000_000;
            const kwConv = Number(row.metrics.conversions);
            const kwClicks = Number(row.metrics.clicks);

            return {
                text: row.adGroupCriterion.keyword.text,
                matchType: row.adGroupCriterion.keyword.matchType,
                conversions: kwConv,
                costPerConv: kwConv > 0 ? (kwCost / kwConv).toFixed(2) : "0.00",
                spend: kwCost.toFixed(2),
                clicks: kwClicks,
                ctr: (Number(row.metrics.ctr) * 100).toFixed(2),
                cpc: (Number(row.metrics.averageCpc) / 1_000_000).toFixed(2)
            };
        });

        const data = {
            clientName,
            metrics: {
                cost: totals.cost.toLocaleString(undefined, { minimumFractionDigits: 2 }),
                clicks: totals.clicks.toLocaleString(),
                ctr: totals.impressions > 0 ? ((totals.clicks / totals.impressions) * 100).toFixed(2) : "0.00",
                conversions: totals.conversions,
                avgCpc: totals.clicks > 0 ? (totals.cost / totals.clicks).toFixed(2) : "0.00",
                costPerConv: totals.conversions > 0 ? (totals.cost / totals.conversions).toFixed(2) : "0.00"
            },
            campaigns: campaigns.sort((a: any, b: any) => parseFloat(b.spend) - parseFloat(a.spend)).slice(0, 10),
            keywords: keywords
        };

        const pdfElement = React.createElement(MyReportPDF, { data });
        const stream = await renderToStream(pdfElement as any);
        const buffer = await streamToBuffer(stream);

        return {
            success: true,
            pdfBase64: buffer.toString('base64'),
            fileName: `${clientName.replace(/\s+/g, '_')}_Report.pdf`
        };

    } catch (error) {
        console.error("Report Gen Error:", error);
        return { success: false, error: "Failed to generate report" };
    }
}