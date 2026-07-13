import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "@/app/api/cron/process-schedules/route";
import { db } from "@/db";

// 1. Mock PDF renderer to skip slow stream generation
vi.mock("@react-pdf/renderer", () => ({
  renderToStream: vi.fn().mockResolvedValue({
    [Symbol.asyncIterator]: async function* () {
      yield new Uint8Array([1, 2, 3]);
    },
  }),
}));

// 2. Mock AI service
vi.mock("@/lib/ai-service", () => ({
  generateReportInsights: vi.fn().mockResolvedValue({
    overall: "AI Mock Insights",
    scores: {},
  }),
  generateEmailBody: vi.fn().mockResolvedValue({
    emailBody: "Here is your automated client report.",
  }),
}));

// 3. Mock Google Ads client API calls
vi.mock("@/lib/google-ads", () => ({
  fetchAccountMonthlySummary: vi.fn().mockResolvedValue({}),
  fetchAccountKeywords: vi.fn().mockResolvedValue([]),
  fetchAccountLastMonthSummary: vi.fn().mockResolvedValue({}),
}));

// 4. Mock transform utilities
vi.mock("@/lib/report-utils", () => ({
  transformAdsData: vi.fn().mockReturnValue({
    clientName: "Test Client",
    summary: {},
    keywords: [],
    lastMonth: {},
  }),
}));

// 5. Mock PDF Component
vi.mock("@/service/pdf-service", () => ({
  MyReportPDF: () => null,
}));

describe("Cron Route Handler - Scheduled Reports Engine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "cron-test-secret";
    process.env.WORKER_SECRET_KEY = "worker-test-secret";

    // Mock reportSchedules query on db to prevent 500 errors in processReportPayload
    (db.query as any).reportSchedules = {
      findFirst: vi.fn().mockResolvedValue({
        id: 101,
        adAccountId: 12,
        recipientEmail: "client@test.com",
        dayOfMonth: 5,
        lastRunAt: null,
        customAiInstructions: "",
        emailSubject: "Test Email Subject",
      }),
    };
  });

  describe("GET Endpoint (Daily Cron Job)", () => {
    it("should return 401 Unauthorized if auth header is missing", async () => {
      const req = new Request("http://localhost/api/cron/process-schedules", {
        method: "GET",
      });

      const response = await GET(req);
      expect(response.status).toBe(401);

      const body = await response.json();
      expect(body.error).toBe("Unauthorized");
    });

    it("should return 401 Unauthorized if auth header is incorrect", async () => {
      const req = new Request("http://localhost/api/cron/process-schedules", {
        method: "GET",
        headers: {
          Authorization: "Bearer wrong-secret",
        },
      });

      const response = await GET(req);
      expect(response.status).toBe(401);
    });

    it("should return 200 and process due schedules successfully", async () => {
      // Mock Select builder chain
      const mockWhere = vi.fn().mockResolvedValue([
        {
          id: 101,
          adAccountId: 12,
          recipientEmail: "client@test.com",
          dayOfMonth: new Date().getDate(),
          lastRunAt: null,
          googleAccountId: "123-456-7890",
          clientName: "Test Client A",
        },
      ]);

      vi.spyOn(db, "select").mockImplementation(
        () =>
          ({
            from: () => ({
              innerJoin: () => ({
                where: mockWhere,
              }),
            }),
          }) as any,
      );

      const req = new Request("http://localhost/api/cron/process-schedules", {
        method: "GET",
        headers: {
          Authorization: "Bearer cron-test-secret",
        },
      });

      const response = await GET(req);
      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.processed).toBe(1);
      expect(body.results[0].status).toBe("SUCCESS");
      expect(body.results[0].clientName).toBe("Test Client A");
    });

    it("should handle when no schedules are due today", async () => {
      const mockWhere = vi.fn().mockResolvedValue([]);

      vi.spyOn(db, "select").mockImplementation(
        () =>
          ({
            from: () => ({
              innerJoin: () => ({
                where: mockWhere,
              }),
            }),
          }) as any,
      );

      const req = new Request("http://localhost/api/cron/process-schedules", {
        method: "GET",
        headers: {
          Authorization: "Bearer worker-test-secret",
        },
      });

      const response = await GET(req);
      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.processed).toBe(0);
      expect(body.results.length).toBe(0);
    });
  });

  describe("POST Endpoint (Manual / Single Trigger)", () => {
    it("should return 401 Unauthorized if auth header is missing", async () => {
      const req = new Request("http://localhost/api/cron/process-schedules", {
        method: "POST",
        body: JSON.stringify({
          scheduleId: 101,
          googleAccountId: "123-456-7890",
          clientName: "Manual Test Client",
        }),
      });

      const response = await POST(req);
      expect(response.status).toBe(401);
    });

    it("should return 400 Bad Request if parameters are missing", async () => {
      const req = new Request("http://localhost/api/cron/process-schedules", {
        method: "POST",
        headers: {
          Authorization: "Bearer cron-test-secret",
        },
        body: JSON.stringify({
          googleAccountId: "123-456-7890",
        }),
      });

      const response = await POST(req);
      expect(response.status).toBe(400);

      const body = await response.json();
      expect(body.error).toBe("Missing parameters");
    });

    it("should return 200 and process single report payload successfully", async () => {
      const req = new Request("http://localhost/api/cron/process-schedules", {
        method: "POST",
        headers: {
          Authorization: "Bearer cron-test-secret",
        },
        body: JSON.stringify({
          scheduleId: 101,
          googleAccountId: "123-456-7890",
          clientName: "Manual Test Client",
        }),
      });

      const response = await POST(req);
      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body.success).toBe(true);
    });
  });
});
