"use server";

import {db} from "@/db";
import {adPerformanceDaily, user} from "@/db/schema";
import {revalidatePath} from "next/cache";
import {auth} from "@/lib/auth";
import {headers} from "next/headers";
import {logAction} from "@/lib/audit";
import {and, eq, gte, lte, sql, desc} from "drizzle-orm";
import {fetchDailyCampaignData} from "@/lib/google-ads";

// Fetch all agency users
export async function getTeamMembers() {
    return await db.select().from(user);
}

// Delete a user
export async function deleteTeamMember(targetUserId: string) {
    // 1. Auth Check
    const session = await auth.api.getSession({
        headers: await headers()
    });

    if (!session) {
        throw new Error("Unauthorized");
    }

    // 2. Fetch target info for the log BEFORE deleting
    const target = await db.query.user.findFirst({
        where: eq(user.id, targetUserId)
    });

    if (!target) throw new Error("User not found");

    try {
        // 3. Perform Deletion
        // Note: Better Auth handles linked accounts/sessions if cascade is set in DB
        await db.delete(user).where(eq(user.id, targetUserId));

        // SUCCESS LOGGING
        await logAction(
            session.user.id,
            "DELETE_USER",
            "user",
            targetUserId,
            {deletedName: target.name, deletedEmail: target.email}
        );

        revalidatePath("/(main)/team");
        return {success: true};

    } catch (error: any) {
        // FAILURE LOGGING
        await logAction(
            session.user.id,
            "DELETE_USER_FAILED",
            "user",
            targetUserId,
            {error: error.message || "Database error"}
        );

        console.error("Failed to delete team member:", error);
        return {success: false, error: "Failed to delete user"};
    }
}

/**
 * ⚠️ TEMPORARY FUNCTION: Move this to a Cloudflare Worker later.
 * Fetches data from Google Ads and safely upserts it into our database.
 */
async function syncGoogleAdsDataToDb(adAccountId: number, googleAccountId: string, startDate: string, endDate: string) {
    console.log(`[JIT Sync] Fetching Google Ads data for ${googleAccountId} from ${startDate} to ${endDate}`);

    const rawData = await fetchDailyCampaignData(googleAccountId, startDate, endDate);

    if (rawData.length === 0) return;

    // Prepare batch insert payload
    const insertPayload = rawData.map((row: any) => ({
        adAccountId,
        googleAccountId,
        date: row.segments.date,
        campaignId: row.campaign.id.toString(),
        campaignName: row.campaign.name,
        // Cast to string first, then ensure it's a valid number format
        spend: (Number(row.metrics.costMicros || 0) / 1_000_000).toString(),
        impressions: parseInt(row.metrics.impressions || "0", 10),
        clicks: parseInt(row.metrics.clicks || "0", 10),
        conversions: parseFloat(row.metrics.conversions || "0").toString(),
    }));

    // Upsert into Neon DB (Insert, or update if date+campaign already exists)
    await db.insert(adPerformanceDaily)
        .values(insertPayload)
        .onConflictDoUpdate({
            target: [adPerformanceDaily.adAccountId, adPerformanceDaily.date, adPerformanceDaily.campaignId],
            set: {
                // Dynamically build the update object so it updates fields correctly on conflict
                spend: sql`EXCLUDED.spend`,
                impressions: sql`EXCLUDED.impressions`,
                clicks: sql`EXCLUDED.clicks`,
                conversions: sql`EXCLUDED.conversions`,
                campaignName: sql`EXCLUDED.campaign_name`, // In case they renamed the campaign
            }
        });

    console.log(`[JIT Sync] Successfully upserted ${insertPayload.length} daily campaign records.`);
}


/**
 * PERMANENT FUNCTION: This is the actual endpoint your UI calls.
 */
export async function getDashboardMetricsAction(adAccountId: number, googleAccountId: string, startDate: string, endDate: string) {
    try {
        await syncGoogleAdsDataToDb(adAccountId, googleAccountId, startDate, endDate);

        // FIX: Bulletproof number parser that converts null/undefined/NaN into 0
        const pNum = (val: any) => {
            const num = Number(val);
            return isNaN(num) ? 0 : num;
        };
        const safeDiv = (num: number, den: number) => den > 0 ? num / den : 0;

        // 2. GET TOTALS
        const rawTotals = await db.select({
            spend: sql<number>`SUM(${adPerformanceDaily.spend})`,
            clicks: sql<number>`SUM(${adPerformanceDaily.clicks})`,
            impressions: sql<number>`SUM(${adPerformanceDaily.impressions})`,
            conversions: sql<number>`SUM(${adPerformanceDaily.conversions})`,
        })
            .from(adPerformanceDaily)
            .where(and(
                eq(adPerformanceDaily.adAccountId, adAccountId),
                gte(adPerformanceDaily.date, startDate),
                lte(adPerformanceDaily.date, endDate)
            ))
            .then(res => res[0] || { spend: 0, clicks: 0, impressions: 0, conversions: 0 });

        const tSpend = pNum(rawTotals?.spend);
        const tClicks = pNum(rawTotals?.clicks);
        const tImpr = pNum(rawTotals?.impressions);
        const tConv = pNum(rawTotals?.conversions);

        const totals = {
            spend: tSpend,
            clicks: tClicks,
            impressions: tImpr,
            conversions: tConv,
            ctr: safeDiv(tClicks, tImpr) * 100,
            cpc: safeDiv(tSpend, tClicks),
            cpa: safeDiv(tSpend, tConv),
            convRate: safeDiv(tConv, tClicks) * 100,
        };

        // 3. GET TIME SERIES
        const rawTimeSeries = await db.select({
            date: adPerformanceDaily.date,
            spend: sql`SUM(${adPerformanceDaily.spend})`,
            conversions: sql`SUM(${adPerformanceDaily.conversions})`,
            clicks: sql<number>`SUM(${adPerformanceDaily.clicks})`,
            impressions: sql<number>`SUM(${adPerformanceDaily.impressions})`,
        })
            .from(adPerformanceDaily)
            .where(and(
                eq(adPerformanceDaily.adAccountId, adAccountId),
                gte(adPerformanceDaily.date, startDate),
                lte(adPerformanceDaily.date, endDate)
            ))
            .groupBy(adPerformanceDaily.date)
            .orderBy(adPerformanceDaily.date);

        // Parse numerics and calculate daily CPC/CPA
        const timeSeries = rawTimeSeries.map(day => {
            const dSpend = pNum(day.spend);
            const dConv = pNum(day.conversions);
            const dClicks = pNum(day.clicks);
            return {
                ...day,
                spend: dSpend,
                conversions: dConv,
                cpa: safeDiv(dSpend, dConv),
                cpc: safeDiv(dSpend, dClicks)
            };
        });

        // 4. GET CAMPAIGN BREAKDOWN
        const rawCampaigns = await db.select({
            campaignName: adPerformanceDaily.campaignName,
            spend: sql`SUM(${adPerformanceDaily.spend})`,
            conversions: sql`SUM(${adPerformanceDaily.conversions})`,
            clicks: sql<number>`SUM(${adPerformanceDaily.clicks})`,
            impressions: sql<number>`SUM(${adPerformanceDaily.impressions})`,
        })
            .from(adPerformanceDaily)
            .where(and(
                eq(adPerformanceDaily.adAccountId, adAccountId),
                gte(adPerformanceDaily.date, startDate),
                lte(adPerformanceDaily.date, endDate)
            ))
            .groupBy(adPerformanceDaily.campaignId, adPerformanceDaily.campaignName)
            .orderBy(desc(sql`SUM(${adPerformanceDaily.spend})`));

        const campaigns = rawCampaigns.map(c => {
            const cSpend = pNum(c.spend);
            const cClicks = pNum(c.clicks);
            const cImpr = pNum(c.impressions);
            const cConv = pNum(c.conversions);
            return {
                campaignName: c.campaignName,
                spend: cSpend,
                clicks: cClicks,
                impressions: cImpr,
                conversions: cConv,
                ctr: safeDiv(cClicks, cImpr) * 100,
                cpc: safeDiv(cSpend, cClicks),
                cpa: safeDiv(cSpend, cConv),
                convRate: safeDiv(cConv, cClicks) * 100,
            };
        });

        return {
            success: true,
            data: { totals, timeSeries, campaigns }
        };

    } catch (error: any) {
        console.error("Failed to load dashboard metrics:", error);
        return { success: false, error: error.message };
    }
}