import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST, processWeeklySpeedChecks } from "@/app/api/cron/speed-test/route";
import { db } from "@/db";
import * as pageSpeedService from "@/service/pagespeed.service";

describe("Weekly Landing Page Speed Test Cron Route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "mock_cron_secret";
  });

  describe("Authentication", () => {
    it("should return 401 when Authorization header is missing or invalid on POST", async () => {
      const req = new Request("http://localhost/api/cron/speed-test", {
        method: "POST",
        headers: {},
      });

      const res = await POST(req);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toBe("Unauthorized");
    });

    it("should return 401 when secret query param is invalid on GET", async () => {
      const req = new Request("http://localhost/api/cron/speed-test?secret=invalid_secret", {
        method: "GET",
      });

      const res = await GET(req);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toBe("Unauthorized");
    });
  });

  describe("Weekly Speed Processing Engine", () => {
    it("should process enrolled landing pages and return summary report", async () => {
      const mockAuditResult: pageSpeedService.PageSpeedAuditResult = {
        url: "https://test-client.com.au/plumbing",
        device: "mobile",
        performanceScore: 42, // Low score to trigger alert logic
        lcpMs: 4200,
        lcpDisplay: "4.2 s",
        clsScore: 0.15,
        clsDisplay: "0.15",
        inpMs: 180,
        inpDisplay: "180 ms",
        fcpMs: 2100,
        fcpDisplay: "2.1 s",
        ttfbMs: 600,
        ttfbDisplay: "600 ms",
        speedIndexMs: 3800,
        speedIndexDisplay: "3.8 s",
        totalByteWeight: 2400000,
        opportunities: [
          {
            id: "render-blocking-resources",
            title: "Eliminate render-blocking resources",
            description: "Resources are blocking the first paint of your page.",
            wastedMs: 1200,
          },
        ],
        diagnostics: {
          totalBytes: 2400000,
          jsBytes: 900000,
          imageBytes: 1200000,
          cssBytes: 200000,
          fontBytes: 80000,
          htmlBytes: 20000,
          otherBytes: 0,
          thirdPartyBytes: 600000,
        },
      };

      vi.spyOn(pageSpeedService, "runPageSpeedAudit").mockResolvedValue(
        mockAuditResult,
      );

      const report = await processWeeklySpeedChecks();

      expect(report.success).toBe(true);
      expect(report.processedCount).toBeGreaterThanOrEqual(1);
    });

    it("should return 200 via GET with valid secret", async () => {
      const req = new Request(
        "http://localhost/api/cron/speed-test?secret=mock_cron_secret",
        {
          method: "GET",
        },
      );

      const res = await GET(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
    });

    it("should return 200 via POST with valid Bearer token", async () => {
      const req = new Request("http://localhost/api/cron/speed-test", {
        method: "POST",
        headers: {
          authorization: "Bearer mock_cron_secret",
        },
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
    });
  });
});
