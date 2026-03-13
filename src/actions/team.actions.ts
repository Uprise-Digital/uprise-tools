"use server";

import { db } from "@/db";
import { user, account } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { logAction } from "@/lib/audit";
import { auth } from "@/lib/auth"; // Your server auth instance to get the current admin
import { headers } from "next/headers";
// import bcrypt from "bcryptjs"; // Install this to hash the temp password

export async function getTeamMembers() {
    return await db.select().from(user);
}

export async function addTeamMember(formData: FormData) {
    const name = formData.get("name") as string;
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    // 1. Get the current admin performing the action
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) throw new Error("Unauthorized");

    // 2. Insert the user
    const newUserId = crypto.randomUUID();
    await db.insert(user).values({
        id: newUserId,
        name,
        email,
        emailVerified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
    });

    // 3. Insert the password (hashed) into the account table
    // const hashedPassword = await bcrypt.hash(password, 10);
    await db.insert(account).values({
        id: crypto.randomUUID(),
        accountId: newUserId,
        providerId: "credential",
        userId: newUserId,
        password: password, // IMPORTANT: Swap this for hashedPassword in production
        createdAt: new Date(),
        updatedAt: new Date(),
    });

    // 4. Fire the Audit Log
    await logAction(session.user.id, "CREATE_USER", "user", newUserId, { name, email });

    revalidatePath("/(main)/team");
}

export async function deleteTeamMember(targetUserId: string, targetUserName: string) {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) throw new Error("Unauthorized");

    // 1. Delete associated accounts first (foreign key constraint)
    await db.delete(account).where(eq(account.userId, targetUserId));

    // 2. Delete the user
    await db.delete(user).where(eq(user.id, targetUserId));

    // 3. Fire the Audit Log
    await logAction(session.user.id, "DELETE_USER", "user", targetUserId, { deletedName: targetUserName });

    revalidatePath("/(main)/team");
}