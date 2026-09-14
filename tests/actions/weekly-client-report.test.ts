import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/email-service", () => ({
  sendSystemEmail: vi
    .fn()
    .mockResolvedValue({ success: true, resendId: "mock-weekly-123" }),
}));

import {
  buildWeeklyClientReportHtml,
  buildWeeklyClientReportText,
  getWeeklyClientReportSettingsAction,
  saveWeeklyClientReportSettingsAction,
  sendWeeklyClientReportAction,
} from "@/actions/weekly-client-report.actions";

describe("Weekly Client Retention Report Actions", () => {
  it("should get default or saved weekly client report settings", async () => {
    const result = await getWeeklyClientReportSettingsAction();

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data?.sendDayOfWeek).toBeDefined();
    expect(result.data?.sendTime).toBeDefined();
    expect(Array.isArray(result.data?.recipients)).toBe(true);
  });

  it("should save weekly client report settings", async () => {
    const saveResult = await saveWeeklyClientReportSettingsAction({
      id: null,
      sendDayOfWeek: "monday",
      sendTime: "08:30",
      isActive: true,
      includeRiskWatchlist: true,
      includePerformanceMetrics: true,
      includeSentimentPrompt: true,
      recipients: ["team@uprise.com"],
    });

    expect(saveResult.success).toBe(true);
  });

  it("should build HTML and text content with pulse review invite call-to-action", async () => {
    const mockClients = [
      {
        id: "client-1",
        name: "Acme Corp",
        industry: "SaaS",
        managerName: "Alice",
        riskTier: "high" as const,
        compositeRiskScore: 75,
        riskFactors: ["Low sentiment", "High CPA"],
        staffRatingsCount: 1,
        recentSpend: 12500,
        recentLeads: 24,
        recentCpa: 52,
        leadsWowChange: -35,
        cpaVariance: 55,
        historicalTrend: "worsening" as const,
        latestNote: "CPA increased 15% over the weekend",
      },
      {
        id: "client-2",
        name: "Beta Logistics",
        industry: "Transport",
        managerName: "Bob",
        riskTier: "healthy" as const,
        compositeRiskScore: 18,
        riskFactors: [],
        staffRatingsCount: 0,
        recentSpend: 6200,
        recentLeads: 60,
        recentCpa: 19,
        leadsWowChange: 15,
        cpaVariance: -10,
        historicalTrend: "improving" as const,
        latestNote: null,
      },
    ];

    const mockSummary = {
      totalClients: 2,
      highRiskCount: 1,
      moderateRiskCount: 0,
      healthyCount: 1,
      avgPortfolioRisk: 46,
      pulseCoveragePercent: 50,
    };

    const html = await buildWeeklyClientReportHtml({
      pulseDate: "Sep 14, 2026",
      clients: mockClients,
      summary: mockSummary,
      options: {
        includeRiskWatchlist: true,
        includePerformanceMetrics: true,
        includeSentimentPrompt: true,
      },
      appBaseUrl: "http://localhost:3000",
    });

    expect(html).toContain("Weekly Client Status & Retention Digest");
    expect(html).toContain("Acme Corp");
    expect(html).toContain("Log Pulse Now");
    expect(html).toContain("Attention & Retention Watchlist");

    const text = await buildWeeklyClientReportText({
      pulseDate: "Sep 14, 2026",
      clients: mockClients,
      summary: mockSummary,
      appBaseUrl: "http://localhost:3000",
    });

    expect(text).toContain("WEEKLY CLIENT STATUS & RETENTION DIGEST");
    expect(text).toContain("Acme Corp");
    expect(text).toContain(
      "Please review clients and submit your weekly sentiment ratings",
    );
  });

  it("should trigger weekly client report dispatch via Resend API", async () => {
    const result = await sendWeeklyClientReportAction();

    expect(result.success).toBe(true);
    expect(result.message).toBeDefined();
  });
});
