"use server";

import {db} from "@/db";
import {adPerformanceDaily, user} from "@/db/schema";
import {revalidatePath} from "next/cache";
import {auth} from "@/lib/auth";
import {headers} from "next/headers";
import {logAction} from "@/lib/audit";
import {and, eq, gte, lte, sql} from "drizzle-orm";
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
        spend: (row.metrics.cost_micros / 1_000_000).toFixed(2),
        impressions: parseInt(row.metrics.impressions || "0", 10),
        clicks: parseInt(row.metrics.clicks || "0", 10),
        conversions: parseFloat(row.metrics.conversions || "0").toFixed(2),
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
        // ---------------------------------------------------------
        // 1. TEMPORARY SYNC: Remove this line when cron is ready!
        // ---------------------------------------------------------
        await syncGoogleAdsDataToDb(adAccountId, googleAccountId, startDate, endDate);
        // ---------------------------------------------------------

        // 2. QUERY THE DATABASE (This is how it works forever)
        const [totals] = await db.select({
            totalSpend: sql<number>`SUM
                (${adPerformanceDaily.spend})`,
            totalClicks: sql<number>`SUM
                (${adPerformanceDaily.clicks})`,
            totalImpressions: sql<number>`SUM
                (${adPerformanceDaily.impressions})`,
            totalConversions: sql<number>`SUM
                (${adPerformanceDaily.conversions})`,
        })
            .from(adPerformanceDaily)
            .where(and(
                eq(adPerformanceDaily.adAccountId, adAccountId),
                gte(adPerformanceDaily.date, startDate),
                lte(adPerformanceDaily.date, endDate)
            ));

        const timeSeries = await db.select({
            date: adPerformanceDaily.date,
            spend: sql<number>`SUM
                (${adPerformanceDaily.spend})`,
            conversions: sql<number>`SUM
                (${adPerformanceDaily.conversions})`,
            clicks: sql<number>`SUM
                (${adPerformanceDaily.clicks})`,
        })
            .from(adPerformanceDaily)
            .where(and(
                eq(adPerformanceDaily.adAccountId, adAccountId),
                gte(adPerformanceDaily.date, startDate),
                lte(adPerformanceDaily.date, endDate)
            ))
            .groupBy(adPerformanceDaily.date)
            .orderBy(adPerformanceDaily.date);

        return {
            success: true,
            data: {
                totals: totals || {totalSpend: 0, totalClicks: 0, totalImpressions: 0, totalConversions: 0},
                timeSeries
            }
        };

    } catch (error: any) {
        console.error("Failed to load dashboard metrics:", error);
        return {success: false, error: error.message};
    }
}