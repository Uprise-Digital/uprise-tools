"use server";

import { and, desc, eq, gte, lte, or } from "drizzle-orm";
import { headers } from "next/headers";
import { db } from "@/db";
import { backgroundTasks, member } from "@/db/schema";
import { auth } from "@/lib/auth";

export async function getActiveBackgroundTasksAction() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return { success: false, error: "Unauthorized" };
  }

  // Get active organization ID
  let orgId = session.session.activeOrganizationId;
  if (!orgId) {
    const userMember = await db.query.member.findFirst({
      where: eq(member.userId, session.user.id),
    });
    if (userMember) {
      orgId = userMember.organizationId;
    }
  }

  if (!orgId) {
    return { success: true, tasks: [] };
  }

  // Fetch tasks that are currently running, OR completed/failed within the last 10 seconds
  const tenSecondsAgo = new Date(Date.now() - 10 * 1000);
  const staleHeartbeatThreshold = new Date(Date.now() - 5 * 60 * 1000); // 5 min without heartbeat update
  const absoluteSafetyThreshold = new Date(Date.now() - 3 * 60 * 60 * 1000); // 3 hours absolute ceiling

  try {
    // Auto-expire stale running tasks only if heartbeat has stopped (>5 min) or total age >3 hours
    await db
      .update(backgroundTasks)
      .set({
        status: "failed",
        error: "Task timed out or was interrupted.",
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(backgroundTasks.organizationId, orgId),
          eq(backgroundTasks.status, "running"),
          or(
            lte(backgroundTasks.updatedAt, staleHeartbeatThreshold),
            lte(backgroundTasks.createdAt, absoluteSafetyThreshold),
          ),
        ),
      );
    const tasks = await db.query.backgroundTasks.findMany({
      where: and(
        eq(backgroundTasks.organizationId, orgId),
        or(
          eq(backgroundTasks.status, "running"),
          and(
            or(
              eq(backgroundTasks.status, "completed"),
              eq(backgroundTasks.status, "failed"),
            ),
            gte(backgroundTasks.updatedAt, tenSecondsAgo),
          ),
        ),
      ),
      orderBy: [desc(backgroundTasks.createdAt)],
    });

    return {
      success: true,
      tasks: tasks.map((t) => ({
        id: t.id,
        name: t.name,
        status: t.status as "running" | "completed" | "failed",
        error: t.error,
        totalItems: t.totalItems ?? null,
        completedItems: t.completedItems ?? 0,
        currentItem: t.currentItem ?? null,
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
      })),
    };
  } catch (error: any) {
    console.error("Failed to fetch background tasks:", error);
    return { success: false, error: error.message };
  }
}
