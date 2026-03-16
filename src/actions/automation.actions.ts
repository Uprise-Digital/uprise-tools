"use server";

import { db } from "@/db";
import { reportSchedules } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import {auth} from "@/lib/auth";
import {headers} from "next/headers";
import {send} from "@vercel/queue";
import {logAction} from "@/lib/audit";

/**
 * Handles both creating new schedules and updating existing ones.
 */
export async function saveReportScheduleAction(data: {
    id?: number | null;
    adAccountId: number;
    clientName: string;
    frequency: string;
    dayOfMonth: number;
    recipientEmail: string;
    ccEmails: string;
    useAiSummary: boolean;
    customAiInstructions: string;
    customMessage: string;
}) {
    try {
        const payload = {
            adAccountId: data.adAccountId,
            frequency: data.frequency,
            dayOfMonth: data.dayOfMonth,
            recipientEmail: data.recipientEmail,
            ccEmails: data.ccEmails,
            emailSubject: `Monthly Performance Report - ${data.clientName}`,
            useAiSummary: data.useAiSummary,
            customAiInstructions: data.customAiInstructions,
            customMessage: data.customMessage,
            isActive: true,
        };

        if (data.id) {
            // UPDATE existing record
            await db
                .update(reportSchedules)
                .set(payload)
                .where(eq(reportSchedules.id, data.id));
        } else {
            // INSERT new record
            await db.insert(reportSchedules).values(payload);
        }

        revalidatePath("/admin/accounts");
        return { success: true };
    } catch (error) {
        console.error("Failed to save schedule:", error);
        return { success: false, error: "Failed to save automation rule." };
    }
}

/**
 * Deletes a specific report schedule by ID.
 */
export async function deleteReportScheduleAction(id: number) {
    try {
        await db.delete(reportSchedules).where(eq(reportSchedules.id, id));

        revalidatePath("/admin/accounts");
        return { success: true };
    } catch (error) {
        console.error("Failed to delete schedule:", error);
        return { success: false, error: "Failed to delete automation rule." };
    }
}

export async function triggerManualQueueTestAction(params: {
    scheduleId: number;
    googleAccountId: string;
    clientName: string;
    isTest: boolean;
}) {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) throw new Error("Unauthorized");

    try {
        await send("google-ads-reports", {
            ...params,
            triggeredBy: session.user.email
        });

        await logAction(
            session.user.id,
            "MANUAL_RULE_TEST",
            "report_schedules",
            params.scheduleId.toString(),
            { clientName: params.clientName, isTest: params.isTest }
        );

        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}