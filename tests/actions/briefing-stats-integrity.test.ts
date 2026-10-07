import { describe, expect, it, vi } from "vitest";

// Mock AI logger and Gemini calls
const mockGenerateContentTracked = vi.fn();
vi.mock("@/lib/ai-logger", () => ({
  generateContentTracked: (...args: any[]) =>
    mockGenerateContentTracked(...args),
}));

vi.mock("@/actions/briefing-settings.actions", () => ({
  getBriefingSettingsAction: vi.fn().mockResolvedValue({
    success: true,
    data: { dataPoints: {} },
  }),
}));

import { generateBriefingAction } from "@/actions/briefing.actions";
import { generateMorningBriefingText } from "@/lib/ai-service";

describe("Morning Briefing Stats Integrity", () => {
  const mockBriefingData = {
    todayDayOfWeek: "Wednesday",
    todayDateStr: "7 October 2026",
    yesterdayDayOfWeek: "Tuesday",
    yesterdayDateStr: "6 October 2026",
    totals: {
      spend: 981.02,
      conversions: 4,
      cpa: 245.25,
      activeAccounts: 17,
    },
    whaleAnalysis: {
      whaleName: "",
      spendSharePct: 0,
      whaleSpend: 0,
      longTailCpa: 0,
      hasWhale: false,
    },
    alerts: [
      {
        accountName: "Demolition4u #2",
        type: "CRITICAL SPEND",
        details: "Spent $146.76 with 0 conversions",
        statsText: "Spend: $146.76 | Conv: 0 (Target: $120.00)",
        targetCpa: 120,
      },
    ],
    zeroConversionAccountsCount: 6,
    successes: [
      {
        accountName: "AI Smart Glass (OA/OC)",
        details:
          "Beat target CPA ($25.45 vs agreed target $55.00, -54%) [Client Context: Google ads - $55]",
        statsText: "Spend: $50.89 | Conv: 2 | CPA: $25.45 (Target: $55.00)",
        targetCpa: 55,
        cpa: 25.45,
        conversions: 2,
        spend: 50.89,
      },
    ],
  };

  it("should preserve statsText in prompt construction even when details is present", async () => {
    let capturedPrompt = "";
    mockGenerateContentTracked.mockImplementation(async (payload: any) => {
      capturedPrompt = payload.contents;
      return {
        response: {
          text: JSON.stringify({
            subject: "☀️ Morning Briefing",
            macroSummary: "Summary",
            whaleAnalysisCommentary: "",
            alerts: [],
            zeroConversionFootnote: "",
            successes: [
              {
                accountName: "AI Smart Glass (OA/OC)",
                statsText:
                  "Spend: $50.89 | Conv: 2 | CPA: $25.45 (Target: $55.00)",
                details: "Great job beating target.",
              },
            ],
            priorityList: [],
          }),
        },
      };
    });

    await generateMorningBriefingText(mockBriefingData);

    // Verify prompt does NOT discard statsText when details is present
    expect(capturedPrompt).toContain(
      "[Spend: $50.89 | Conv: 2 | CPA: $25.45 (Target: $55.00)]",
    );
    expect(capturedPrompt).toContain(
      "Beat target CPA ($25.45 vs agreed target $55.00, -54%)",
    );
    expect(capturedPrompt).toContain(
      "[Spend: $146.76 | Conv: 0 (Target: $120.00)]",
    );
    expect(capturedPrompt).toContain("CRITICAL STATS INTEGRITY");
  });

  it("should reconcile and overwrite hallucinated LLM statsText with database ground truth", async () => {
    // Simulate AI returning hallucinated stats (e.g. 1 conversion at $25.45 spend)
    mockGenerateContentTracked.mockResolvedValueOnce({
      response: {
        text: JSON.stringify({
          subject: "☀️ Morning Briefing — Wednesday 7 October 2026",
          macroSummary: "Yesterday spend was $981.02 with 4 conversions.",
          whaleAnalysisCommentary: "",
          alerts: [
            {
              accountName: "Demolition4u #2",
              // AI hallucinated statsText
              statsText: "Spend: $100.00 | Conv: 0",
              details: "High spend without conversions.",
            },
          ],
          zeroConversionFootnote: "",
          successes: [
            {
              accountName: "AI Smart Glass (OA/OC)",
              // AI hallucinated 1 conversion at $25.45 spend
              statsText:
                "Spend: $25.45 | Conv: 1 | CPA: $25.45 (Target: $55.00)",
              details: "Strongly outperformed expectations.",
            },
          ],
          priorityList: [],
        }),
      },
    });

    const result = await generateBriefingAction(mockBriefingData);

    expect(result.success).toBe(true);
    expect(result.briefing).toBeDefined();

    const aiSmartGlassSuccess = result.briefing?.successes?.find(
      (s: any) => s.accountName === "AI Smart Glass (OA/OC)",
    );
    expect(aiSmartGlassSuccess).toBeDefined();
    // Must be reconciled to ground truth: 2 conversions and $50.89 spend!
    expect(aiSmartGlassSuccess?.statsText).toBe(
      "Spend: $50.89 | Conv: 2 | CPA: $25.45 (Target: $55.00)",
    );

    const alertItem = result.briefing?.alerts?.find(
      (a: any) => a.accountName === "Demolition4u #2",
    );
    expect(alertItem).toBeDefined();
    expect(alertItem?.statsText).toBe(
      "Spend: $146.76 | Conv: 0 (Target: $120.00)",
    );
  });
});
