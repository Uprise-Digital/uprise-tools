"use server";

import { and, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import {
  adAccounts,
  campaignLandingPages,
  landingPageSpeedTests,
} from "@/db/schema";
import { logAction } from "@/lib/audit";
import { getAuthOrgContext } from "@/lib/auth-helpers";
import {
  type PageSpeedAuditResult,
  runPageSpeedAudit,
} from "@/service/pagespeed.service";

export interface LandingPageSpeedData {
  landingPage: {
    id: number;
    adAccountId: number;
    campaignId: string;
    campaignName: string;
    url: string;
    status: string;
    weeklySpeedCheck: boolean;
    accountName: string;
    currencyCode: string;
  };
  latestTest: PageSpeedAuditResultWithMeta | null;
  history: PageSpeedAuditResultWithMeta[];
}

export interface PageSpeedAuditResultWithMeta {
  id: number;
  url: string;
  device: "mobile" | "desktop";
  performanceScore: number;
  accessibilityScore?: number | null;
  bestPracticesScore?: number | null;
  seoScore?: number | null;
  lcpMs?: number | null;
  lcpDisplay?: string | null;
  clsScore?: number | null;
  clsDisplay?: string | null;
  inpMs?: number | null;
  inpDisplay?: string | null;
  fcpMs?: number | null;
  fcpDisplay?: string | null;
  ttfbMs?: number | null;
  ttfbDisplay?: string | null;
  speedIndexMs?: number | null;
  speedIndexDisplay?: string | null;
  totalByteWeight?: number | null;
  opportunities?: any;
  diagnostics?: any;
  cruxData?: any;
  triggerSource: string;
  createdAt: Date;
}

/**
 * Fetches speed testing details, latest run, and historical runs for a campaign landing page
 */
export async function getLandingPageSpeedDataAction(
  campaignLandingPageId: number,
): Promise<{ success: boolean; data?: LandingPageSpeedData; error?: string }> {
  try {
    const ctx = await getAuthOrgContext();
    if (!ctx) {
      return { success: false, error: "Unauthorized" };
    }

    const lp = await db.query.campaignLandingPages.findFirst({
      where: and(
        eq(campaignLandingPages.id, campaignLandingPageId),
        eq(campaignLandingPages.organizationId, ctx.orgId),
      ),
      with: {
        account: true,
      },
    });

    if (!lp) {
      return { success: false, error: "Campaign landing page not found." };
    }

    const history = await db.query.landingPageSpeedTests.findMany({
      where: and(
        eq(landingPageSpeedTests.campaignLandingPageId, campaignLandingPageId),
        eq(landingPageSpeedTests.organizationId, ctx.orgId),
      ),
      orderBy: [desc(landingPageSpeedTests.createdAt)],
    });

    const mappedHistory: PageSpeedAuditResultWithMeta[] = history.map((h) => ({
      id: h.id,
      url: h.url,
      device: (h.device as "mobile" | "desktop") || "mobile",
      performanceScore: h.performanceScore,
      accessibilityScore: h.accessibilityScore,
      bestPracticesScore: h.bestPracticesScore,
      seoScore: h.seoScore,
      lcpMs: h.lcpMs,
      lcpDisplay: h.lcpDisplay,
      clsScore: h.clsScore,
      clsDisplay: h.clsDisplay,
      inpMs: h.inpMs,
      inpDisplay: h.inpDisplay,
      fcpMs: h.fcpMs,
      fcpDisplay: h.fcpDisplay,
      ttfbMs: h.ttfbMs,
      ttfbDisplay: h.ttfbDisplay,
      speedIndexMs: h.speedIndexMs,
      speedIndexDisplay: h.speedIndexDisplay,
      totalByteWeight: h.totalByteWeight,
      opportunities: h.opportunities,
      diagnostics: h.diagnostics,
      cruxData: h.cruxData,
      triggerSource: h.triggerSource,
      createdAt: h.createdAt,
    }));

    return {
      success: true,
      data: {
        landingPage: {
          id: lp.id,
          adAccountId: lp.adAccountId,
          campaignId: lp.campaignId,
          campaignName: lp.campaignName,
          url: lp.url,
          status: lp.status,
          weeklySpeedCheck: lp.weeklySpeedCheck ?? false,
          accountName: lp.account?.name || "Unknown Account",
          currencyCode: lp.account?.currencyCode || "USD",
        },
        latestTest: mappedHistory[0] || null,
        history: mappedHistory,
      },
    };
  } catch (error: any) {
    console.error("[getLandingPageSpeedDataAction Error]:", error);
    return {
      success: false,
      error: error.message || "Failed to load speed test data",
    };
  }
}

/**
 * Executes an on-demand PageSpeed Insights audit and saves results to DB
 */
export async function runLandingPageSpeedTestAction(
  campaignLandingPageId: number,
  device: "mobile" | "desktop" = "mobile",
): Promise<{
  success: boolean;
  data?: PageSpeedAuditResultWithMeta;
  error?: string;
}> {
  try {
    const ctx = await getAuthOrgContext();
    if (!ctx) {
      return { success: false, error: "Unauthorized" };
    }

    const lp = await db.query.campaignLandingPages.findFirst({
      where: and(
        eq(campaignLandingPages.id, campaignLandingPageId),
        eq(campaignLandingPages.organizationId, ctx.orgId),
      ),
    });

    if (!lp || !lp.url) {
      return {
        success: false,
        error: "Campaign landing page URL not found.",
      };
    }

    // 1. Run PageSpeed Audit
    const audit = await runPageSpeedAudit(lp.url, device);

    // 2. Insert into DB
    const [inserted] = await db
      .insert(landingPageSpeedTests)
      .values({
        organizationId: ctx.orgId,
        adAccountId: lp.adAccountId,
        campaignLandingPageId: lp.id,
        url: lp.url,
        device: audit.device,
        performanceScore: audit.performanceScore,
        accessibilityScore: audit.accessibilityScore,
        bestPracticesScore: audit.bestPracticesScore,
        seoScore: audit.seoScore,
        lcpMs: audit.lcpMs,
        lcpDisplay: audit.lcpDisplay,
        clsScore: audit.clsScore,
        clsDisplay: audit.clsDisplay,
        inpMs: audit.inpMs,
        inpDisplay: audit.inpDisplay,
        fcpMs: audit.fcpMs,
        fcpDisplay: audit.fcpDisplay,
        ttfbMs: audit.ttfbMs,
        ttfbDisplay: audit.ttfbDisplay,
        speedIndexMs: audit.speedIndexMs,
        speedIndexDisplay: audit.speedIndexDisplay,
        totalByteWeight: audit.totalByteWeight,
        opportunities: audit.opportunities,
        diagnostics: audit.diagnostics,
        cruxData: audit.cruxData,
        triggerSource: "MANUAL",
        status: "COMPLETED",
      })
      .returning();

    // 3. Log user action
    await logAction(
      ctx.session.user.id,
      "RUN_PAGE_SPEED_AUDIT",
      "landing_page_speed_tests",
      inserted.id,
      {
        url: lp.url,
        device,
        performanceScore: audit.performanceScore,
      },
    );

    revalidatePath("/lp-analysis");
    revalidatePath(`/lp-analysis/speed/${campaignLandingPageId}`);

    const result: PageSpeedAuditResultWithMeta = {
      id: inserted.id,
      url: inserted.url,
      device: (inserted.device as "mobile" | "desktop") || "mobile",
      performanceScore: inserted.performanceScore,
      accessibilityScore: inserted.accessibilityScore,
      bestPracticesScore: inserted.bestPracticesScore,
      seoScore: inserted.seoScore,
      lcpMs: inserted.lcpMs,
      lcpDisplay: inserted.lcpDisplay,
      clsScore: inserted.clsScore,
      clsDisplay: inserted.clsDisplay,
      inpMs: inserted.inpMs,
      inpDisplay: inserted.inpDisplay,
      fcpMs: inserted.fcpMs,
      fcpDisplay: inserted.fcpDisplay,
      ttfbMs: inserted.ttfbMs,
      ttfbDisplay: inserted.ttfbDisplay,
      speedIndexMs: inserted.speedIndexMs,
      speedIndexDisplay: inserted.speedIndexDisplay,
      totalByteWeight: inserted.totalByteWeight,
      opportunities: inserted.opportunities,
      diagnostics: inserted.diagnostics,
      cruxData: inserted.cruxData,
      triggerSource: inserted.triggerSource,
      createdAt: inserted.createdAt,
    };

    return { success: true, data: result };
  } catch (error: any) {
    console.error("[runLandingPageSpeedTestAction Error]:", error);
    return {
      success: false,
      error: error.message || "Failed to execute PageSpeed audit",
    };
  }
}

/**
 * Toggles whether this landing page should be tested automatically on a weekly basis
 */
export async function toggleWeeklySpeedCheckAction(
  campaignLandingPageId: number,
  enabled: boolean,
): Promise<{ success: boolean; enabled?: boolean; error?: string }> {
  try {
    const ctx = await getAuthOrgContext();
    if (!ctx) {
      return { success: false, error: "Unauthorized" };
    }

    await db
      .update(campaignLandingPages)
      .set({
        weeklySpeedCheck: enabled,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(campaignLandingPages.id, campaignLandingPageId),
          eq(campaignLandingPages.organizationId, ctx.orgId),
        ),
      );

    await logAction(
      ctx.session.user.id,
      "TOGGLE_WEEKLY_SPEED_CHECK",
      "campaign_landing_pages",
      campaignLandingPageId,
      { enabled },
    );

    revalidatePath("/lp-analysis");
    revalidatePath(`/lp-analysis/speed/${campaignLandingPageId}`);

    return { success: true, enabled };
  } catch (error: any) {
    console.error("[toggleWeeklySpeedCheckAction Error]:", error);
    return {
      success: false,
      error: error.message || "Failed to update weekly check setting",
    };
  }
}
