"use server";

import { db } from "@/db";
import { adAccounts, alertRules, notificationRoutes, user } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { logAction } from "@/lib/audit";

// 1. Fetch data for the form dropdowns
export async function getRuleFormData() {
    const accounts = await db.select().from(adAccounts).where(eq(adAccounts.isActive, true));
    const team = await db.select().from(user);
    return { accounts, team };
}

// 2. Process and save the new rule
export async function createAlertRule(formData: {
    adAccountId: number;
    metric: string;
    timeWindow: string;
    operator: string;
    threshold: string;
    frequency: string;
    notifyUserIds: string[];
}) {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) throw new Error("Unauthorized");

    // A. Insert the main rule and get the new ID back
    const [newRule] = await db.insert(alertRules).values({
        adAccountId: formData.adAccountId,
        metric: formData.metric,
        timeWindow: formData.timeWindow,
        operator: formData.operator,
        threshold: formData.threshold,
        frequency: formData.frequency,
    }).returning({ id: alertRules.id });

    // B. Bulk insert the notification routes (who gets the email)
    if (formData.notifyUserIds.length > 0) {
        const routesToInsert = formData.notifyUserIds.map(userId => ({
            ruleId: newRule.id,
            emailAddress: userId, // We are storing the User ID here temporarily so we can join it easily, or you can fetch the email. Let's assume we store the ID or email.
            // Note: If your schema expects strictly an email string, you might want to fetch the emails for these IDs first.
            // For simplicity based on our earlier schema, let's assume `emailAddress` in schema can hold the user ID reference, or you fetch the actual email.
        }));

        // Quick fetch to get actual emails based on IDs to match our schema
        const usersToNotify = await db.select({
            email: user.email,
            id: user.id
        })
            .from(user)
            .where(inArray(user.id, formData.notifyUserIds));

        const emailRoutes = usersToNotify.map(u => ({
            ruleId: newRule.id,
            emailAddress: u.email
        }));

        await db.insert(notificationRoutes).values(emailRoutes);
    }

    // C. Fire the Audit Log
    await logAction(
        session.user.id,
        "CREATE_RULE",
        "alert_rules",
        newRule.id,
        { metric: formData.metric, threshold: formData.threshold }
    );

    revalidatePath("/rules");
    redirect("/rules");
}