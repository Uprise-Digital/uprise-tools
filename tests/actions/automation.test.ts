import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  deleteReportScheduleAction,
  getEmailSendingHistoryAction,
  saveReportScheduleAction,
  triggerManualQueueTestAction,
} from "@/actions/automation.actions";
import { db } from "@/db";
import { auth } from "@/lib/auth";

describe("Report Automation Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CLOUDFLARE_WORKER_URL = "https://worker.test.com";
    process.env.WORKER_SECRET_KEY = "test-secret-key";

    // Default mock setup for successful session
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: {
        id: "test-user-id",
        name: "Test User",
        email: "test@uprise.com",
      },
      session: {
        activeOrganizationId: "org-test-123",
      },
    } as any);
  });

  describe("saveReportScheduleAction", () => {
    it("should successfully insert a new schedule", async () => {
      const result = await saveReportScheduleAction({
        adAccountId: 1,
        clientName: "Test Client",
        frequency: "MONTHLY",
        dayOfMonth: 5,
        recipientEmail: "client@test.com",
        ccEmails: "",
        useAiSummary: true,
        customAiInstructions: "",
        customMessage: "",
      });

      expect(result.success).toBe(true);
      expect(db.insert).toHaveBeenCalled();
    });

    it("should successfully update an existing schedule", async () => {
      const result = await saveReportScheduleAction({
        id: 42,
        adAccountId: 1,
        clientName: "Test Client",
        frequency: "MONTHLY",
        dayOfMonth: 5,
        recipientEmail: "client@test.com",
        ccEmails: "",
        useAiSummary: true,
        customAiInstructions: "",
        customMessage: "",
      });

      expect(result.success).toBe(true);
      expect(db.update).toHaveBeenCalled();
    });

    it("should return failure if unauthorized", async () => {
      vi.mocked(auth.api.getSession).mockResolvedValueOnce(null);

      const result = await saveReportScheduleAction({
        adAccountId: 1,
        clientName: "Test Client",
        frequency: "MONTHLY",
        dayOfMonth: 5,
        recipientEmail: "client@test.com",
        ccEmails: "",
        useAiSummary: true,
        customAiInstructions: "",
        customMessage: "",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to save automation rule.");
    });
  });

  describe("deleteReportScheduleAction", () => {
    it("should successfully delete a schedule", async () => {
      const result = await deleteReportScheduleAction(42);

      expect(result.success).toBe(true);
      expect(db.delete).toHaveBeenCalled();
    });
  });

  describe("triggerManualQueueTestAction", () => {
    it("should return error if schedule not found", async () => {
      const result = await triggerManualQueueTestAction({
        scheduleId: 42,
        googleAccountId: "123-456-7890",
        clientName: "Test Client",
        isTest: true,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Schedule 42 not found");
    });
  });

  describe("getEmailSendingHistoryAction", () => {
    it("should return email history for an ad account when authorized", async () => {
      const mockHistory = [
        {
          id: 1,
          recipient: "client@test.com",
          subject: "Monthly Report",
          emailType: "scheduled_report",
          status: "success",
          sentAt: new Date(),
        },
      ];
      vi.mocked(db.query.emailLogs.findMany).mockResolvedValueOnce(
        mockHistory as any,
      );

      const result = await getEmailSendingHistoryAction(1);

      expect(result.success).toBe(true);
      expect(result.history).toEqual(mockHistory);
    });

    it("should return failure if unauthorized", async () => {
      vi.mocked(auth.api.getSession).mockResolvedValueOnce(null);

      const result = await getEmailSendingHistoryAction(1);

      expect(result.success).toBe(false);
      expect(result.history).toEqual([]);
    });
  });
});
