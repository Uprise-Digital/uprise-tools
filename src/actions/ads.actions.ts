"use server";

import { db } from "@/db";
import { adAccounts } from "@/db/schema";
import { fetchMCCAccounts } from "@/lib/google-ads";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import {logAction} from "@/lib/audit";

export async function syncAdAccountsAction() {
    // 1. Auth Check
    const session = await auth.api.getSession({
        headers: await headers()
    });

    if (!session) {
        throw new Error("Unauthorized");
    }

    try {
        console.log(`[Sync] Initiating MCC account sync by ${session.user.email}...`);

        const data = await fetchMCCAccounts();
        const results = data.results || [];
        let syncCount = 0;

        for (const row of results) {
            const client = row.customerClient;

            // Only sync active accounts
            if (client.status !== "ENABLED") continue;

            await db.insert(adAccounts)
                .values({
                    googleAccountId: client.id,
                    name: client.descriptiveName || "Unnamed Account",
                    currencyCode: client.currencyCode,
                    timeZone: client.timeZone,
                    lastSyncedAt: new Date(),
                })
                .onConflictDoUpdate({
                    target: adAccounts.googleAccountId,
                    set: {
                        name: client.descriptiveName || "Unnamed Account",
                        lastSyncedAt: new Date(),
                    }
                });

            syncCount++;
        }

        // SUCCESS LOGGING
        await logAction(
            session.user.id,
            "SYNC_MCC_ACCOUNTS",
            "ad_accounts",
            "MCC_ROOT",
            {
                accountsProcessed: results.length,
                accountsEnabled: syncCount,
                status: "SUCCESS"
            }
        );

        revalidatePath("/admin/accounts");
        return { success: true, count: syncCount };

    } catch (error: any) {
        // FAILURE LOGGING
        await logAction(
            session.user.id,
            "SYNC_MCC_ACCOUNTS_FAILED",
            "ad_accounts",
            "MCC_ROOT",
            { error: error.message || "Google Ads API connection failed" }
        );

        console.error("Sync Error:", error);
        return { success: false, error: "Failed to sync accounts" };
    }
}