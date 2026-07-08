import { describe, it, expect, vi } from "vitest";
import {
  getCampaignLandingPagesAction,
  syncCampaignLandingPagesAction,
  saveCampaignLandingPageAction,
  runLandingPageAuditAction,
  getAuditDetailAction,
} from "@/actions/lp-analysis.actions";
import { db } from "@/db";

describe("Landing Page CRO Analysis Actions", () => {
  it("should retrieve campaign landing pages and attach latest audit scores", async () => {
    const result = await getCampaignLandingPagesAction(1);
    
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data?.length).toBeGreaterThan(0);
    
    const campaign = result.data![0];
    expect(campaign.campaignId).toBe("camp-1");
    expect(campaign.latestAudit).not.toBeNull();
    expect(campaign.latestAudit?.score).toBe(85);
  });

  it("should sync landing pages from Google Ads API", async () => {
    const result = await syncCampaignLandingPagesAction(1);
    
    expect(result.success).toBe(true);
    expect(result.count).toBe(1);
  });

  it("should connect a landing page URL manually to a campaign", async () => {
    const result = await saveCampaignLandingPageAction(
      1,
      "camp-1",
      "Plumbing Campaign",
      "https://test-client.com.au/plumbing-v2"
    );
    
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
  });

  it("should fail to save manual URLs that do not begin with http/https protocols", async () => {
    const result = await saveCampaignLandingPageAction(
      1,
      "camp-1",
      "Plumbing Campaign",
      "test-client.com.au/plumbing"
    );
    
    expect(result.success).toBe(false);
    expect(result.error).toContain("URL must begin with http:// or https://");
  });

  it("should run a landing page audit, fetch competitors, evaluate dimensions using Gemini, and save to DB", async () => {
    const result = await runLandingPageAuditAction(
      1,
      "camp-1",
      "Plumbing Campaign",
      "https://test-client.com.au/plumbing",
      "emergency plumber gold coast"
    );

    expect(result.success).toBe(true);
    expect(result.data?.auditId).toBeDefined();
    expect(result.data?.score).toBe(85);
  });

  it("should retrieve detailed audit report by ID", async () => {
    const result = await getAuditDetailAction(100);
    
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data?.score).toBe(85);
    expect(result.data?.heroScore).toBe(8);
    expect(result.data?.ctaScore).toBe(9);
  });
});
