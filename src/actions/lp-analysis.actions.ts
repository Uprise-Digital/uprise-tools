"use server";

import { GoogleGenAI } from "@google/genai";
import * as cheerio from "cheerio";
import { and, desc, eq } from "drizzle-orm";
import { headers } from "next/headers";
import TurndownService from "turndown";
import { db } from "@/db";
import {
  adAccounts,
  campaignLandingPages,
  landingPageAudits,
} from "@/db/schema";
import { auth } from "@/lib/auth";
import { fetchCampaignLandingPages } from "@/lib/google-ads";
import { uploadImageToR2 } from "@/lib/storage";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
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
      /(?:^|[^a-zA-Z0-9])(accordion|tab|tabs|collapse|collapsed|faq|faqs|dropdown)(?:$|[^a-zA-Z0-9])/i.test(className) ||
      /(?:^|[^a-zA-Z0-9])(accordion|tab|tabs|collapse|collapsed|faq|faqs|dropdown)(?:$|[^a-zA-Z0-9])/i.test(idName) ||
      role === "tabpanel"
    ) {
      isProgressiveDisclosure = true;
      break;
    }
    const parentNode = current.parent();
    if (parentNode && parentNode.length > 0) {
      const pNode = parentNode[0];
      if (pNode && pNode.type !== "root" && pNode.name !== "body" && pNode.name !== "html") {
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
    if (parentNode && parentNode.type !== "root" && parentNode.name !== "body" && parentNode.name !== "html") {
      return isElementHidden(parent, $);
    }
  }

  return false;
}

export async function scrapeLandingPageExtended(
  targetUrl: string,
  options?: { render?: boolean; screenshot?: boolean; width?: number; height?: number }
): Promise<{ markdown: string; screenshotBase64?: string }> {
  try {
    console.log(`[LP Scraper] Scraping URL: ${targetUrl} (Render: ${!!options?.render}, Screenshot: ${!!options?.screenshot}, Viewport: ${options?.width || "default"}x${options?.height || "default"})`);
    
    let scrapeDoUrl = `http://api.scrape.do?token=${process.env.SCRAPE_DO_KEY}&url=${encodeURIComponent(targetUrl)}`;
    if (options?.render) scrapeDoUrl += "&render=true";
    if (options?.screenshot) {
      scrapeDoUrl += "&screenShot=true&returnJSON=true&customWait=5000";
      if (options.width) scrapeDoUrl += `&width=${options.width}`;
      if (options.height) scrapeDoUrl += `&height=${options.height}`;
    }

    const response = await fetch(scrapeDoUrl, { next: { revalidate: 3600 } });
    
    let html = "";
    let screenshotBase64: string | undefined;

    if (options?.screenshot) {
      const data = await response.json();
      html = data.html || "";
      screenshotBase64 = data.screenShots?.[0]?.image;
    } else {
      html = await response.text();
    }

    const $ = cheerio.load(html);

    // Strip unneeded components
    $(
      "script, style, noscript, svg, img, nav, footer, iframe, meta, link, header, head",
    ).remove();

    let highValueHtml = "";
    $("h1, h2, h3").each((_, el) => {
      const $el = $(el);
      if (isElementHidden($el, $)) return;
      highValueHtml += `${$.html(el)}<br/>`;
    });
    $("a, button, .btn").each((_, el) => {
      const $el = $(el);
      if (isElementHidden($el, $)) return;
      highValueHtml += `${$.html(el)}<br/>`;
    });
    $("ul, ol").each((_, el) => {
      const $el = $(el);
      if (isElementHidden($el, $)) return;
      highValueHtml += `${$.html(el)}<br/>`;
    });
    $("p")
      .slice(0, 15)
      .each((_, el) => {
        const $el = $(el);
        if (isElementHidden($el, $)) return;
        highValueHtml += `${$.html(el)}<br/>`;
      });

    const turndownService = new TurndownService();
    const cleanMarkdown = turndownService.turndown(
      highValueHtml || $.html("body"),
    );

    return {
      markdown: cleanMarkdown.substring(0, 18000),
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

  // Group latest audits by campaignId
  const latestAuditsMap = new Map<string, any>();
  for (const audit of audits) {
    if (audit.campaignId && !latestAuditsMap.has(audit.campaignId)) {
      latestAuditsMap.set(audit.campaignId, {
        id: audit.id,
        score: audit.score,
        auditType: audit.auditType,
        createdAt: audit.createdAt,
      });
    }
  }

  // Map audits back to the campaign list
  return mappings.map((m) => {
    const campaignAudits = audits.filter((a) => a.campaignId === m.campaignId);
    const latestAudit = campaignAudits[0]
      ? {
          id: campaignAudits[0].id,
          score: campaignAudits[0].score,
          auditType: campaignAudits[0].auditType,
          createdAt: campaignAudits[0].createdAt,
        }
      : null;

    return {
      id: m.id,
      campaignId: m.campaignId,
      campaignName: m.campaignName,
      url: m.url,
      status: m.status,
      updatedAt: m.updatedAt,
      latestAudit,
      audits: campaignAudits.map((a) => ({
        id: a.id,
        score: a.score,
        auditType: a.auditType,
        createdAt: a.createdAt,
      })),
    };
  });
}

export async function getCampaignLandingPagesAction(adAccountId: number) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

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

  console.log(
    `[Sync] Fetching campaign landing pages from Google Ads for ${account.name}...`,
  );
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
            updatedAt: new Date(),
          },
        });
    }
  } else {
    throw new Error(
      "No campaigns or landing page URLs returned from Google Ads API.",
    );
  }

  return { success: true as const, count: synced.length };
}

export async function syncCampaignLandingPagesAction(adAccountId: number) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  try {
    return await syncCampaignLandingPagesInternal(adAccountId);
  } catch (error: any) {
    console.error("[syncCampaignLandingPagesAction Error]:", error);
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
    console.log(`[Audit] Fetching Desktop and Mobile visual snapshots in parallel...`);
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
    competitorUrls.map((compUrl) => scrapeAndCompressLandingPage(compUrl))
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
        })
      );
    }
    
    if (screenshotMobileBase64) {
      const filename = `audit-${adAccountId}-${Date.now()}-mobile.png`;
      uploadPromises.push(
        uploadImageToR2(screenshotMobileBase64, filename).then((resUrl) => {
          screenshotMobileUrl = resUrl;
        })
      );
    }

    if (uploadPromises.length > 0) {
      console.log(`[Audit] Uploading desktop & mobile screenshots to Cloudflare R2...`);
      await Promise.all(uploadPromises);
      console.log(`[Audit] Screenshots uploaded successfully: Desktop=${screenshotUrl}, Mobile=${screenshotMobileUrl}`);
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
      - Be precise in separating phantom markup (such as hidden desktop/mobile duplicate widgets or background system configurations) from real, visible user issues.
      - If you detect a critical CRO issue (e.g. missing visible CTA, broken mobile layout, or poor headline match on the active page), flag it with full urgency.
      - Only soften the warning if you suspect the element is not visually active/rendered for the current visitor screen size (e.g. duplicate mobile layouts scraped on desktop viewport). Do not soften warnings for genuine visible issues.
      
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
      - Do NOT include markdown code blocks (e.g. \`\`\`json) in the response text, return ONLY the raw JSON string.
      - Ensure all key names match the schema.
      - Be highly constructive, trade-specific, and include actual text recommendations (do not say "make it look better", suggest specific text).
  `;

  let contents: any[] = [prompt];
  if (auditType === "VISUAL" && screenshotBase64) {
    contents.push({
      inlineData: {
        data: screenshotBase64,
        mimeType: "image/png",
      },
    });
  }

  const aiResponse = await ai.models.generateContent({
    model: "gemini-3.5-flash",
    contents,
    config: { responseMimeType: "application/json" },
  });

  const parsedAudit = JSON.parse(aiResponse.text as string);

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
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

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
      eq(landingPageAudits.url, audit.url)
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
