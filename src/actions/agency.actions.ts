"use server";

import {db} from "@/db";
import {adAccounts, adPerformanceDaily, agencyAiInsightsCache} from "@/db/schema";
import {and, eq, gte, lte} from "drizzle-orm";
import {GoogleGenAI} from '@google/genai';
import {getDashboardMetricsAction} from "@/actions/dashboard.actions";

const ai = new GoogleGenAI({apiKey: process.env.GEMINI_API_KEY!});

/**
 * PORTFOLIO GOD-VIEW ENGINE (With Caching)
 */
export async function getOrGenerateAgencyAiInsightsAction(
    startDate: string,
    endDate: string,
    portfolioData: any,
    forceRefresh: boolean = false
) {
    // 1. Check Cache First
    if (!forceRefresh) {
        const cached = await db.query.agencyAiInsightsCache.findFirst({
            where: and(
                eq(agencyAiInsightsCache.startDate, startDate),
                eq(agencyAiInsightsCache.endDate, endDate)
            )
        });

        if (cached) {
            return {
                success: true,
                data: cached.insights,
                generatedAt: cached.createdAt,
                isCached: true
            };
        }
    }

    // 2. If no cache (or forced), run the LLM
    if (!portfolioData) {
        throw new Error("Portfolio data is required to generate new insights.");
    }

    const prompt = `
    You are the Strategy Director for an elite Performance Marketing Agency. Analyze this agency-wide portfolio data.

    PORTFOLIO DATA: ${JSON.stringify(portfolioData)}

    Your primary job is to protect agency retention by identifying "Critical Fires"—accounts that are actively failing or at high risk of churning. 
    
    CRITERIA FOR A "CRITICAL FIRE":
    1. The account has had ZERO activity (spend/impressions) recently, indicating a broken setup, paused billing, or churn.
    2. Click-Through Rate (CTR) is abysmal (under 3%), indicating total ad blindness or terrible targeting.
    3. The account is bleeding money (high spend) with zero or near-zero conversions.
    4. Blended CPA is catastrophically higher than the agency average.

    OUTPUT FORMAT (Strict JSON):
    {
      "macro_summary": "3-sentence high-level summary of the entire agency's performance.",
      "blended_efficiency": "Analysis of the blended agency CPA and CTR. Are we generally profitable across the board?",
      "critical_fires": [
        {
          "account_name": "Name of the failing account",
          "severity": "High/Critical",
          "the_problem": "Exactly what is going wrong (e.g., 'CTR has fallen to 1.2%' or 'Zero spend in the last week')",
          "recommended_action": "What the account manager must do IMMEDIATELY to save the client relationship."
        }
      ],
      "growth_opportunities": [
        {
          "account_name": "Name of an over-performing account",
          "reasoning": "Why we should ask this client to scale their budget."
        }
      ]
    }

    CONSTRAINTS:
    - If there are no critical fires matching the criteria, return an empty array []. Be strict; only flag genuine issues.
    - Base all analysis strictly on the provided JSON figures.
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {responseMimeType: 'application/json'}
        });

        const parsedInsights = JSON.parse(response.text as string);

        // 3. Save to Database
        const [upserted] = await db.insert(agencyAiInsightsCache)
            .values({
                startDate,
                endDate,
                insights: parsedInsights,
                createdAt: new Date(),
            })
            .onConflictDoUpdate({
                target: [agencyAiInsightsCache.startDate, agencyAiInsightsCache.endDate],
                set: {
                    insights: parsedInsights,
                    createdAt: new Date(),
                }
            })
            .returning({createdAt: agencyAiInsightsCache.createdAt});

        return {
            success: true,
            data: parsedInsights,
            generatedAt: upserted.createdAt,
            isCached: false
        };

    } catch (error) {
        console.error("Agency AI Insights Error:", error);
        throw new Error("Failed to generate portfolio insights.");
    }
}

export async function getAgencyPortfolioMetricsAction(startDate: string, endDate: string) {
    try {
        // 1. Get all active accounts
        const activeAccounts = await db.query.adAccounts.findMany({
            where: eq(adAccounts.isActive, true)
        });

        const accountIds = activeAccounts.map(a => a.id);
        if (accountIds.length === 0) return {success: true, data: null};

        // 2. Fetch all performance data for these accounts in the date range
        const allPerformance = await db.query.adPerformanceDaily.findMany({
            where: and(
                gte(adPerformanceDaily.date, startDate),
                lte(adPerformanceDaily.date, endDate)
            )
        });

        // 3. Aggregate Agency Totals
        let totalSpend = 0;
        let totalClicks = 0;
        let totalImpressions = 0;
        let totalConversions = 0;

        // 4. Map account breakdown
        const accountBreakdownMap: Record<number, any> = {};
        activeAccounts.forEach(acc => {
            accountBreakdownMap[acc.id] = {
                accountId: acc.id,
                name: acc.name,
                googleAccountId: acc.googleAccountId,
                spend: 0, clicks: 0, impressions: 0, conversions: 0
            };
        });

        allPerformance.forEach(row => {
            const spend = Number(row.spend || 0);
            const clicks = Number(row.clicks || 0);
            const impressions = Number(row.impressions || 0);
            const conversions = Number(row.conversions || 0);

            // Add to totals
            totalSpend += spend;
            totalClicks += clicks;
            totalImpressions += impressions;
            totalConversions += conversions;

            // Add to account breakdown
            if (accountBreakdownMap[row.adAccountId]) {
                accountBreakdownMap[row.adAccountId].spend += spend;
                accountBreakdownMap[row.adAccountId].clicks += clicks;
                accountBreakdownMap[row.adAccountId].impressions += impressions;
                accountBreakdownMap[row.adAccountId].conversions += conversions;
            }
        });

        // 5. Format Breakdown & Calculate derived metrics (CPA, CTR)
        const accountBreakdown = Object.values(accountBreakdownMap).map(acc => ({
            ...acc,
            cpa: acc.conversions > 0 ? acc.spend / acc.conversions : 0,
            ctr: acc.impressions > 0 ? (acc.clicks / acc.impressions) * 100 : 0,
            cpc: acc.clicks > 0 ? acc.spend / acc.clicks : 0
        })).sort((a, b) => b.spend - a.spend); // Sort by highest spend

        return {
            success: true,
            data: {
                agencyTotals: {
                    activeAccountsCount: activeAccounts.length,
                    spend: totalSpend,
                    clicks: totalClicks,
                    impressions: totalImpressions,
                    conversions: totalConversions,
                    cpa: totalConversions > 0 ? totalSpend / totalConversions : 0,
                    ctr: totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0,
                    cpc: totalClicks > 0 ? totalSpend / totalClicks : 0
                },
                accountBreakdown
            }
        };

    } catch (error: any) {
        console.error("Failed to fetch agency portfolio:", error);
        return {success: false, error: error.message};
    }
}

export async function syncAgencyPortfolioAction(startDate: string, endDate: string) {
    try {
        // 1. Get all active accounts
        const activeAccounts = await db.query.adAccounts.findMany({
            where: eq(adAccounts.isActive, true)
        });

        if (activeAccounts.length === 0) return {success: true, syncedCount: 0};

        // 2. Loop through and trigger the JIT sync for each account.
        // We use a `for...of` loop instead of `Promise.all` to avoid hitting
        // Google Ads API rate limits by sending 50 concurrent requests.
        let syncedCount = 0;
        for (const account of activeAccounts) {
            try {
                // By calling this, we force your existing JIT sync to run for this account
                await getDashboardMetricsAction(account.id, account.googleAccountId, startDate, endDate);
                syncedCount++;
            } catch (err) {
                console.error(`Failed to sync account ${account.name}:`, err);
                // Continue to the next account even if one fails
            }
        }

        return {success: true, syncedCount};
    } catch (error: any) {
        console.error("Failed to sync agency portfolio:", error);
        return {success: false, error: error.message};
    }
}