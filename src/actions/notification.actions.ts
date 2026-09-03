"use server";

import { getAuthOrgContext } from "@/lib/auth-helpers";
import {
  deleteNotification,
  getUnreadNotificationCount,
  getUserNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from "@/service/notification.service";

/**
 * Fetch notifications for the current authenticated user.
 */
export async function getNotificationsAction(filter: "all" | "unread" | "critical" = "all") {
  const ctx = await getAuthOrgContext();
  if (!ctx) {
    return { success: false, error: "Unauthorized", notifications: [] };
  }

  try {
    const rows = await getUserNotifications({
      userId: ctx.userId,
      organizationId: ctx.orgId,
      filter,
      limit: 30,
    });

    return { success: true, notifications: rows };
  } catch (err: any) {
    console.error("[Notification Action] Failed to fetch notifications:", err);
    return { success: false, error: err.message || "Failed to fetch notifications", notifications: [] };
  }
}

/**
 * Fetch the unread notification count for the current user.
 */
export async function getUnreadNotificationCountAction() {
  const ctx = await getAuthOrgContext();
  if (!ctx) {
    return { success: false, count: 0 };
  }

  try {
    const count = await getUnreadNotificationCount({
      userId: ctx.userId,
      organizationId: ctx.orgId,
    });

    return { success: true, count };
  } catch (err: any) {
    console.error("[Notification Action] Failed to fetch unread count:", err);
    return { success: false, count: 0 };
  }
}

/**
 * Mark a single notification as read.
 */
export async function markNotificationAsReadAction(notificationId: string) {
  const ctx = await getAuthOrgContext();
  if (!ctx) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    const updated = await markNotificationAsRead({
      userId: ctx.userId,
      notificationId,
    });

    return { success: true, updated };
  } catch (err: any) {
    console.error("[Notification Action] Failed to mark notification as read:", err);
    return { success: false, error: err.message || "Failed to mark as read" };
  }
}

/**
 * Mark all notifications for the current user as read.
 */
export async function markAllNotificationsAsReadAction() {
  const ctx = await getAuthOrgContext();
  if (!ctx) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    const updated = await markAllNotificationsAsRead({
      userId: ctx.userId,
      organizationId: ctx.orgId,
    });

    return { success: true, count: updated.length };
  } catch (err: any) {
    console.error("[Notification Action] Failed to mark all as read:", err);
    return { success: false, error: err.message || "Failed to mark all as read" };
  }
}

/**
 * Delete / dismiss a notification.
 */
export async function deleteNotificationAction(notificationId: string) {
  const ctx = await getAuthOrgContext();
  if (!ctx) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    const deleted = await deleteNotification({
      userId: ctx.userId,
      notificationId,
    });

    return { success: true, deleted };
  } catch (err: any) {
    console.error("[Notification Action] Failed to delete notification:", err);
    return { success: false, error: err.message || "Failed to delete notification" };
  }
}
