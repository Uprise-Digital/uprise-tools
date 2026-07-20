"use server";

import fs from "node:fs";
import path from "node:path";
import * as cheerio from "cheerio";
import { eq } from "drizzle-orm";
import TurndownService from "turndown";
import { db } from "@/db";
import { adAccounts, threatMatrixAudits } from "@/db/schema";
import { generateContentTracked } from "@/lib/ai-logger";
import {
  fetchTopClientLandingPage,
  fetchTopNonBrandedSearchTerm,
} from "@/lib/google-ads";

// ============================================================================
// 4. AUTO-TARGETING HELPER
// ============================================================================
export async function getAutoTargetAction(
  googleAccountId: string,
  accountName: string,
) {
  try {
    console.log(
      `[Auto-Target] Fetching top non-branded search term for ${accountName}...`,
    );
    const term = await fetchTopNonBrandedSearchTerm(
      googleAccountId,
      accountName,
    );
    return { success: true, data: term };
  } catch (error: any) {
    console.error("[Auto-Target Error]:", error);
    return { success: false, error: error.message };
  }
}

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

async function scrapeAndCompressLandingPage(targetUrl: string) {
  try {
    console.log(`[Scraper] Fetching URL via scrape.do: ${targetUrl}`);
    const scrapeDoUrl = `http://api.scrape.do?token=${process.env.SCRAPE_DO_KEY}&url=${encodeURIComponent(targetUrl)}`;

    const response = await fetch(scrapeDoUrl, { next: { revalidate: 3600 } });
    const html = await response.text();

    const $ = cheerio.load(html);

    $(
      "script, style, noscript, svg, img, nav, footer, iframe, meta, link, header",
    ).remove();

    let highValueHtml = "";
    $("h1, h2, h3").each((i, el) => {
      const $el = $(el);
      if (isElementHidden($el, $)) return;
      highValueHtml += `${$.html(el)}<br/>`;
    });
    $("a, button, .btn").each((i, el) => {
      const $el = $(el);
      if (isElementHidden($el, $)) return;
      highValueHtml += `${$.html(el)}<br/>`;
    });
    $("ul, ol").each((i, el) => {
      const $el = $(el);
      if (isElementHidden($el, $)) return;
      highValueHtml += `${$.html(el)}<br/>`;
    });
    $("p")
      .slice(0, 10)
      .each((i, el) => {
        const $el = $(el);
        if (isElementHidden($el, $)) return;
        highValueHtml += `${$.html(el)}<br/>`;
      });

    const turndownService = new TurndownService();
    const cleanMarkdown = turndownService.turndown(
      highValueHtml || $.html("body"),
    );

    return cleanMarkdown.substring(0, 15000);
  } catch (error) {
    console.error(`[Scraper Error] Failed to scrape ${targetUrl}:`, error);
    return "ERROR_SCRAPING_PAGE";
  }
}

// ============================================================================
// 2. HELPER: GET TOP COMPETITORS VIA LIVE GOOGLE SERP (SCRAPE.DO)
// ============================================================================
async function getLiveCompetitorsFromGoogleDirect(
  searchTerm: string,
  clientDomain: string,
) {
  console.log(`\n[SERP Sniper] ==========================================`);
  console.log(`[SERP Sniper] 🎯 Target Keyword: "${searchTerm}"`);
  console.log(`[SERP Sniper] 🛡️ Client Domain to ignore: "${clientDomain}"`);

  try {
    // 1. Ask Scrape.do to run a live Google Search from Australia
    const googleSearchUrl = `https://www.google.com.au/search?q=${encodeURIComponent(searchTerm)}&num=10`;
    const scrapeDoUrl = `http://api.scrape.do?token=${process.env.SCRAPE_DO_KEY}&geoCode=au&super=true&render=true&url=${encodeURIComponent(googleSearchUrl)}`;

    console.log(`[SERP Sniper] 📡 Pinging Scrape.do...`);
    const response = await fetch(scrapeDoUrl);

    if (!response.ok) {
      console.error(
        `[SERP Sniper] ❌ HTTP Error: ${response.status} ${response.statusText}`,
      );
      throw new Error(`Scrape.do returned HTTP ${response.status}`);
    }

    const html = await response.text();
    console.log(
      `[SERP Sniper] ✅ Received HTML response. Size: ${(html.length / 1024).toFixed(2)} KB`,
    );

    // ============================================================
    // DEBUGGING: UNCOMMENT THIS TO DUMP THE HTML TO YOUR SERVER
    const filePath = path.join(process.cwd(), "public", "debug-serp.html");
    fs.writeFileSync(filePath, html);
    console.log(`[SERP Sniper] 💾 Saved HTML to: ${filePath}`);
    // ============================================================

    // If the HTML is unusually small (e.g., < 20KB), Google might have served a Captcha
    if (html.length < 50000) {
      console.warn(
        `[SERP Sniper] ⚠️ WARNING: HTML size is unusually small. Scrape.do might have hit a captcha.`,
      );
    }

    const $ = cheerio.load(html);
    const competitorUrls: string[] = [];

    // Find all elements containing /aclk?
    const adLinks = $('a[href*="/aclk?"]');
    console.log(
      `[SERP Sniper] 🔍 Found ${adLinks.length} total '/aclk?' tracking links in the DOM.`,
    );

    // 2. Process each Ad link
    adLinks.each((i, el) => {
      if (competitorUrls.length >= 3) return false; // Break the loop if we already have 3

      const href = $(el).attr("href")!;
      const fullUrl = href.startsWith("http")
        ? href
        : `https://www.google.com.au${href}`;

      // Clean up the text for logging and comparison
      const visibleText = $(el)
        .text()
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim();

      console.log(`\n[SERP Sniper] --- Inspecting Ad Link ${i + 1} ---`);
      console.log(
        `[SERP Sniper] 📝 Visible Text: "${visibleText.substring(0, 60)}${visibleText.length > 60 ? "..." : ""}"`,
      );

      // Rejection 1: Is it our own client?
      if (visibleText.includes(clientDomain.toLowerCase())) {
        console.log(
          `[SERP Sniper] 🛑 REJECTED: Matches client domain (${clientDomain})`,
        );
        return;
      }

      // Rejection 2: Is it a duplicate link? (Google puts multiple links per ad block)
      if (competitorUrls.includes(fullUrl)) {
        console.log(
          `[SERP Sniper] 🛑 REJECTED: Duplicate URL already in array`,
        );
        return;
      }

      // Success: Add it to the array
      console.log(`[SERP Sniper] ✅ ACCEPTED: Added to competitor list!`);
      competitorUrls.push(fullUrl);
    });

    console.log(`\n[SERP Sniper] ==========================================`);
    if (competitorUrls.length === 0) {
      console.log(
        `[SERP Sniper] 📉 RESULT: No valid competitor ads found for "${searchTerm}".`,
      );
    } else {
      console.log(
        `[SERP Sniper] 📈 RESULT: Successfully extracted ${competitorUrls.length} competitor URLs.`,
      );
    }

    return competitorUrls;
  } catch (error: any) {
    console.error(
      `\n[SERP Sniper Error] Failed to fetch competitors for "${searchTerm}":`,
      error.message || error,
    );
    throw new Error(
      `Competitor discovery failed: ${error.message || "Unknown network error"}`,
    );
  }
}

// ============================================================================
// 2. HELPER: GET TOP COMPETITORS VIA SERPER.DEV
// ============================================================================
async function getLiveCompetitorsFromSerper(
  searchTerm: string,
  clientDomain: string,
) {
  console.log(`[Serper] Finding competitors for: "${searchTerm}"`);

  try {
    const response = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: {
        "X-API-KEY": process.env.SERPER_KEY!,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        q: searchTerm,
        gl: "au",
        hl: "en",
      }),
    });

    // Fetch does not throw on HTTP errors (like 401 or 500). We must check manually.
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Serper API returned ${response.status}: ${errorText}`);
    }

    const data = await response.json();

    // Gracefully handle if Serper returns successful JSON but no ads are present
    if (!data.ads || data.ads.length === 0) {
      console.log(`[Serper] No sponsored ads found for "${searchTerm}".`);
      return [];
    }

    const competitorUrls = data.ads
      .filter((ad: any) => !ad.link.includes(clientDomain))
      .slice(0, 3)
      .map((ad: any) => ad.link);

    return competitorUrls;
  } catch (error: any) {
    // Log the exact point of failure for your server logs
    console.error(
      `[Serper Error] Failed to fetch competitors for "${searchTerm}":`,
      error.message || error,
    );

    // Rethrow the error so the parent function (generateThreatMatrixAction)
    // catches it and safely passes the error message to the UI
    throw new Error(
      `Competitor discovery failed: ${error.message || "Unknown network error"}`,
    );
  }
}

// ============================================================================
// 3. THE MASTER ACTION: UPRISE THREAT MATRIX
// ============================================================================
export async function generateThreatMatrixAction(
  adAccountId: number,
  searchTerm: string,
) {
  try {
    // STEP 1: Get the Client's Google Account Data
    const account = await db.query.adAccounts.findFirst({
      where: eq(adAccounts.id, adAccountId),
    });

    if (!account) throw new Error("Account not found in database.");

    // STEP 2: Dynamically Resolve Client URL
    let clientUrl = account.websiteUrl;

    if (!clientUrl) {
      console.log(
        `[Threat Matrix] No websiteUrl in DB. Fetching top landing page from Google Ads API...`,
      );
      const topUrl = await fetchTopClientLandingPage(account.googleAccountId);

      if (!topUrl) {
        throw new Error(
          "Could not detect an active landing page for this client from Google Ads.",
        );
      }
      clientUrl = topUrl;

      // Auto-heal the database: Save it so we don't have to query Google Ads API next time
      await db
        .update(adAccounts)
        .set({ websiteUrl: clientUrl })
        .where(eq(adAccounts.id, account.id));
    }

    const clientDomain = new URL(clientUrl).hostname.replace("www.", "");

    // STEP 3: Find the Competitors on the live SERP
    const competitorUrls = await getLiveCompetitorsFromGoogleDirect(
      searchTerm,
      clientDomain,
    );

    if (competitorUrls.length === 0) {
      return {
        success: false,
        error: "No competitor ads found running for this keyword right now.",
      };
    }

    // STEP 4: Scrape Client & Competitors in Parallel
    console.log(
      `[Threat Matrix] Scraping client and ${competitorUrls.length} competitors...`,
    );

    const [clientMarkdown, ...competitorMarkdowns] = await Promise.all([
      scrapeAndCompressLandingPage(clientUrl),
      ...competitorUrls.map((url: string) => scrapeAndCompressLandingPage(url)),
    ]);

    // STEP 5: The LLM Brain
    console.log(`[Threat Matrix] Executing AI Analysis...`);

    const prompt = `
        You are an elite Market Analyst and Conversion Rate Optimization (CRO) expert. 
        I am providing you with the compressed Markdown landing page copy for our Client and their Top Competitors who are actively bidding against them on Google Ads for the keyword "${searchTerm}".

        CLIENT PAGE (${clientUrl}):
        ${clientMarkdown}

        ---
        COMPETITOR 1 (${competitorUrls[0] || "N/A"}):
        ${competitorMarkdowns[0] || "N/A"}

        COMPETITOR 2 (${competitorUrls[1] || "N/A"}):
        ${competitorMarkdowns[1] || "N/A"}

        COMPETITOR 3 (${competitorUrls[2] || "N/A"}):
        ${competitorMarkdowns[2] || "N/A"}

        Analyze all pages based on Direct Response heuristics. Identify exactly why the Client might lose traffic to these specific competitors.

        OUTPUT FORMAT (Strict JSON):
        {
          "market_gaps": [
            {
              "category": "The Offer / Hook or Urgency or Friction",
              "client_current": "What the client is currently doing.",
              "competitor_winning_strategy": "What the competitors are doing better.",
              "severity": "CRITICAL, HIGH, or MEDIUM"
            }
          ],
          "competitor_scoring": {
            "client_score_out_of_10": 4,
            "market_leader_name": "Name of the best competitor page",
            "market_leader_score": 9
          },
          "client_action_plan": "Write a punchy, 3-bullet-point script the Account Manager can copy/paste to the client explaining exactly what must change on their website today to survive in this specific auction."
        }
        
        CONSTRAINTS: Be brutal and data-driven. Do not provide generic advice. Quote specific offers or text found in the competitor pages.
        `;

    const result = await generateContentTracked(
      {
        model: "gemini-1.5-flash", // Corrected model version
        contents: prompt,
        config: { responseMimeType: "application/json" },
      },
      {
        feature: "threat_matrix",
      },
    );

    const aiResponse = result.response;
    const parsedAnalysis = JSON.parse(aiResponse.text as string);

    // STEP 6: Cache the Audit in the Database
    console.log(`[Threat Matrix] Saving audit to database...`);
    const [savedAudit] = await db
      .insert(threatMatrixAudits)
      .values({
        adAccountId: account.id,
        searchTerm: searchTerm,
        clientUrlScraped: clientUrl,
        competitorUrlsScraped: competitorUrls,
        aiAnalysis: parsedAnalysis,
      })
      .returning({ id: threatMatrixAudits.id });

    // STEP 7: Return the Payload to the UI
    return {
      success: true,
      data: {
        auditId: savedAudit.id,
        clientUrl,
        competitorUrls,
        analysis: parsedAnalysis,
        usageAlert: result.usageAlert,
      },
    };
  } catch (error: any) {
    console.error("[Threat Matrix Error]:", error);
    return { success: false, error: error.message };
  }
}
