"use server";

import { db } from "@/db";
import { user } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import {logAction} from "@/lib/audit";

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
            { deletedName: target.name, deletedEmail: target.email }
        );

        revalidatePath("/(main)/team");
        return { success: true };

    } catch (error: any) {
        // FAILURE LOGGING
        await logAction(
            session.user.id,
            "DELETE_USER_FAILED",
            "user",
            targetUserId,
            { error: error.message || "Database error" }
        );

        console.error("Failed to delete team member:", error);
        return { success: false, error: "Failed to delete user" };
    }
}