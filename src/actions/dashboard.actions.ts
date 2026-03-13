"use server";

import { db } from "@/db";
import { user } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

// Fetch all agency users
export async function getTeamMembers() {
    return await db.select().from(user);
}

// Delete a user
export async function deleteTeamMember(userId: string) {
    // In a real app, you might want to reassign their Alert Rules before deleting!
    await db.delete(user).where(eq(user.id, userId));

    // This tells Next.js to refresh the UI immediately after deletion
    revalidatePath("/(main)/team");
}