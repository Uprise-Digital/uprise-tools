"use server";

import { and, desc, eq, inArray, isNotNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import {
  adAccounts,
  backgroundTasks,
  campaignLandingPages,
  landingPageSpeedTests,
} from "@/db/schema";
import { logAction } from "@/lib/audit";
import { getAuthOrgContext } from "@/lib/auth-helpers";
import { createNotification } from "@/service/notification.service";
import {
  type PageSpeedAuditResult,
  runPageSpeedAudit,
  type SpeedAuditOptions,
  verifyGooglePageSpeedApiKey,
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
  rawMetrics?: any;
  engineUsed?: string | null;
  simulationSettings?: any;
  triggerSource: string;
  createdAt: Date;
}

/**
 * Verifies a user-provided Google PageSpeed Insights API key
 */
export async function verifyGooglePageSpeedApiKeyAction(
  apiKey: string,
): Promise<{ success: boolean; message: string }> {
  try {
    const ctx = await getAuthOrgContext();
    if (!ctx) {
      return { success: false, message: "Unauthorized" };
    }
    const res = await verifyGooglePageSpeedApiKey(apiKey);
    return { success: res.valid, message: res.message };
  } catch (err: any) {
    return { success: false, message: err.message || "Failed to verify key" };
  }
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
      where: eq(campaignLandingPages.id, campaignLandingPageId),
      with: {
        account: true,
      },
    });

    if (!lp) {
      return {
        success: false,
        error: "Campaign landing page record not found in database.",
      };
    }

    const history = await db.query.landingPageSpeedTests.findMany({
      where: eq(
        landingPageSpeedTests.campaignLandingPageId,
        campaignLandingPageId,
      ),
      orderBy: [desc(landingPageSpeedTests.createdAt)],
    });

    const mappedHistory: PageSpeedAuditResultWithMeta[] = history.map((h) => {
      const raw = (h.rawMetrics as any) || {};
      return {
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
        rawMetrics: h.rawMetrics,
        engineUsed:
          raw.engineUsed ||
          (h.triggerSource === "WEEKLY_CRON"
            ? "Weekly Automated Engine"
            : "Lighthouse v11 Profiler"),
        simulationSettings: raw.simulationSettings,
        triggerSource: h.triggerSource,
        createdAt: h.createdAt,
      };
    });

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
  options?: SpeedAuditOptions,
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
      where: eq(campaignLandingPages.id, campaignLandingPageId),
    });

    if (!lp || !lp.url) {
      return {
        success: false,
        error: "Campaign landing page URL not found.",
      };
    }

    // 1. Run PageSpeed Audit with User Options
    const audit = await runPageSpeedAudit(lp.url, device, options);

    const targetOrgId = ctx.orgId || lp.organizationId || "default-org";

    // 2. Insert into DB
    const [inserted] = await db
      .insert(landingPageSpeedTests)
      .values({
        organizationId: targetOrgId,
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
        rawMetrics: {
          engineUsed: audit.engineUsed,
          simulationSettings: audit.simulationSettings,
          optionsUsed: options,
        },
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
        engineUsed: audit.engineUsed,
      },
    );

    // 4. Send alert if score is low / degraded
    if (audit.performanceScore < 60 || (audit.lcpMs && audit.lcpMs > 4000)) {
      try {
        await createNotification({
          userId: ctx.userId,
          organizationId: targetOrgId,
          adAccountId: lp.adAccountId,
          type: "lp_speed_degraded",
          severity: audit.performanceScore < 50 ? "critical" : "warning",
          title: `Low Speed Score: ${audit.performanceScore}/100 (${lp.campaignName || "Landing Page"})`,
          message: `Audited ${lp.url}. LCP: ${audit.lcpDisplay || "N/A"}, TBT: ${audit.inpDisplay || "N/A"}. High impact on Quality Score.`,
          link: `/lp-analysis/speed/${lp.id}`,
          metadata: {
            score: audit.performanceScore,
            lcpMs: audit.lcpMs,
            url: lp.url,
          },
        });
      } catch (e) {
        console.error("Failed to create speed notification:", e);
      }
    }

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
      rawMetrics: inserted.rawMetrics,
      engineUsed: audit.engineUsed,
      simulationSettings: audit.simulationSettings,
      triggerSource: inserted.triggerSource,
      createdAt: inserted.createdAt,
    };

    return {
      success: true,
      data: result,
    };
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
      .where(eq(campaignLandingPages.id, campaignLandingPageId));

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

/**
 * Runs PageSpeed audits for all landing pages in the organization or for a specific account.
 * Registers an asynchronous background task tracked in the bottom-right task indicator widget.
 */
export async function runAllLandingPageSpeedTestsAction(
  adAccountId?: number,
  device: "mobile" | "desktop" = "mobile",
): Promise<{
  success: boolean;
  taskId?: number;
  message?: string;
  error?: string;
}> {
  try {
    const ctx = await getAuthOrgContext();
    if (!ctx) {
      return { success: false, error: "Unauthorized" };
    }

    const orgId = ctx.orgId || "default-org";

    let targetPages: Array<typeof campaignLandingPages.$inferSelect> = [];
    let accountName = "All Accounts";

    if (adAccountId && adAccountId > 0) {
      const account = await db.query.adAccounts.findFirst({
        where: eq(adAccounts.id, adAccountId),
      });
      if (account) accountName = account.name;

      targetPages = await db.query.campaignLandingPages.findMany({
        where: and(
          eq(campaignLandingPages.adAccountId, adAccountId),
          eq(campaignLandingPages.status, "ENABLED"),
        ),
      });
    } else {
      // Organization level: fetch all pages across active org accounts
      const orgAccounts = await db.query.adAccounts.findMany({
        where: and(
          eq(adAccounts.organizationId, orgId),
          eq(adAccounts.isActive, true),
        ),
      });
      const orgAccountIds = orgAccounts.map((a) => a.id);

      if (orgAccountIds.length === 0) {
        return {
          success: false,
          error: "No active ad accounts found in this organization.",
        };
      }

      targetPages = await db.query.campaignLandingPages.findMany({
        where: and(
          inArray(campaignLandingPages.adAccountId, orgAccountIds),
          eq(campaignLandingPages.status, "ENABLED"),
        ),
      });
    }

    // Filter valid HTTP/HTTPS URLs
    const validPages = targetPages.filter(
      (p) => p.url && (p.url.startsWith("http://") || p.url.startsWith("https://")),
    );

    if (validPages.length === 0) {
      return {
        success: false,
        error: "No enabled landing pages with valid URLs found to test.",
      };
    }

    const taskTitle =
      adAccountId && adAccountId > 0
        ? `PageSpeed Audit: ${accountName} (${validPages.length} pages)`
        : `Portfolio PageSpeed Audit (${validPages.length} pages)`;

    // 1. Insert into background_tasks so the bottom-right indicator starts spinning immediately
    const [taskRecord] = await db
      .insert(backgroundTasks)
      .values({
        organizationId: orgId,
        name: taskTitle,
        status: "running",
        totalItems: validPages.length,
        completedItems: 0,
        currentItem: `Starting audit of ${validPages.length} landing pages...`,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning({ id: backgroundTasks.id });

    // 2. Fire and forget async execution in background (prevents HTTP connection timeout)
    (async () => {
      const results: Array<{ pageId: number; success: boolean; error?: string }> = [];
      try {
        console.log(`[Background Task ${taskRecord.id}] Starting ${taskTitle}...`);

        for (let i = 0; i < validPages.length; i++) {
          const page = validPages[i];
          const cleanUrl = page.url.replace(/^https?:\/\//, "").replace(/\/$/, "");

          // Update heartbeat and current page progress
          await db
            .update(backgroundTasks)
            .set({
              completedItems: i,
              currentItem: `Auditing: ${cleanUrl} (${i + 1}/${validPages.length})`,
              updatedAt: new Date(),
            })
            .where(eq(backgroundTasks.id, taskRecord.id));

          try {
            const audit = await runPageSpeedAudit(page.url, device);
            const targetOrgId = orgId || page.organizationId || "default-org";

            await db.insert(landingPageSpeedTests).values({
              organizationId: targetOrgId,
              adAccountId: page.adAccountId,
              campaignLandingPageId: page.id,
              url: page.url,
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
              rawMetrics: {
                engineUsed: audit.engineUsed,
                simulationSettings: audit.simulationSettings,
              },
              triggerSource: "MANUAL_BATCH",
              createdAt: new Date(),
            });

            results.push({ pageId: page.id, success: true });
          } catch (err: any) {
            console.error(
              `[Background Task ${taskRecord.id}] Failed for ${page.url}:`,
              err,
            );
            results.push({
              pageId: page.id,
              success: false,
              error: err.message || "Speed test failed",
            });
          }

          // Update heartbeat after finishing this page
          await db
            .update(backgroundTasks)
            .set({
              completedItems: i + 1,
              currentItem:
                i + 1 === validPages.length
                  ? "Finalizing audit batch..."
                  : `Tested ${i + 1}/${validPages.length}. Preparing next page...`,
              updatedAt: new Date(),
            })
            .where(eq(backgroundTasks.id, taskRecord.id));
        }

        const processed = results.filter((r) => r.success).length;

        // Mark background task as completed
        await db
          .update(backgroundTasks)
          .set({
            status: "completed",
            completedItems: validPages.length,
            currentItem: `Completed ${processed}/${validPages.length} pages`,
            updatedAt: new Date(),
          })
          .where(eq(backgroundTasks.id, taskRecord.id));

        console.log(
          `[Background Task ${taskRecord.id}] Finished. Tested ${processed}/${validPages.length} pages.`,
        );

        revalidatePath("/lp-analysis");
      } catch (fatalErr: any) {
        console.error(`[Background Task ${taskRecord.id}] Fatal error:`, fatalErr);
        await db
          .update(backgroundTasks)
          .set({
            status: "failed",
            error: fatalErr.message || "Failed during PageSpeed audit batch",
            updatedAt: new Date(),
          })
          .where(eq(backgroundTasks.id, taskRecord.id));
      }
    })();

    return {
      success: true,
      taskId: taskRecord.id,
      message: `Started PageSpeed batch for ${validPages.length} landing pages. Progress tracked in bottom-right task monitor.`,
    };
  } catch (error: any) {
    console.error("[runAllLandingPageSpeedTestsAction Error]:", error);
    return {
      success: false,
      error: error.message || "Failed to start batch PageSpeed audits",
    };
  }
}


