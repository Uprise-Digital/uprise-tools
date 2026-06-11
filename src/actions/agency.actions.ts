"use server";

import { db } from "@/db";
import { adAccounts, adPerformanceDaily } from "@/db/schema";
import { and, eq, gte, lte } from "drizzle-orm";
import { getDashboardMetricsAction } from "@/actions/dashboard.actions";

export async function getAgencyPortfolioMetricsAction(startDate: string, endDate: string) {
    try {
        // 1. Get all active accounts
        const activeAccounts = await db.query.adAccounts.findMany({
            where: eq(adAccounts.isActive, true)
        });

        const accountIds = activeAccounts.map(a => a.id);
        if (accountIds.length === 0) return { success: true, data: null };

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
        return { success: false, error: error.message };
    }
}

export async function syncAgencyPortfolioAction(startDate: string, endDate: string) {
    try {
        // 1. Get all active accounts
        const activeAccounts = await db.query.adAccounts.findMany({
            where: eq(adAccounts.isActive, true)
        });

        if (activeAccounts.length === 0) return { success: true, syncedCount: 0 };

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

        return { success: true, syncedCount };
    } catch (error: any) {
        console.error("Failed to sync agency portfolio:", error);
        return { success: false, error: error.message };
    }
}