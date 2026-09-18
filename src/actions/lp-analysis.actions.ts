"use server";

import * as cheerio from "cheerio";
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import TurndownService from "turndown";
import { db } from "@/db";
import {
  adAccounts,
  adPerformanceDaily,
  campaignLandingPages,
  landingPageAudits,
  landingPageSpeedTests,
} from "@/db/schema";
import { GEMINI_MODEL_LOW } from "@/lib/ai-config";
import { generateContentTracked } from "@/lib/ai-logger";
import { auth } from "@/lib/auth";
import { getAuthOrgContext } from "@/lib/auth-helpers";
import { fetchCampaignLandingPages } from "@/lib/google-ads";
import { uploadImageToR2 } from "@/lib/storage";

function isElementHidden(el: any, $: any): boolean {
  // 1. Traverse up to check if this is a progressively disclosed element (accordions, tabs, FAQs)
  // If so, we want to KEEP the content rather than filtering it out as dead code.
  let current = el;
  let isProgressiveDisclosure = false;
  while (current && current.length > 0) {
    const className = current.attr("class") || "";
    const idName = current.attr("id") || "";
    const role = current.attr("role") || "";
    if (
      /(?:^|[^a-zA-Z0-9])(accordion|tab|tabs|collapse|collapsed|faq|faqs|dropdown)(?:$|[^a-zA-Z0-9])/i.test(
        className,
      ) ||
      /(?:^|[^a-zA-Z0-9])(accordion|tab|tabs|collapse|collapsed|faq|faqs|dropdown)(?:$|[^a-zA-Z0-9])/i.test(
        idName,
      ) ||
      role === "tabpanel"
    ) {
      isProgressiveDisclosure = true;
      break;
    }
    const parentNode = current.parent();
    if (parentNode && parentNode.length > 0) {
      const pNode = parentNode[0];
      if (
        pNode &&
        pNode.type !== "root" &&
        pNode.name !== "body" &&
        pNode.name !== "html"
      ) {
        current = parentNode;
      } else {
        break;
      }
    } else {
      break;
    }
  }

  if (isProgressiveDisclosure) {
    // For accordions/tabs, we only filter out if explicitly marked as screen-reader-only
    if (el.hasClass("sr-only") || el.hasClass("screen-reader-only")) {
      return true;
    }
    return false;
  }

  // 2. Otherwise apply the standard hidden patterns blocklist
  const style = el.attr("style") || "";
  if (
    /display\s*:\s*none/i.test(style) ||
    /visibility\s*:\s*hidden/i.test(style) ||
    el.attr("aria-hidden") === "true" ||
    el.prop("hidden") === true ||
    el.hasClass("hidden") ||
    el.hasClass("d-none") ||
    el.hasClass("invisible") ||
    el.hasClass("sr-only") ||
    el.hasClass("screen-reader-only") ||
    el.hasClass("hide")
  ) {
    return true;
  }

  const parent = el.parent();
  if (parent && parent.length > 0) {
    const parentNode = parent[0];
    if (
      parentNode &&
      parentNode.type !== "root" &&
      parentNode.name !== "body" &&
      parentNode.name !== "html"
    ) {
      return isElementHidden(parent, $);
    }
  }

  return false;
}

export async function scrapeLandingPageExtended(
  targetUrl: string,
  options?: {
    render?: boolean;
    screenshot?: boolean;
    width?: number;
    height?: number;
  },
): Promise<{ markdown: string; screenshotBase64?: string }> {
  try {
    console.log(
      `[LP Scraper] Scraping URL: ${targetUrl} (Render: ${!!options?.render}, Screenshot: ${!!options?.screenshot}, Viewport: ${options?.width || "default"}x${options?.height || "default"})`,
    );

    let html = "";
    let screenshotBase64: string | undefined;

    if (process.env.SCRAPE_DO_KEY) {
      try {
        let scrapeDoUrl = `http://api.scrape.do?token=${process.env.SCRAPE_DO_KEY}&url=${encodeURIComponent(targetUrl)}`;
        if (options?.render) scrapeDoUrl += "&render=true";
        if (options?.screenshot) {
          const customJs = encodeURIComponent(`
            window.scrollTo(0, document.body.scrollHeight / 2);
            setTimeout(() => {
              window.scrollTo(0, document.body.scrollHeight);
              setTimeout(() => {
                window.scrollTo(0, 0);
                document.querySelectorAll('[data-count],[data-target],[data-to],[data-value],[data-number],[data-counter],.elementor-counter-number,.stat-number').forEach(el => {
                  const target = el.getAttribute('data-count') || el.getAttribute('data-target') || el.getAttribute('data-to') || el.getAttribute('data-value') || el.getAttribute('data-number') || el.getAttribute('data-counter');
                  if (target && (el.innerText.trim() === '0' || el.innerText.trim().startsWith('0') || el.innerText.trim() === '')) {
                    el.innerText = target;
                  }
                });
                document.querySelectorAll('.tab-title, .accordion-header, [role="tab"], .elementor-tab-title').forEach(el => {
                  try { el.click(); } catch(e){}
                });
              }, 1500);
            }, 1500);
          `);
          scrapeDoUrl += `&screenShot=true&returnJSON=true&customWait=7000&custom_js=${customJs}`;
          if (options.width) scrapeDoUrl += `&width=${options.width}`;
          if (options.height) scrapeDoUrl += `&height=${options.height}`;
        }

        const response = await fetch(scrapeDoUrl, {
          next: { revalidate: 3600 },
        });
        if (response.ok) {
          if (options?.screenshot) {
            const data = await response.json();
            html = data.html || "";
            screenshotBase64 = data.screenShots?.[0]?.image;
          } else {
            html = await response.text();
          }
        }
      } catch (scrapeDoErr) {
        console.warn(
          `[LP Scraper Warning] Scrape.do request failed for ${targetUrl}:`,
          scrapeDoErr,
        );
      }
    }

    // Direct HTTP fetch fallback if scrape.do is unconfigured or failed
    if (!html || html.trim().length === 0) {
      console.log(`[LP Scraper] Direct fetch fallback for URL: ${targetUrl}`);
      try {
        const directRes = await fetch(targetUrl, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          },
        });
        if (directRes.ok) {
          html = await directRes.text();
        }
      } catch (directErr) {
        console.error(
          `[LP Scraper Error] Direct fetch failed for ${targetUrl}:`,
          directErr,
        );
      }
    }

    if (!html) {
      return { markdown: "ERROR_SCRAPING_PAGE" };
    }

    const $ = cheerio.load(html);

    // Strip non-content noise
    $(
      "script, style, noscript, svg, nav, footer, iframe, meta, link, header, head",
    ).remove();

    // Remove explicitly hidden elements
    $(
      "[aria-hidden='true'], [hidden], .hidden, .d-none, .invisible, .sr-only",
    ).remove();

    const turndownService = new TurndownService({
      headingStyle: "atx",
      codeBlockStyle: "fenced",
    });

    const bodyHtml = $.html("body") || $.html();
    const cleanMarkdown = turndownService
      .turndown(bodyHtml)
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    return {
      markdown: cleanMarkdown.substring(0, 30000),
      screenshotBase64,
    };
  } catch (error) {
    console.error(`[LP Scraper Error] Failed to scrape ${targetUrl}:`, error);
    return { markdown: "ERROR_SCRAPING_PAGE" };
  }
}

export async function scrapeAndCompressLandingPage(
  targetUrl: string,
): Promise<string> {
  const result = await scrapeLandingPageExtended(targetUrl);
  return result.markdown;
}

// ============================================================================
// 2. HELPER: ROBUST COMPETITOR DISCOVERY (Bypasses bot limitations)
// ============================================================================
export async function getLiveCompetitorsRobust(
  searchTerm: string,
  clientDomain: string,
): Promise<string[]> {
  console.log(`[Competitor Scan] Searching competitors for: "${searchTerm}"`);
  const competitorUrls: string[] = [];

  // Method A: Serper.dev Google API (highly reliable, bypasses blocks)
  if (process.env.SERPER_KEY) {
    try {
      const response = await fetch("https://google.serper.dev/search", {
        method: "POST",
        headers: {
          "X-API-KEY": process.env.SERPER_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          q: searchTerm,
          gl: "au",
          hl: "en",
        }),
      });

      if (response.ok) {
        const data = await response.json();

        // 1. First extract sponsored Ads (Direct PPC auction competitors)
        if (data.ads && data.ads.length > 0) {
          const adUrls = data.ads
            .filter(
              (ad: any) =>
                ad.link &&
                !ad.link.toLowerCase().includes(clientDomain.toLowerCase()),
            )
            .map((ad: any) => ad.link);

          competitorUrls.push(...adUrls);
          console.log(
            `[Competitor Scan] Found ${adUrls.length} sponsored competitors from Serper.`,
          );
        }

        // 2. If we don't have enough, grab organic results (fallback SEO competitors)
        if (
          competitorUrls.length < 3 &&
          data.organic &&
          data.organic.length > 0
        ) {
          console.log(
            `[Competitor Scan] Sponsored ads insufficient. Fetching organic competitors...`,
          );
          const organicUrls = data.organic
            .filter(
              (org: any) =>
                org.link &&
                !org.link.toLowerCase().includes(clientDomain.toLowerCase()),
            )
            .map((org: any) => org.link);

          for (const url of organicUrls) {
            if (competitorUrls.length >= 3) break;
            if (!competitorUrls.includes(url)) {
              // Ignore massive generic directory domains
              const domain = new URL(url).hostname;
              const directories = [
                "hipages.com",
                "airtasker.com",
                "serviceseeking.com",
                "yellowpages.com",
                "oneflare.com.au",
                "google.com",
              ];
              if (!directories.some((d) => domain.includes(d))) {
                competitorUrls.push(url);
              }
            }
          }
        }
      }
    } catch (error) {
      console.error("[Competitor Scan Error] Serper.dev lookup failed:", error);
    }
  }

  // Method B: Direct SERP scrape fallback using scrape.do (in case Serper is down or lacks key)
  if (competitorUrls.length === 0 && process.env.SCRAPE_DO_KEY) {
    try {
      console.log(
        `[Competitor Scan] Falling back to direct Google.com.au scrape via scrape.do...`,
      );
      const googleSearchUrl = `https://www.google.com.au/search?q=${encodeURIComponent(searchTerm)}&num=10`;
      const scrapeDoUrl = `http://api.scrape.do?token=${process.env.SCRAPE_DO_KEY}&geoCode=au&super=true&render=true&url=${encodeURIComponent(googleSearchUrl)}`;

      const response = await fetch(scrapeDoUrl);
      if (response.ok) {
        const html = await response.text();
        const $ = cheerio.load(html);

        // Find links
        $("a").each((_, el) => {
          if (competitorUrls.length >= 3) return false;
          const href = $(el).attr("href");
          if (href) {
            let cleanUrl = "";
            if (href.startsWith("http")) {
              cleanUrl = href;
            } else if (href.includes("/url?q=")) {
              // Extract from google redirection link
              const parts = href.split("/url?q=");
              if (parts[1]) {
                cleanUrl = decodeURIComponent(parts[1].split("&")[0]);
              }
            }

            if (
              cleanUrl &&
              !cleanUrl.toLowerCase().includes(clientDomain.toLowerCase())
            ) {
              try {
                const domain = new URL(cleanUrl).hostname;
                const directories = [
                  "google.com",
                  "google.com.au",
                  "youtube.com",
                  "facebook.com",
                  "hipages.com.au",
                  "airtasker.com",
                  "serviceseeking.com.au",
                  "yellowpages.com.au",
                  "oneflare.com.au",
                ];
                if (
                  !directories.some((d) => domain.includes(d)) &&
                  !competitorUrls.includes(cleanUrl)
                ) {
                  competitorUrls.push(cleanUrl);
                }
              } catch (_) {}
            }
          }
        });
      }
    } catch (error) {
      console.error(
        "[Competitor Scan Error] Direct SERP scrape failed:",
        error,
      );
    }
  }

  return competitorUrls.slice(0, 3);
}

import { cleanCampaignNameToSearchTerm } from "@/lib/utils";


// ============================================================================
// 3. MASTER ACTION: RETRIEVE CAMPAIGNS & THEIR LANDING PAGES
// ============================================================================
export async function getCampaignLandingPagesInternal(adAccountId: number) {
  const account = await db.query.adAccounts.findFirst({
    where: eq(adAccounts.id, adAccountId),
  });
  if (!account) throw new Error("Ad Account not found");

  // Fetch mappings saved in DB
  let mappings = await db.query.campaignLandingPages.findMany({
    where: eq(campaignLandingPages.adAccountId, adAccountId),
    orderBy: [desc(campaignLandingPages.createdAt)],
  });

  // Auto Pre-populate if empty!
  if (mappings.length === 0) {
    console.log(
      `[Sync] No landing page mappings found in DB. Auto pre-populating...`,
    );
    try {
      const synced = await fetchCampaignLandingPages(account.googleAccountId);
      if (synced && synced.length > 0) {
        const insertData = synced.map((s) => ({
          adAccountId: adAccountId,
          campaignId: s.campaignId,
          campaignName: s.campaignName,
          url: s.url || "",
          status: s.status,
        }));

        await db
          .insert(campaignLandingPages)
          .values(insertData)
          .onConflictDoNothing();

        // Re-fetch mappings after insertion
        mappings = await db.query.campaignLandingPages.findMany({
          where: eq(campaignLandingPages.adAccountId, adAccountId),
          orderBy: [desc(campaignLandingPages.createdAt)],
        });
      }
    } catch (syncErr) {
      console.error("[Sync Error] Auto pre-populate failed:", syncErr);
      // Do not block the request. We will return empty list so UI can prompt manual attachment.
    }
  }

  // Fetch audits history
  const audits = await db.query.landingPageAudits.findMany({
    where: eq(landingPageAudits.adAccountId, adAccountId),
    orderBy: [desc(landingPageAudits.createdAt)],
  });

  // Fetch speed tests history for this account
  const speedTests = await db.query.landingPageSpeedTests.findMany({
    where: eq(landingPageSpeedTests.adAccountId, adAccountId),
    orderBy: [desc(landingPageSpeedTests.createdAt)],
  });

  // Fetch 30-day campaign metrics from adPerformanceDaily
  const thirtyDaysAgoDate = new Date();
  thirtyDaysAgoDate.setUTCDate(thirtyDaysAgoDate.getUTCDate() - 30);
  const thirtyDaysAgoStr = thirtyDaysAgoDate.toISOString().split("T")[0];

  let perfRows: {
    campaignId: string;
    spend: string;
    conversions: string;
    clicks: number;
  }[] = [];
  try {
    perfRows = await db
      .select({
        campaignId: adPerformanceDaily.campaignId,
        spend: sql<string>`COALESCE(SUM(${adPerformanceDaily.spend}), 0)`,
        conversions: sql<string>`COALESCE(SUM(${adPerformanceDaily.conversions}), 0)`,
        clicks: sql<number>`COALESCE(SUM(${adPerformanceDaily.clicks}), 0)`,
      })
      .from(adPerformanceDaily)
      .where(
        and(
          eq(adPerformanceDaily.adAccountId, adAccountId),
          gte(adPerformanceDaily.date, thirtyDaysAgoStr),
        ),
      )
      .groupBy(adPerformanceDaily.campaignId);
  } catch (perfErr) {
    console.error(
      "[LP Analysis] Failed to fetch 30d performance for account:",
      perfErr,
    );
  }

  const perfMap = new Map<
    string,
    { spend: number; conversions: number; clicks: number; cvr: number }
  >();
  for (const row of perfRows) {
    const spend = Number.parseFloat(row.spend) || 0;
    const conversions = Number.parseFloat(row.conversions) || 0;
    const clicks = Number(row.clicks) || 0;
    const cvr = clicks > 0 ? (conversions / clicks) * 100 : 0;
    perfMap.set(row.campaignId, { spend, conversions, clicks, cvr });
  }

  // Map audits and metrics back to the campaign list
  const campaigns = mappings.map((m) => {
    const campaignAudits = audits.filter((a) => a.campaignId === m.campaignId);
    const latestAudit = campaignAudits[0]
      ? {
          id: campaignAudits[0].id,
          score: campaignAudits[0].score,
          auditType: campaignAudits[0].auditType,
          createdAt: campaignAudits[0].createdAt,
        }
      : null;

    // Match speed tests by campaignLandingPageId or normalized URL
    const cleanUrl = m.url ? m.url.trim().replace(/\/$/, "").toLowerCase() : "";
    const pageSpeedTests = speedTests.filter((s) => {
      if (s.campaignLandingPageId === m.id) return true;
      if (cleanUrl && s.url) {
        return s.url.trim().replace(/\/$/, "").toLowerCase() === cleanUrl;
      }
      return false;
    });

    const latestMobile = pageSpeedTests.find((s) => s.device === "mobile") || null;
    const latestDesktop = pageSpeedTests.find((s) => s.device === "desktop") || null;
    const latestSpeedTest = pageSpeedTests[0]
      ? {
          id: pageSpeedTests[0].id,
          performanceScore: pageSpeedTests[0].performanceScore,
          device: pageSpeedTests[0].device,
          lcpDisplay: pageSpeedTests[0].lcpDisplay,
          clsDisplay: pageSpeedTests[0].clsDisplay,
          createdAt: pageSpeedTests[0].createdAt,
        }
      : null;

    const perf = perfMap.get(m.campaignId) || {
      spend: 0,
      conversions: 0,
      clicks: 0,
      cvr: 0,
    };

    const latestScore = latestAudit ? latestAudit.score : null;

    let priority: "CRITICAL" | "MODERATE" | "HEALTHY" = "HEALTHY";
    if (m.status === "ENABLED") {
      if (perf.spend > 150 && (latestScore === null || latestScore < 60)) {
        priority = "CRITICAL";
      } else if (latestScore !== null && latestScore < 50 && perf.spend > 50) {
        priority = "CRITICAL";
      } else if (
        (latestScore === null && perf.spend > 0) ||
        (latestScore !== null && latestScore < 70)
      ) {
        priority = "MODERATE";
      } else {
        priority = "HEALTHY";
      }
    }

    return {
      id: m.id,
      campaignId: m.campaignId,
      campaignName: m.campaignName,
      url: m.url,
      status: m.status,
      weeklySpeedCheck: m.weeklySpeedCheck ?? false,
      updatedAt: m.updatedAt,
      spend30d: perf.spend,
      conversions30d: perf.conversions,
      clicks30d: perf.clicks,
      cvr: perf.cvr,
      priority,
      latestAudit,
      audits: campaignAudits.map((a) => ({
        id: a.id,
        score: a.score,
        auditType: a.auditType,
        createdAt: a.createdAt,
      })),
      latestSpeedTest,
      speedScores: {
        mobile: latestMobile
          ? {
              id: latestMobile.id,
              score: latestMobile.performanceScore,
              lcpDisplay: latestMobile.lcpDisplay,
              createdAt: latestMobile.createdAt,
            }
          : null,
        desktop: latestDesktop
          ? {
              id: latestDesktop.id,
              score: latestDesktop.performanceScore,
              lcpDisplay: latestDesktop.lcpDisplay,
              createdAt: latestDesktop.createdAt,
            }
          : null,
      },
    };
  });

  // Calculate Account-Level Summary Metrics
  const totalCampaigns = campaigns.length;
  const auditedCampaigns = campaigns.filter((c) => c.latestAudit !== null);
  const auditedCount = auditedCampaigns.length;
  const coveragePercent =
    totalCampaigns > 0 ? Math.round((auditedCount / totalCampaigns) * 100) : 0;

  const avgCroScore =
    auditedCount > 0
      ? Math.round(
          auditedCampaigns.reduce(
            (sum, c) => sum + (c.latestAudit?.score || 0),
            0,
          ) / auditedCount,
        )
      : null;

  const speedTestedCampaigns = campaigns.filter(
    (c) => c.latestSpeedTest !== null || c.speedScores?.mobile !== null,
  );
  const avgSpeedScore =
    speedTestedCampaigns.length > 0
      ? Math.round(
          speedTestedCampaigns.reduce(
            (sum, c) =>
              sum +
              (c.speedScores?.mobile?.score ??
                c.latestSpeedTest?.performanceScore ??
                0),
            0,
          ) / speedTestedCampaigns.length,
        )
      : null;

  let spendAtRisk = 0;
  for (const c of campaigns) {
    if (c.status !== "ENABLED") continue;
    if (!c.latestAudit || c.latestAudit.score < 60) {
      spendAtRisk += c.spend30d;
    }
  }

  let topQuickWin =
    "Audit remaining landing pages to unlock high-intent conversion rate optimizations.";
  for (const a of audits) {
    const analysis = a.aiAnalysis as any;
    if (
      analysis?.quick_wins &&
      Array.isArray(analysis.quick_wins) &&
      analysis.quick_wins.length > 0
    ) {
      topQuickWin = analysis.quick_wins[0];
      break;
    }
  }

  const accountSummary = {
    avgCroScore,
    avgSpeedScore,
    coverageRatio: {
      audited: auditedCount,
      total: totalCampaigns,
      percent: coveragePercent,
    },
    spendAtRisk,
    topQuickWin,
  };

  return Object.assign(campaigns, {
    campaigns,
    accountSummary,
  });
}

export async function getCampaignLandingPagesAction(adAccountId: number) {
  const ctx = await getAuthOrgContext();
  if (!ctx) throw new Error("Unauthorized");

  try {
    const result = await getCampaignLandingPagesInternal(adAccountId);
    return { success: true as const, data: result };
  } catch (error: any) {
    console.error("[getCampaignLandingPagesAction Error]:", error);
    return { success: false as const, error: error.message };
  }
}

// ============================================================================
// 4. ACTION: SYNC / PULL LP URLS FROM GOOGLE ADS API
// ============================================================================
export async function syncCampaignLandingPagesInternal(adAccountId: number) {
  const account = await db.query.adAccounts.findFirst({
    where: eq(adAccounts.id, adAccountId),
  });
  if (!account) throw new Error("Ad Account not found");

  if (!account.googleAccountId) {
    return { success: true as const, count: 0 };
  }

  console.log(
    `[Sync] Fetching campaign landing pages from Google Ads for ${account.name}...`,
  );
  try {
    const synced = await fetchCampaignLandingPages(account.googleAccountId);

    if (synced && synced.length > 0) {
      // Loop and upsert individually
      for (const item of synced) {
        await db
          .insert(campaignLandingPages)
          .values({
            adAccountId: adAccountId,
            campaignId: item.campaignId,
            campaignName: item.campaignName,
            url: item.url || "",
            status: item.status,
          })
          .onConflictDoUpdate({
            target: [
              campaignLandingPages.adAccountId,
              campaignLandingPages.campaignId,
            ],
            set: {
              url: item.url || "",
              status: item.status,
              campaignName: item.campaignName,
              updatedAt: new Date(),
            },
          });
      }
      return { success: true as const, count: synced.length };
    }
    return { success: true as const, count: 0 };
  } catch (err: any) {
    console.warn(
      `[Sync] Failed to fetch Google Ads LPs for ${account.name}:`,
      err.message,
    );
    throw err;
  }
}

export async function syncAllActiveAccountsLandingPagesInternal(
  orgId?: string,
) {
  const accounts = await db.query.adAccounts.findMany({
    where: and(
      eq(adAccounts.isActive, true),
      orgId ? eq(adAccounts.organizationId, orgId) : undefined,
    ),
  });

  let totalSynced = 0;
  for (const acc of accounts) {
    if (!acc.googleAccountId) continue;
    try {
      const res = await syncCampaignLandingPagesInternal(acc.id);
      if (res.success) {
        totalSynced += res.count;
      }
    } catch (e: any) {
      console.warn(
        `[Sync All LPs] Skipping account ${acc.name} (${acc.id}): ${e.message}`,
      );
    }
  }
  return { success: true as const, count: totalSynced };
}

export async function syncCampaignLandingPagesAction(adAccountId: number) {
  const ctx = await getAuthOrgContext();
  if (!ctx) throw new Error("Unauthorized");

  try {
    const res = await syncCampaignLandingPagesInternal(adAccountId);
    if (res.count === 0) {
      return {
        success: false as const,
        error: "No campaigns or landing page URLs returned from Google Ads API.",
      };
    }
    return res;
  } catch (error: any) {
    console.error("[syncCampaignLandingPagesAction Error]:", error);
    return { success: false as const, error: error.message };
  }
}

export async function syncAllActiveAccountsLandingPagesAction() {
  const ctx = await getAuthOrgContext();
  if (!ctx) throw new Error("Unauthorized");

  try {
    const res = await syncAllActiveAccountsLandingPagesInternal(ctx.orgId);
    revalidatePath("/lp-analysis");
    return { success: true as const, count: res.count };
  } catch (error: any) {
    console.error("[syncAllActiveAccountsLandingPagesAction Error]:", error);
    return { success: false as const, error: error.message };
  }
}

export async function saveCampaignLandingPageInternal(
  adAccountId: number,
  campaignId: string,
  campaignName: string,
  url: string,
) {
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    throw new Error("URL must begin with http:// or https://");
  }

  const [upserted] = await db
    .insert(campaignLandingPages)
    .values({
      adAccountId,
      campaignId,
      campaignName,
      url,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [
        campaignLandingPages.adAccountId,
        campaignLandingPages.campaignId,
      ],
      set: {
        url,
        updatedAt: new Date(),
      },
    })
    .returning();

  return upserted;
}

export async function saveCampaignLandingPageAction(
  adAccountId: number,
  campaignId: string,
  campaignName: string,
  url: string,
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  try {
    const data = await saveCampaignLandingPageInternal(
      adAccountId,
      campaignId,
      campaignName,
      url,
    );
    return { success: true as const, data };
  } catch (error: any) {
    console.error("[saveCampaignLandingPageAction Error]:", error);
    return { success: false as const, error: error.message };
  }
}

export async function runLandingPageAuditInternal(
  adAccountId: number,
  campaignId: string | null,
  campaignName: string | null,
  url: string,
  searchTerm: string,
  auditType: "PAGE_SOURCE" | "VISUAL" = "PAGE_SOURCE",
) {
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    throw new Error("Invalid URL. It must begin with http:// or https://");
  }

  // Resolve client domain to avoid self-scraping
  const clientDomain = new URL(url).hostname.replace("www.", "");

  // STEP 1: Discover competitor landing pages
  console.log(
    `[Audit] Scanning competitor pages for keyword "${searchTerm}"...`,
  );
  const competitorUrls = await getLiveCompetitorsRobust(
    searchTerm,
    clientDomain,
  );

  // STEP 2: Scrape client and competitors in parallel
  console.log(
    `[Audit] Scraping target page and ${competitorUrls.length} competitors (Type: ${auditType})...`,
  );

  let clientMarkdown = "";
  let screenshotBase64: string | undefined;
  let screenshotMobileBase64: string | undefined;

  if (auditType === "VISUAL") {
    // Enable Javascript rendering and screenshot capture in parallel for both Desktop and Mobile viewports
    console.log(
      `[Audit] Fetching Desktop and Mobile visual snapshots in parallel...`,
    );
    const [desktopScrape, mobileScrape] = await Promise.all([
      scrapeLandingPageExtended(url, {
        render: true,
        screenshot: true,
        width: 1280,
        height: 800,
      }),
      scrapeLandingPageExtended(url, {
        render: true,
        screenshot: true,
        width: 375,
        height: 812,
      }),
    ]);
    clientMarkdown = desktopScrape.markdown;
    screenshotBase64 = desktopScrape.screenshotBase64;
    screenshotMobileBase64 = mobileScrape.screenshotBase64;
  } else {
    // Normal HTML scraping
    clientMarkdown = await scrapeAndCompressLandingPage(url);
  }

  const competitorMarkdowns = await Promise.all(
    competitorUrls.map((compUrl) => scrapeAndCompressLandingPage(compUrl)),
  );

  // Upload screenshots to Cloudflare R2 if available
  let screenshotUrl: string | null = null;
  let screenshotMobileUrl: string | null = null;

  if (auditType === "VISUAL") {
    const uploadPromises: Promise<any>[] = [];

    if (screenshotBase64) {
      const filename = `audit-${adAccountId}-${Date.now()}-desktop.png`;
      uploadPromises.push(
        uploadImageToR2(screenshotBase64, filename).then((resUrl) => {
          screenshotUrl = resUrl;
        }),
      );
    }

    if (screenshotMobileBase64) {
      const filename = `audit-${adAccountId}-${Date.now()}-mobile.png`;
      uploadPromises.push(
        uploadImageToR2(screenshotMobileBase64, filename).then((resUrl) => {
          screenshotMobileUrl = resUrl;
        }),
      );
    }

    if (uploadPromises.length > 0) {
      console.log(
        `[Audit] Uploading desktop & mobile screenshots to Cloudflare R2...`,
      );
      await Promise.all(uploadPromises);
      console.log(
        `[Audit] Screenshots uploaded successfully: Desktop=${screenshotUrl}, Mobile=${screenshotMobileUrl}`,
      );
    }
  }

  // STEP 3: Construct AI prompt for 10-dimension evaluation (gemini-3.5-flash)
  console.log(`[Audit] Querying gemini-3.5-flash for scoring...`);
  const prompt = `
      You are an elite Conversion Rate Optimisation (CRO) specialist, UX analyst, and digital marketing strategist.
      Conduct a rigorous audit of our Client's landing page copy and compare it with the competitor pages who compete in the same Google Ads auction for the search term "${searchTerm}".
      
      Evaluate the Client page across 10 categories, giving each category a score out of 10.
      
      1. Hero Section & First Impression (Hero headline, above-the-fold CTA, 5-second test)
      2. Call-to-Action (CTA) Quality (Urgency, prominence, low friction, click-to-call mobile buttons)
      3. Trust & Social Proof (Reviews, real photos, before/afters, badges, HIA/Master Builders / licenses like QBCC / Fair Trading)
      4. Mobile Experience (Tap-to-call, readable fonts, thumb-friendly elements)
      5. Copy & Content Quality (Clear benefits, pain points addressed, local Aussie tone, layout hierarchy)
      6. Local SEO & Geo-Relevance (Mentioning suburbs, region, local trust hooks)
      7. Design & Visual Hierarchy (Consistent branding, visual flow to CTAs, modern UI)
      8. Conversion Flow & Page Structure (Problem -> Solution -> Proof -> CTA, simple forms with 3-5 fields)
      9. Australian Market Fit (BNPL options like Afterpay, QBCC compliance, Australian spelling and trade references)
      10. Speed & Technical Basics (Security SSL, pixel tags, layout complexity)
      
      ---
      CRITICAL AUDIT ACCURACY AND FALSE-POSITIVE PREVENTIONS:
      - Cross-reference the provided visual screenshot image with the text context carefully.
      - Do NOT flag "duplicate 'First Meeting' copy" or "0 counter values" if the visual screenshot or rendered page text shows active counters (e.g. 100M+, 30+, 12+ Years) or distinct step headings (e.g. First Meeting, Design Development, Pricing and Readiness).
      - Be precise in separating phantom un-hydrated template markup from real, visible user issues.
      - If you detect a genuine, visible CRO issue (e.g. missing visible CTA, broken mobile layout, or poor headline match on the active page), flag it with full urgency.
      
      ---
      CLIENT PAGE CONTEXT (${url}):
      ${clientMarkdown}
      
      ---
      COMPETITORS SCRAPED:
      ${competitorUrls.map((cUrl, idx) => `COMPETITOR ${idx + 1} (${cUrl}):\n${competitorMarkdowns[idx] || "N/A"}`).join("\n\n")}
      
      ---
      OUTPUT FORMAT: You must return a valid, parsable JSON object. Follow this schema exactly:
      {
        "overall_score": 75,
        "scores": {
          "hero": 7,
          "cta": 8,
          "trust": 6,
          "mobile": 7,
          "copy": 8,
          "seo": 9,
          "design": 6,
          "flow": 7,
          "market_fit": 8,
          "tech": 9
        },
        "breakdown": {
          "hero": { "working": ["..."], "missing": ["..."], "fix": "..." },
          "cta": { "working": ["..."], "missing": ["..."], "fix": "..." },
          "trust": { "working": ["..."], "missing": ["..."], "fix": "..." },
          "mobile": { "working": ["..."], "missing": ["..."], "fix": "..." },
          "copy": { "working": ["..."], "missing": ["..."], "fix": "..." },
          "seo": { "working": ["..."], "missing": ["..."], "fix": "..." },
          "design": { "working": ["..."], "missing": ["..."], "fix": "..." },
          "flow": { "working": ["..."], "missing": ["..."], "fix": "..." },
          "market_fit": { "working": ["..."], "missing": ["..."], "fix": "..." },
          "tech": { "working": ["..."], "missing": ["..."], "fix": "..." }
        },
        "client_action_script": "A punchy copy-paste script the account manager can email or text the client highlighting the critical CRO updates needed on their site today.",
        "competitors": [
          {
            "name": "Competitor 1 Name or Domain",
            "url": "Competitor 1 URL",
            "score": 8,
            "pros": ["Nice above fold CTA", "Star rating badge"],
            "cons": ["Poor typography", "No local SEO hooks"],
            "takeaway": "Include their 'Same Day Booking Guarantee' pitch."
          }
        ],
        "top_ideas": [
          {
            "idea": "Actionable visual or copy recommendation",
            "why": "Conversion rate reasoning",
            "effort": "Easy/Medium/Hard",
            "impact": "Low/Medium/High"
          }
        ],
        "quick_wins": [
          "Quick Win Idea 1 (under 30 mins to do)",
          "Quick Win Idea 2 (under 30 mins to do)"
        ],
        "roadmap": {
          "week1": ["Weekly task 1", "Weekly task 2"],
          "week2": ["Weekly task 3"],
          "week3": ["Weekly task 4"],
          "week4": ["Weekly task 5"]
        }
      }
      
      CRITICAL CONSTRAINTS:
      - ALWAYS write in UK English spelling and grammar (e.g. optimise, prioritise, programme, behaviour, colour, analyse).
      - Do NOT include markdown code blocks (e.g. \`\`\`json) in the response text, return ONLY the raw JSON string.
      - Ensure all key names match the schema.
      - Be highly constructive, trade-specific, and include actual text recommendations (do not say "make it look better", suggest specific text).
  `;

  const contents: any[] = [prompt];
  if (auditType === "VISUAL" && screenshotBase64) {
    contents.push({
      inlineData: {
        data: screenshotBase64,
        mimeType: "image/png",
      },
    });
  }

  const result = await generateContentTracked(
    {
      model: GEMINI_MODEL_LOW,
      contents,
      config: { responseMimeType: "application/json" },
    },
    {
      feature: "landing_page_analysis",
    },
  );

  const aiResponse = result.response;
  let rawText = (aiResponse.text as string) || "";

  // Clean markdown backtick block wrappers if present
  rawText = rawText
    .replace(/```json\s*/gi, "")
    .replace(/```\s*$/gi, "")
    .trim();

  let parsedAudit: any;
  try {
    parsedAudit = JSON.parse(rawText);
  } catch (parseErr) {
    console.error("[LP Audit JSON Parse Error] Raw output:", rawText);
    throw new Error(
      "AI output could not be parsed into a valid audit JSON structure.",
    );
  }

  // Normalize competitor scores (ensure values between 0 and 100)
  if (parsedAudit.competitors && Array.isArray(parsedAudit.competitors)) {
    for (const comp of parsedAudit.competitors) {
      let score = Number(comp.score) || 0;
      if (score <= 10 && score > 0) {
        score = Math.round(score * 10);
      } else if (score > 100) {
        score = Math.round(score / 10);
      }
      comp.score = Math.min(100, Math.max(0, score));
    }
  }

  // Save in Database
  console.log(`[Audit] Saving audit results to database...`);
  const [savedAudit] = await db
    .insert(landingPageAudits)
    .values({
      adAccountId: adAccountId,
      campaignId: campaignId,
      campaignName: campaignName,
      url: url,
      searchTerm: searchTerm,
      score: parsedAudit.overall_score || 0,
      heroScore: parsedAudit.scores?.hero || 0,
      ctaScore: parsedAudit.scores?.cta || 0,
      trustScore: parsedAudit.scores?.trust || 0,
      mobileScore: parsedAudit.scores?.mobile || 0,
      copyScore: parsedAudit.scores?.copy || 0,
      seoScore: parsedAudit.scores?.seo || 0,
      designScore: parsedAudit.scores?.design || 0,
      flowScore: parsedAudit.scores?.flow || 0,
      marketFitScore: parsedAudit.scores?.market_fit || 0,
      techScore: parsedAudit.scores?.tech || 0,
      aiAnalysis: parsedAudit,
      auditType: auditType,
      screenshotUrl: screenshotUrl,
      screenshotMobileUrl: screenshotMobileUrl,
      createdAt: new Date(),
    })
    .returning({ id: landingPageAudits.id });

  return {
    auditId: savedAudit.id,
    score: parsedAudit.overall_score,
    usageAlert: result.usageAlert,
  };
}

export async function runLandingPageAuditAction(
  adAccountId: number,
  campaignId: string | null,
  campaignName: string | null,
  url: string,
  searchTerm: string,
  auditType: "PAGE_SOURCE" | "VISUAL" = "PAGE_SOURCE",
) {
  const ctx = await getAuthOrgContext();
  if (!ctx) throw new Error("Unauthorized");

  try {
    const data = await runLandingPageAuditInternal(
      adAccountId,
      campaignId,
      campaignName,
      url,
      searchTerm,
      auditType,
    );
    return { success: true as const, data };
  } catch (error: any) {
    console.error("[runLandingPageAuditAction Error]:", error);
    return { success: false as const, error: error.message };
  }
}

export async function getAuditDetailInternal(auditId: number) {
  const audit = await db.query.landingPageAudits.findFirst({
    where: eq(landingPageAudits.id, auditId),
    with: {
      account: true,
    },
  });

  if (!audit) throw new Error("Audit record not found");

  // Fetch past audits for the same URL and account
  const pastAudits = await db.query.landingPageAudits.findMany({
    where: and(
      eq(landingPageAudits.adAccountId, audit.adAccountId),
      eq(landingPageAudits.url, audit.url),
    ),
    orderBy: [desc(landingPageAudits.createdAt)],
  });

  return {
    ...audit,
    pastAudits: pastAudits.map((pa) => ({
      id: pa.id,
      score: pa.score,
      auditType: pa.auditType,
      createdAt: pa.createdAt,
    })),
  };
}

export async function getAuditDetailAction(auditId: number) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  try {
    const data = await getAuditDetailInternal(auditId);
    return { success: true as const, data };
  } catch (error: any) {
    console.error("[getAuditDetailAction Error]:", error);
    return { success: false as const, error: error.message };
  }
}

// ============================================================================
// 8. ORGANIZATION-WIDE CRO & SPEED OVERVIEW ACTION
// ============================================================================
export interface OrgOverviewData {
  avgCroScore: number;
  avgSpeedScore: number;
  totalAccounts: number;
  totalCampaigns: number;
  auditedCampaigns: number;
  speedTestedCampaigns: number;
  coveragePercent: number;
  totalSpendAtRisk: number;
  topCro: Array<{
    auditId: number;
    accountId: number;
    accountName: string;
    campaignName: string;
    url: string;
    score: number;
    createdAt: Date;
    auditType: string;
  }>;
  bottomCro: Array<{
    auditId: number;
    accountId: number;
    accountName: string;
    campaignName: string;
    url: string;
    score: number;
    createdAt: Date;
    auditType: string;
  }>;
  topSpeed: Array<{
    id: number;
    accountId: number;
    accountName: string;
    url: string;
    performanceScore: number;
    device: string;
    lcpDisplay: string | null;
    createdAt: Date;
  }>;
  bottomSpeed: Array<{
    id: number;
    accountId: number;
    accountName: string;
    url: string;
    performanceScore: number;
    device: string;
    lcpDisplay: string | null;
    createdAt: Date;
  }>;
  accountBreakdown: Array<{
    id: number;
    name: string;
    totalCampaigns: number;
    auditedCount: number;
    avgCroScore: number | null;
    avgSpeedScore: number | null;
    spendAtRisk: number;
  }>;
}

export async function getOrgLandingPageOverviewAction(): Promise<{
  success: boolean;
  data?: OrgOverviewData;
  error?: string;
}> {
  const ctx = await getAuthOrgContext();
  if (!ctx) return { success: false, error: "Unauthorized" };

  try {
    const accounts = await db.query.adAccounts.findMany({
      where: and(
        eq(adAccounts.isActive, true),
        eq(adAccounts.organizationId, ctx.orgId),
      ),
      orderBy: (table, { asc }) => asc(table.name),
    });

    if (accounts.length === 0) {
      return {
        success: true,
        data: {
          avgCroScore: 0,
          avgSpeedScore: 0,
          totalAccounts: 0,
          totalCampaigns: 0,
          auditedCampaigns: 0,
          speedTestedCampaigns: 0,
          coveragePercent: 0,
          totalSpendAtRisk: 0,
          topCro: [],
          bottomCro: [],
          topSpeed: [],
          bottomSpeed: [],
          accountBreakdown: [],
        },
      };
    }

    const accountIds = accounts.map((a) => a.id);
    const accountMap = new Map<number, string>();
    for (const acc of accounts) {
      accountMap.set(acc.id, acc.name);
    }

    const allLps = await db.query.campaignLandingPages.findMany({
      where: inArray(campaignLandingPages.adAccountId, accountIds),
    });

    const allAudits = await db.query.landingPageAudits.findMany({
      where: inArray(landingPageAudits.adAccountId, accountIds),
      orderBy: [desc(landingPageAudits.createdAt)],
    });

    const allSpeedTests = await db.query.landingPageSpeedTests.findMany({
      where: inArray(landingPageSpeedTests.adAccountId, accountIds),
      orderBy: [desc(landingPageSpeedTests.createdAt)],
    });

    const thirtyDaysAgoDate = new Date();
    thirtyDaysAgoDate.setUTCDate(thirtyDaysAgoDate.getUTCDate() - 30);
    const thirtyDaysAgoStr = thirtyDaysAgoDate.toISOString().split("T")[0];

    let perfRows: {
      adAccountId: number;
      campaignId: string;
      spend: string;
    }[] = [];
    try {
      perfRows = await db
        .select({
          adAccountId: adPerformanceDaily.adAccountId,
          campaignId: adPerformanceDaily.campaignId,
          spend: sql<string>`COALESCE(SUM(${adPerformanceDaily.spend}), 0)`,
        })
        .from(adPerformanceDaily)
        .where(
          and(
            inArray(adPerformanceDaily.adAccountId, accountIds),
            gte(adPerformanceDaily.date, thirtyDaysAgoStr),
          ),
        )
        .groupBy(adPerformanceDaily.adAccountId, adPerformanceDaily.campaignId);
    } catch (perfErr) {
      console.error("[LP Org Overview] Failed to fetch 30d spend:", perfErr);
    }

    const spendMap = new Map<string, number>();
    for (const row of perfRows) {
      spendMap.set(
        `${row.adAccountId}_${row.campaignId}`,
        Number.parseFloat(row.spend) || 0,
      );
    }

    const latestAuditByCampaign = new Map<string, (typeof allAudits)[0]>();
    for (const aud of allAudits) {
      const key = `${aud.adAccountId}_${aud.campaignId || aud.url}`;
      if (!latestAuditByCampaign.has(key)) {
        latestAuditByCampaign.set(key, aud);
      }
    }

    const latestSpeedByLp = new Map<string, (typeof allSpeedTests)[0]>();
    for (const st of allSpeedTests) {
      const key = `${st.adAccountId}_${st.url}`;
      if (!latestSpeedByLp.has(key)) {
        latestSpeedByLp.set(key, st);
      }
    }

    const croAuditsList = Array.from(latestAuditByCampaign.values());
    const avgCroScore =
      croAuditsList.length > 0
        ? Math.round(
            croAuditsList.reduce((acc, a) => acc + a.score, 0) /
              croAuditsList.length,
          )
        : 0;

    const speedTestsList = Array.from(latestSpeedByLp.values());
    const avgSpeedScore =
      speedTestsList.length > 0
        ? Math.round(
            speedTestsList.reduce((acc, s) => acc + s.performanceScore, 0) /
              speedTestsList.length,
          )
        : 0;

    const croItems = croAuditsList.map((a) => ({
      auditId: a.id,
      accountId: a.adAccountId,
      accountName: accountMap.get(a.adAccountId) || "Account",
      campaignName: a.campaignName || "General Campaign",
      url: a.url,
      score: a.score,
      createdAt: a.createdAt,
      auditType: a.auditType,
    }));

    const sortedCro = [...croItems].sort((a, b) => b.score - a.score);
    const topCro = sortedCro.slice(0, 3);
    const bottomCro = [...sortedCro].reverse().slice(0, 3);

    const speedItems = speedTestsList.map((s) => ({
      id: s.id,
      accountId: s.adAccountId,
      accountName: accountMap.get(s.adAccountId) || "Account",
      url: s.url,
      performanceScore: s.performanceScore,
      device: s.device,
      lcpDisplay: s.lcpDisplay,
      createdAt: s.createdAt,
    }));

    const sortedSpeed = [...speedItems].sort(
      (a, b) => b.performanceScore - a.performanceScore,
    );
    const topSpeed = sortedSpeed.slice(0, 3);
    const bottomSpeed = [...sortedSpeed].reverse().slice(0, 3);

    let totalSpendAtRisk = 0;
    for (const lp of allLps) {
      if (lp.status !== "ENABLED") continue;
      const spend = spendMap.get(`${lp.adAccountId}_${lp.campaignId}`) || 0;
      const aud = latestAuditByCampaign.get(
        `${lp.adAccountId}_${lp.campaignId}`,
      );
      if (!aud || aud.score < 60) {
        totalSpendAtRisk += spend;
      }
    }

    const accountBreakdown = accounts.map((acc) => {
      const accLps = allLps.filter((lp) => lp.adAccountId === acc.id);
      const accAudits = accLps
        .map((lp) => latestAuditByCampaign.get(`${acc.id}_${lp.campaignId}`))
        .filter(Boolean);
      const accSpeed = accLps
        .map((lp) => latestSpeedByLp.get(`${acc.id}_${lp.url}`))
        .filter(Boolean);

      const accAvgCro =
        accAudits.length > 0
          ? Math.round(
              accAudits.reduce((sum, a) => sum + a!.score, 0) /
                accAudits.length,
            )
          : null;

      const accAvgSpeed =
        accSpeed.length > 0
          ? Math.round(
              accSpeed.reduce((sum, s) => sum + s!.performanceScore, 0) /
                accSpeed.length,
            )
          : null;

      let accSpendAtRisk = 0;
      for (const lp of accLps) {
        if (lp.status !== "ENABLED") continue;
        const spend = spendMap.get(`${acc.id}_${lp.campaignId}`) || 0;
        const aud = latestAuditByCampaign.get(`${acc.id}_${lp.campaignId}`);
        if (!aud || aud.score < 60) {
          accSpendAtRisk += spend;
        }
      }

      return {
        id: acc.id,
        name: acc.name,
        totalCampaigns: accLps.length,
        auditedCount: accAudits.length,
        avgCroScore: accAvgCro,
        avgSpeedScore: accAvgSpeed,
        spendAtRisk: accSpendAtRisk,
      };
    });

    accountBreakdown.sort((a, b) => b.spendAtRisk - a.spendAtRisk);

    const totalCampaigns = allLps.length;
    const auditedCampaigns = latestAuditByCampaign.size;
    const coveragePercent =
      totalCampaigns > 0
        ? Math.round((auditedCampaigns / totalCampaigns) * 100)
        : 0;

    return {
      success: true,
      data: {
        avgCroScore,
        avgSpeedScore,
        totalAccounts: accounts.length,
        totalCampaigns,
        auditedCampaigns,
        speedTestedCampaigns: latestSpeedByLp.size,
        coveragePercent,
        totalSpendAtRisk,
        topCro,
        bottomCro,
        topSpeed,
        bottomSpeed,
        accountBreakdown,
      },
    };
  } catch (error: any) {
    console.error("[getOrgLandingPageOverviewAction Error]:", error);
    return { success: false, error: error.message };
  }
}

// ============================================================================
// 9. BATCH AUDIT ACTION
// ============================================================================
export async function runBatchLandingPageAuditsAction(
  adAccountId: number,
  items: Array<{
    campaignId: string;
    campaignName: string;
    url: string;
    searchTerm?: string;
    auditType?: "PAGE_SOURCE" | "VISUAL";
  }>,
) {
  const ctx = await getAuthOrgContext();
  if (!ctx) throw new Error("Unauthorized");

  if (!items || items.length === 0) {
    return {
      success: false as const,
      error: "No campaign landing pages provided for batch audit.",
    };
  }

  const results: Array<{
    campaignId: string;
    campaignName: string;
    success: boolean;
    auditId?: number;
    score?: number;
    error?: string;
  }> = [];

  for (const item of items) {
    try {
      const searchTerm = item.searchTerm?.trim()
        ? item.searchTerm.trim()
        : cleanCampaignNameToSearchTerm(item.campaignName);

      const audit = await runLandingPageAuditInternal(
        adAccountId,
        item.campaignId,
        item.campaignName,
        item.url,
        searchTerm,
        item.auditType || "PAGE_SOURCE",
      );

      results.push({
        campaignId: item.campaignId,
        campaignName: item.campaignName,
        success: true,
        auditId: audit.auditId,
        score: audit.score,
      });
    } catch (err: any) {
      console.error(
        `[Batch Audit Error] Failed for ${item.campaignName}:`,
        err,
      );
      results.push({
        campaignId: item.campaignId,
        campaignName: item.campaignName,
        success: false,
        error: err.message || "Audit failed",
      });
    }
  }

  const processed = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  return {
    success: true as const,
    data: {
      total: items.length,
      processed,
      failed,
      results,
    },
  };
}

// ============================================================================
// 10. INDEPENDENT / CUSTOM WEBPAGE MANAGEMENT
// ============================================================================
export async function addCustomLandingPageAction(
  adAccountId: number,
  title: string,
  url: string,
) {
  const ctx = await getAuthOrgContext();
  if (!ctx) throw new Error("Unauthorized");

  const cleanTitle = title.trim();
  const cleanUrl = url.trim();

  if (!cleanTitle) {
    return { success: false as const, error: "Page title or name is required." };
  }

  if (!cleanUrl.startsWith("http://") && !cleanUrl.startsWith("https://")) {
    return {
      success: false as const,
      error: "URL must begin with http:// or https://",
    };
  }

  try {
    const customCampaignId = `custom_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const [inserted] = await db
      .insert(campaignLandingPages)
      .values({
        organizationId: ctx.orgId,
        adAccountId,
        campaignId: customCampaignId,
        campaignName: cleanTitle,
        url: cleanUrl,
        status: "ENABLED",
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    return { success: true as const, data: inserted };
  } catch (error: any) {
    console.error("[addCustomLandingPageAction Error]:", error);
    return { success: false as const, error: error.message };
  }
}

export async function deleteCampaignLandingPageAction(id: number) {
  const ctx = await getAuthOrgContext();
  if (!ctx) throw new Error("Unauthorized");

  try {
    const existing = await db.query.campaignLandingPages.findFirst({
      where: eq(campaignLandingPages.id, id),
    });

    if (!existing) {
      return { success: false as const, error: "Landing page not found." };
    }

    await db
      .delete(campaignLandingPages)
      .where(eq(campaignLandingPages.id, id));

    return { success: true as const };
  } catch (error: any) {
    console.error("[deleteCampaignLandingPageAction Error]:", error);
    return { success: false as const, error: error.message };
  }
}
