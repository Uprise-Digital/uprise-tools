import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { withBypassTenantDb } from "@/db/db-helper";
import { member, notifications } from "@/db/schema";

export type NotificationType =
  | "lp_speed_degraded"
  | "negative_keywords_added"
  | "negative_keywords_waste"
  | "report_generated"
  | "report_failed"
  | "generic_alert";

export type NotificationSeverity = "critical" | "warning" | "info" | "success";

export interface CreateNotificationParams {
  userId: string;
  organizationId?: string | null;
  adAccountId?: number | null;
  type: NotificationType | string;
  severity?: NotificationSeverity;
  title: string;
  message: string;
  link?: string | null;
  metadata?: Record<string, any> | null;
}

export interface CreateOrgNotificationParams {
  organizationId: string;
  adAccountId?: number | null;
  type: NotificationType | string;
  severity?: NotificationSeverity;
  title: string;
  message: string;
  link?: string | null;
  metadata?: Record<string, any> | null;
}

export interface GetUserNotificationsOptions {
  userId: string;
  organizationId?: string | null;
  filter?: "all" | "unread" | "critical";
  limit?: number;
  offset?: number;
}

/**
 * Creates a notification targeted to a single user.
 */
export async function createNotification(params: CreateNotificationParams) {
  return await withBypassTenantDb(async (tx) => {
    const id = crypto.randomUUID();
    const [created] = await tx
      .insert(notifications)
      .values({
        id,
        userId: params.userId,
        organizationId: params.organizationId || null,
        adAccountId: params.adAccountId || null,
        type: params.type,
        severity: params.severity || "info",
        title: params.title,
        message: params.message,
        link: params.link || null,
        metadata: params.metadata || null,
        isRead: false,
        createdAt: new Date(),
      })
      .returning();

    return created;
  });
}

/**
 * Creates a notification for ALL members of an organization (fan-out).
 * Useful for workspace-level alerts like LP speed degradation or report completions.
 */
export async function createOrgNotification(params: CreateOrgNotificationParams) {
  return await withBypassTenantDb(async (tx) => {
    // 1. Fetch all members belonging to this organization
    const orgMembers = await tx
      .select({ userId: member.userId })
      .from(member)
      .where(eq(member.organizationId, params.organizationId));

    if (!orgMembers || orgMembers.length === 0) {
      return [];
    }

    const records = orgMembers.map((m) => ({
      id: crypto.randomUUID(),
      userId: m.userId,
      organizationId: params.organizationId,
      adAccountId: params.adAccountId || null,
      type: params.type,
      severity: params.severity || "info",
      title: params.title,
      message: params.message,
      link: params.link || null,
      metadata: params.metadata || null,
      isRead: false,
      createdAt: new Date(),
    }));

    const created = await tx
      .insert(notifications)
      .values(records)
      .returning();

    return created;
  });
}

/**
 * Retrieves notifications for a specific user with filtering and pagination.
 */
export async function getUserNotifications(options: GetUserNotificationsOptions) {
  const { userId, organizationId, filter = "all", limit = 20, offset = 0 } = options;

  return await withBypassTenantDb(async (tx) => {
    const conditions = [eq(notifications.userId, userId)];

    if (organizationId) {
      conditions.push(eq(notifications.organizationId, organizationId));
    }

    if (filter === "unread") {
      conditions.push(eq(notifications.isRead, false));
    } else if (filter === "critical") {
      conditions.push(eq(notifications.severity, "critical"));
    }

    const rows = await tx
      .select()
      .from(notifications)
      .where(and(...conditions))
      .orderBy(desc(notifications.createdAt))
      .limit(limit)
      .offset(offset);

    return rows;
  });
}

/**
 * Retrieves the count of unread notifications for a user.
 */
export async function getUnreadNotificationCount(params: {
  userId: string;
  organizationId?: string | null;
}): Promise<number> {
  return await withBypassTenantDb(async (tx) => {
    const conditions = [
      eq(notifications.userId, params.userId),
      eq(notifications.isRead, false),
    ];

    if (params.organizationId) {
      conditions.push(eq(notifications.organizationId, params.organizationId));
    }

    const [result] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(notifications)
      .where(and(...conditions));

    return result?.count ?? 0;
  });
}

/**
 * Marks a specific notification as read.
 */
export async function markNotificationAsRead(params: {
  userId: string;
  notificationId: string;
}) {
  return await withBypassTenantDb(async (tx) => {
    const [updated] = await tx
      .update(notifications)
      .set({
        isRead: true,
        readAt: new Date(),
      })
      .where(
        and(
          eq(notifications.id, params.notificationId),
          eq(notifications.userId, params.userId),
        ),
      )
      .returning();

    return updated;
  });
}

/**
 * Marks all notifications for a user as read.
 */
export async function markAllNotificationsAsRead(params: {
  userId: string;
  organizationId?: string | null;
}) {
  return await withBypassTenantDb(async (tx) => {
    const conditions = [
      eq(notifications.userId, params.userId),
      eq(notifications.isRead, false),
    ];

    if (params.organizationId) {
      conditions.push(eq(notifications.organizationId, params.organizationId));
    }

    const updated = await tx
      .update(notifications)
      .set({
        isRead: true,
        readAt: new Date(),
      })
      .where(and(...conditions))
      .returning();

    return updated;
  });
}

/**
 * Deletes / dismisses a single notification.
 */
export async function deleteNotification(params: {
  userId: string;
  notificationId: string;
}) {
  return await withBypassTenantDb(async (tx) => {
    const [deleted] = await tx
      .delete(notifications)
      .where(
        and(
          eq(notifications.id, params.notificationId),
          eq(notifications.userId, params.userId),
        ),
      )
      .returning();

    return deleted;
  });
}
