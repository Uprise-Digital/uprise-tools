import { db } from "@/db";
import { auditLogs } from "@/db/schema";

export async function logAction(
    actorId: string,
    action: string,
    targetTable: string,
    targetId: string | number,
    metadata?: any
) {
    await db.insert(auditLogs).values({
        actorId,
        action,
        targetTable,
        targetId: String(targetId), // Cast to string for consistency
        metadata,
    });
}