import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getPageSpeedSettingsAction,
  updatePageSpeedSettingsAction,
  updatePageSpeedAuditScopeAction,
  triggerTestAutoAuditAction,
} from "@/actions/settings.actions";
import { db } from "@/db";
import { auth } from "@/lib/auth";
import * as cronSpeedModule from "@/app/api/cron/speed-test/route";

describe("PageSpeed Settings & Auto-Audit Actions", () => {
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

  describe("getPageSpeedSettingsAction", () => {
    it("should return default settings when org has no custom metadata", async () => {
      vi.mocked(db.query.organization.findFirst).mockResolvedValueOnce({
        id: "org-test-uprise",
        name: "Test Org",
        metadata: null,
      } as any);

      const res = await getPageSpeedSettingsAction();
      expect(res.success).toBe(true);
      expect(res.settings).toBeDefined();
      expect(res.settings?.scope).toBe("ALL");
      expect(res.settings?.deviceStrategy).toBe("MOBILE");
      expect(res.settings?.autoAudit.enabled).toBe(false);
      expect(res.settings?.autoAudit.frequency).toBe("WEEKLY");
    });

    it("should return parsed settings when org has custom metadata", async () => {
      const customMeta = {
        pageSpeedAuditScope: "ENABLED_ONLY",
        pageSpeedDeviceStrategy: "BOTH",
        pageSpeedAutoAudit: {
          enabled: true,
          frequency: "MONTHLY",
          dayOfWeek: 1,
          dayOfMonth: 15,
          time: "03:00",
          lastRunAt: "2026-09-01T03:00:00.000Z",
        },
      };

      vi.mocked(db.query.organization.findFirst).mockResolvedValueOnce({
        id: "org-test-uprise",
        name: "Test Org",
        metadata: JSON.stringify(customMeta),
      } as any);

      const res = await getPageSpeedSettingsAction();
      expect(res.success).toBe(true);
      expect(res.settings?.scope).toBe("ENABLED_ONLY");
      expect(res.settings?.deviceStrategy).toBe("BOTH");
      expect(res.settings?.autoAudit.enabled).toBe(true);
      expect(res.settings?.autoAudit.frequency).toBe("MONTHLY");
      expect(res.settings?.autoAudit.dayOfMonth).toBe(15);
      expect(res.settings?.autoAudit.time).toBe("03:00");
    });

    it("should return unauthorized when session is missing", async () => {
      vi.mocked(auth.api.getSession).mockResolvedValueOnce(null as any);
      const res = await getPageSpeedSettingsAction();
      expect(res.success).toBe(false);
      expect(res.error).toBe("Unauthorized");
    });
  });

  describe("updatePageSpeedSettingsAction", () => {
    it("should update scope, device strategy, and schedule in org metadata", async () => {
      vi.mocked(db.query.organization.findFirst).mockResolvedValueOnce({
        id: "org-test-uprise",
        name: "Test Org",
        metadata: JSON.stringify({ existingProp: true }),
      } as any);

      const res = await updatePageSpeedSettingsAction({
        scope: "ENABLED_ONLY",
        deviceStrategy: "DESKTOP",
        autoAudit: {
          enabled: true,
          frequency: "WEEKLY",
          dayOfWeek: 2,
          dayOfMonth: 1,
          time: "04:30",
        },
      });

      expect(res.success).toBe(true);
      expect(db.update).toHaveBeenCalled();
    });

    it("should reject invalid time format", async () => {
      const res = await updatePageSpeedSettingsAction({
        scope: "ALL",
        deviceStrategy: "MOBILE",
        autoAudit: {
          enabled: true,
          frequency: "WEEKLY",
          dayOfWeek: 1,
          dayOfMonth: 1,
          time: "25:99",
        },
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain("Invalid time format");
    });

    it("should reject invalid day of month", async () => {
      const res = await updatePageSpeedSettingsAction({
        scope: "ALL",
        deviceStrategy: "MOBILE",
        autoAudit: {
          enabled: true,
          frequency: "MONTHLY",
          dayOfWeek: 1,
          dayOfMonth: 35,
          time: "02:00",
        },
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain("Day of month must be between 1 and 31");
    });
  });

  describe("updatePageSpeedAuditScopeAction", () => {
    it("should update audit scope successfully", async () => {
      vi.mocked(db.query.organization.findFirst).mockResolvedValueOnce({
        id: "org-test-uprise",
        metadata: "{}",
      } as any);

      const res = await updatePageSpeedAuditScopeAction("ENABLED_ONLY");
      expect(res.success).toBe(true);
      expect(db.update).toHaveBeenCalled();
    });
  });

  describe("triggerTestAutoAuditAction", () => {
    it("should invoke triggerAutomatedFullAuditForOrg in manual mode", async () => {
      vi.spyOn(cronSpeedModule, "triggerAutomatedFullAuditForOrg").mockResolvedValueOnce({
        success: true,
        pagesAudited: 8,
        testsCompleted: 16,
        message: "Completed test run for 8 landing pages (16 tests completed).",
      });

      const res = await triggerTestAutoAuditAction();
      expect(res.success).toBe(true);
      expect(cronSpeedModule.triggerAutomatedFullAuditForOrg).toHaveBeenCalledWith(
        "org-test-uprise",
        true,
      );
    });

    it("should return unauthorized when session is missing", async () => {
      vi.mocked(auth.api.getSession).mockResolvedValueOnce(null as any);
      const res = await triggerTestAutoAuditAction();
      expect(res.success).toBe(false);
      expect(res.error).toBe("Unauthorized");
    });
  });
});
