import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  deleteNotificationAction,
  getNotificationsAction,
  getUnreadNotificationCountAction,
  markAllNotificationsAsReadAction,
  markNotificationAsReadAction,
} from "@/actions/notification.actions";
import { auth } from "@/lib/auth";
import * as notificationService from "@/service/notification.service";

describe("Notification Actions & Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: {
        id: "test-user-id",
        name: "Test User",
        email: "test@uprise.com",
      },
      session: {
        activeOrganizationId: "org-test-uprise",
      },
    } as any);
  });

  describe("getNotificationsAction", () => {
    it("should return notifications for authenticated user", async () => {
      const mockNotifications = [
        {
          id: "notif-1",
          userId: "test-user-id",
          organizationId: "org-test-uprise",
          adAccountId: 10,
          type: "lp_speed_degraded",
          severity: "critical",
          title: "Speed Degraded",
          message: "LCP surged to 5.2s",
          link: "/lp-analysis/speed/10",
          metadata: { score: 45 },
          isRead: false,
          createdAt: new Date(),
        },
      ];

      vi.spyOn(notificationService, "getUserNotifications").mockResolvedValueOnce(
        mockNotifications as any,
      );

      const result = await getNotificationsAction("all");
      expect(result.success).toBe(true);
      expect(result.notifications).toHaveLength(1);
      expect(result.notifications[0].title).toBe("Speed Degraded");
    });

    it("should return failure if unauthorized", async () => {
      vi.mocked(auth.api.getSession).mockResolvedValueOnce(null as any);

      const result = await getNotificationsAction("all");
      expect(result.success).toBe(false);
      expect(result.error).toBe("Unauthorized");
    });
  });

  describe("getUnreadNotificationCountAction", () => {
    it("should return unread count for user", async () => {
      vi.spyOn(
        notificationService,
        "getUnreadNotificationCount",
      ).mockResolvedValueOnce(3);

      const result = await getUnreadNotificationCountAction();
      expect(result.success).toBe(true);
      expect(result.count).toBe(3);
    });
  });

  describe("markNotificationAsReadAction", () => {
    it("should mark a single notification as read", async () => {
      vi.spyOn(
        notificationService,
        "markNotificationAsRead",
      ).mockResolvedValueOnce({
        id: "notif-1",
        isRead: true,
      } as any);

      const result = await markNotificationAsReadAction("notif-1");
      expect(result.success).toBe(true);
      expect(result.updated?.isRead).toBe(true);
    });
  });

  describe("markAllNotificationsAsReadAction", () => {
    it("should mark all user notifications as read", async () => {
      vi.spyOn(
        notificationService,
        "markAllNotificationsAsRead",
      ).mockResolvedValueOnce([
        { id: "notif-1", isRead: true },
        { id: "notif-2", isRead: true },
      ] as any);

      const result = await markAllNotificationsAsReadAction();
      expect(result.success).toBe(true);
      expect(result.count).toBe(2);
    });
  });

  describe("deleteNotificationAction", () => {
    it("should delete a notification", async () => {
      vi.spyOn(notificationService, "deleteNotification").mockResolvedValueOnce({
        id: "notif-1",
      } as any);

      const result = await deleteNotificationAction("notif-1");
      expect(result.success).toBe(true);
      expect(result.deleted?.id).toBe("notif-1");
    });
  });
});
