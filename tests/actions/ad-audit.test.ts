import { describe, expect, it } from "vitest";
import {
  getAdCopyAuditDetailsAction,
  getAssetPerformanceReportAction,
  listAdGroupAdsAction,
  runAdCopyAuditAction,
} from "@/actions/ad-audit.actions";

describe("Ad Copy & Creative Diagnostics Actions", () => {
  it("should list ad group ads with latest audit details linked", async () => {
    const result = await listAdGroupAdsAction(1);

    if (!result.success) throw new Error(result.error);
    expect(result.data).toBeDefined();
    expect(result.data.length).toBeGreaterThan(0);

    const ad = result.data[0];
    expect(ad.adId).toBe("ad-1");
    expect(ad.campaignName).toBe("Plumbing Campaign");
    expect(ad.latestAuditScore).toBe(85);
  });

  it("should generate a lightweight asset performance report including pinning conflicts", async () => {
    const result = await getAssetPerformanceReportAction(1);

    if (!result.success) throw new Error(result.error);
    expect(result.data).toBeDefined();
    expect(result.data.totalAssetsAudited).toBe(3);
    expect(result.data.bestCount).toBe(1);
    expect(result.data.lowCount).toBe(1);

    expect(result.data.pinningConflicts.length).toBe(1);
    expect(result.data.pinningConflicts[0].text).toBe("Headline 2");
    expect(result.data.pinningConflicts[0].pinnedField).toBe("HEADLINE_2");
  });

  it("should execute a full ad copy audit utilizing Gemini and save results to DB", async () => {
    const result = await runAdCopyAuditAction(
      1,
      "camp-1",
      "Plumbing Campaign",
      "adgroup-1",
      "AdGroup 1",
      "ad-1",
      "emergency plumber gold coast",
      "https://test-client.com.au/plumbing",
    );

    if (!result.success) throw new Error(result.error);
    expect(result.data).toBeDefined();
    expect(result.data.auditId).toBeDefined();
    expect(result.data.score).toBe(85);
  });

  it("should fetch detailed audit results including AI breakdown and scripts", async () => {
    const result = await getAdCopyAuditDetailsAction(1);

    if (!result.success) throw new Error(result.error);
    expect(result.data).toBeDefined();
    expect(result.data.id).toBe(1);
    expect(result.data.score).toBe(85);
    expect((result.data.aiAnalysis as any).client_action_script).toBe(
      "Mock script",
    );
  });
});
