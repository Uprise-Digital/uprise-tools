"use server";

import { db } from "@/db";
import { adAccounts } from "@/db/schema";
import { fetchMCCAccounts } from "@/lib/google-ads";
import { revalidatePath } from "next/cache";

export async function syncAdAccountsAction() {
    try {
        const data = await fetchMCCAccounts();
        const results = data.results || [];

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
        }

        revalidatePath("/admin/accounts");
        return { success: true, count: results.length };
    } catch (error) {
        console.error("Sync Error:", error);
        return { success: false, error: "Failed to sync accounts" };
    }
}