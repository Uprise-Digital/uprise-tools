import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  deleteReportScheduleAction,
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
    it("should call fetch with worker URL if authorized", async () => {
      const mockFetch = vi.spyOn(global, "fetch").mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve("OK"),
      } as any);

      const result = await triggerManualQueueTestAction({
        scheduleId: 42,
        googleAccountId: "123-456-7890",
        clientName: "Test Client",
        isTest: true,
      });

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        "https://worker.test.com",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: "Bearer test-secret-key",
          }),
        }),
      );
    });

    it("should throw an error if CLOUDFLARE_WORKER_URL is missing", async () => {
      delete process.env.CLOUDFLARE_WORKER_URL;

      const result = await triggerManualQueueTestAction({
        scheduleId: 42,
        googleAccountId: "123-456-7890",
        clientName: "Test Client",
        isTest: true,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Missing CLOUDFLARE_WORKER_URL");
    });
  });
});
