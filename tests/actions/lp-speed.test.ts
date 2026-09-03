import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getLandingPageSpeedDataAction,
  runLandingPageSpeedTestAction,
  toggleWeeklySpeedCheckAction,
} from "@/actions/lp-speed.actions";
import { db } from "@/db";
import { auth } from "@/lib/auth";
import * as pageSpeedService from "@/service/pagespeed.service";

describe("Landing Page Speed Testing Actions", () => {
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

  describe("getLandingPageSpeedDataAction", () => {
    it("should return landing page info and speed audit history", async () => {
      const result = await getLandingPageSpeedDataAction(10);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.landingPage.url).toBe(
        "https://test-client.com.au/plumbing",
      );
      expect(result.data?.latestTest?.performanceScore).toBe(88);
      expect(result.data?.history.length).toBeGreaterThan(0);
    });

    it("should return failure if unauthorized", async () => {
      vi.mocked(auth.api.getSession).mockResolvedValueOnce(null as any);

      const result = await getLandingPageSpeedDataAction(10);
      expect(result.success).toBe(false);
      expect(result.error).toBe("Unauthorized");
    });
  });

  describe("runLandingPageSpeedTestAction", () => {
    it("should invoke PageSpeed service and save results to DB", async () => {
      const mockAuditResult: pageSpeedService.PageSpeedAuditResult = {
        url: "https://test-client.com.au/plumbing",
        device: "mobile",
        performanceScore: 92,
        accessibilityScore: 95,
        bestPracticesScore: 90,
        seoScore: 100,
        lcpMs: 2100,
        lcpDisplay: "2.1 s",
        clsScore: 0.01,
        clsDisplay: "0.01",
        inpMs: 90,
        inpDisplay: "90 ms",
        fcpMs: 1000,
        fcpDisplay: "1.0 s",
        ttfbMs: 300,
        ttfbDisplay: "300 ms",
        speedIndexMs: 1800,
        speedIndexDisplay: "1.8 s",
        totalByteWeight: 950000,
        opportunities: [],
        diagnostics: {
          totalBytes: 950000,
          jsBytes: 300000,
          imageBytes: 500000,
          cssBytes: 80000,
          fontBytes: 50000,
          htmlBytes: 20000,
          otherBytes: 0,
          thirdPartyBytes: 200000,
        },
      };

      vi.spyOn(pageSpeedService, "runPageSpeedAudit").mockResolvedValueOnce(
        mockAuditResult,
      );

      const result = await runLandingPageSpeedTestAction(10, "mobile");

      expect(pageSpeedService.runPageSpeedAudit).toHaveBeenCalledWith(
        "https://test-client.com.au/plumbing",
        "mobile",
        undefined,
      );
      expect(db.insert).toHaveBeenCalled();
    });

    it("should pass custom audit options (engine, key, throttle) to service", async () => {
      const mockAuditResult: pageSpeedService.PageSpeedAuditResult = {
        url: "https://test-client.com.au/plumbing",
        device: "desktop",
        performanceScore: 92,
        lcpMs: 1400,
        lcpDisplay: "1.4 s",
        clsScore: 0.02,
        clsDisplay: "0.020",
        inpMs: 50,
        inpDisplay: "50 ms",
        fcpMs: 900,
        fcpDisplay: "0.9 s",
        ttfbMs: 150,
        ttfbDisplay: "150 ms",
        speedIndexMs: 1200,
        speedIndexDisplay: "1.2 s",
        totalByteWeight: 600000,
        opportunities: [],
        diagnostics: {
          totalBytes: 600000,
          jsBytes: 200000,
          imageBytes: 300000,
          cssBytes: 50000,
          fontBytes: 30000,
          htmlBytes: 20000,
          otherBytes: 0,
          thirdPartyBytes: 150000,
        },
        engineUsed: "Real-Time Edge Profiler (Lighthouse v11 Algorithm)",
      };

      vi.spyOn(pageSpeedService, "runPageSpeedAudit").mockResolvedValueOnce(
        mockAuditResult,
      );

      const customOptions: pageSpeedService.SpeedAuditOptions = {
        engine: "edge",
        networkProfile: "fast_4g",
        cpuThrottle: "2x",
      };

      const result = await runLandingPageSpeedTestAction(10, "desktop", customOptions);

      expect(result.success).toBe(true);
      expect(pageSpeedService.runPageSpeedAudit).toHaveBeenCalledWith(
        "https://test-client.com.au/plumbing",
        "desktop",
        customOptions,
      );
    });
  });

  describe("toggleWeeklySpeedCheckAction", () => {
    it("should toggle weekly speed check flag to true", async () => {
      const result = await toggleWeeklySpeedCheckAction(10, true);

      expect(result.success).toBe(true);
      expect(db.update).toHaveBeenCalled();
    });

    it("should toggle weekly speed check flag to false", async () => {
      const result = await toggleWeeklySpeedCheckAction(10, false);

      expect(result.success).toBe(true);
      expect(db.update).toHaveBeenCalled();
    });
  });
});
