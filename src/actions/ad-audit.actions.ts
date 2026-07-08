"use server";

import { GoogleGenAI } from "@google/genai";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { db } from "@/db";
import { adAccounts, adGroupAdAudits } from "@/db/schema";
import { auth } from "@/lib/auth";
import {
  fetchAdGroupAdAssetPerformance,
  fetchAdGroupAds,
} from "@/lib/google-ads";
import { scrapeAndCompressLandingPage } from "./lp-analysis.actions";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

/**
 * Interface representing the detailed analysis stored inside aiAnalysis jsonb field
 */
export interface AdCopyAuditAnalysis {
  overall_score: number;
  message_match_score: number;
  ad_strength_analysis: string;
  copy_relevance_breakdown: {
    headlines: { pro: string[]; con: string[]; fix: string };
    descriptions: { pro: string[]; con: string[]; fix: string };
  };
  pinning_analysis: {
    issues: string[];
    recommendations: string[];
  };
  missing_signals: {
    price_hooks: string[];
    speed_urgency: string[];
    trust_guarantees: string[];
  };
  competitors: Array<{
    domain: string;
    headlines: string[];
    descriptions: string[];
    takeaway: string;
  }>;
  roadmap: {
    headlines_to_add: string[];
    descriptions_to_add: string[];
    pins_to_adjust: string[];
  };
  client_action_script: string;
}

/**
 * Discovers actual competitor ad headlines and descriptions using Serper.dev
 */
async function fetchCompetitorAds(searchTerm: string, clientDomain: string) {
  if (!process.env.SERPER_KEY) return [];
  try {
    const response = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: {
        "X-API-KEY": process.env.SERPER_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ q: searchTerm, gl: "au", hl: "en" }),
    });

    if (!response.ok) return [];
    const data = await response.json();
    const competitorAds: Array<{
      domain: string;
      headlines: string[];
      descriptions: string[];
    }> = [];

    if (data.ads && data.ads.length > 0) {
      for (const ad of data.ads) {
        if (
          !ad.link ||
          ad.link.toLowerCase().includes(clientDomain.toLowerCase())
        )
          continue;
        try {
          const domain = new URL(ad.link).hostname.replace("www.", "");
          // Serper ads might have multiple headlines in title separated by | or -
          const title = ad.title || "";
          const headlines = title
            .split(/[|-]/)
            .map((h: string) => h.trim())
            .filter(Boolean);
          const descriptions = ad.snippet ? [ad.snippet.trim()] : [];

          competitorAds.push({ domain, headlines, descriptions });
        } catch {
          // ignore invalid URLs
        }
      }
    }
    return competitorAds;
  } catch (error) {
    console.error("[Competitor Ads Fetch Error]:", error);
    return [];
  }
}

/**
 * Logic to run a complete ad copy audit
 */
export async function runAdCopyAuditInternal(
  adAccountId: number,
  campaignId: string,
  campaignName: string,
  adGroupId: string,
  adGroupName: string,
  adId: string,
  searchTerm: string,
  focusUrl?: string,
) {
  // Fetch account token info from DB
  const account = await db.query.adAccounts.findFirst({
    where: eq(adAccounts.id, adAccountId),
  });
  if (!account) throw new Error("Account not found");

  const googleAccountId = account.googleAccountId;

  // STEP 1: Fetch active ads and check if target ad exists
  const ads = await fetchAdGroupAds(googleAccountId, campaignId, adGroupId);
  const targetAd = ads.find((a: any) => a.adId === adId);
  if (!targetAd)
    throw new Error(`Ad with ID ${adId} not found in Campaign/AdGroup`);

  // STEP 2: Fetch performance labels and pinning info for RSA assets
  const assetPerformance = await fetchAdGroupAdAssetPerformance(
    googleAccountId,
    campaignId,
  );
  const adAssets = assetPerformance.filter((ap: any) => ap.adId === adId);

  // Group asset data for prompt & summary checks
  const headlines = adAssets
    .filter(
      (a: any) =>
        a.fieldType === "HEADLINE" || a.fieldType.includes("HEADLINE"),
    )
    .map((a: any) => ({
      text: a.text,
      performance: a.performanceLabel,
      pinned: a.pinnedField,
    }));

  const descriptions = adAssets
    .filter(
      (a: any) =>
        a.fieldType === "DESCRIPTION" || a.fieldType.includes("DESCRIPTION"),
    )
    .map((a: any) => ({
      text: a.text,
      performance: a.performanceLabel,
      pinned: a.pinnedField,
    }));

  // Match headlines/descriptions from fetchAdGroupAds fallback if asset performance view is sparse
  if (headlines.length === 0 && targetAd.headlines.length > 0) {
    headlines.push(
      ...targetAd.headlines.map((h: any) => ({
        text: h.text,
        performance: "UNSPECIFIED",
        pinned: h.pinnedField,
      })),
    );
  }
  if (descriptions.length === 0 && targetAd.descriptions.length > 0) {
    descriptions.push(
      ...targetAd.descriptions.map((d: any) => ({
        text: d.text,
        performance: "UNSPECIFIED",
        pinned: d.pinnedField,
      })),
    );
  }

  // STEP 3: Detect Pinning Issues
  const pinningIssues: string[] = [];
  for (const h of headlines) {
    if (h.performance === "LOW" && h.pinned !== "UNSPECIFIED") {
      pinningIssues.push(
        `Headline "${h.text}" is pinned to ${h.pinned} but has a LOW performance label.`,
      );
    }
  }
  for (const d of descriptions) {
    if (d.performance === "LOW" && d.pinned !== "UNSPECIFIED") {
      pinningIssues.push(
        `Description "${d.text}" is pinned to ${d.pinned} but has a LOW performance label.`,
      );
    }
  }

  // STEP 4: Scrape focus URL landing page copy
  let lpMarkdown = "";
  if (focusUrl) {
    lpMarkdown = await scrapeAndCompressLandingPage(focusUrl);
  }

  // STEP 5: Scan competitor search ads
  const clientDomain = focusUrl
    ? new URL(focusUrl).hostname.replace("www.", "")
    : "client.com.au";
  const competitorAds = await fetchCompetitorAds(searchTerm, clientDomain);

  // STEP 6: Run Gemini-3.5-flash evaluation
  const prompt = `
    You are an elite Google Ads copywriter, PPC media buyer, and message-match strategist.
    Evaluate the following Responsive Search Ad (RSA) details for search term intent match, performance constraints, and landing page consistency.

    SEARCH TERM: "${searchTerm}"
    FOCUS URL: ${focusUrl || "N/A"}
    GOOGLE AD STRENGTH: "${targetAd.adStrength}"

    AD HEADLINES AUDITED:
    ${headlines.map((h: any, i: number) => `${i + 1}. [${h.performance}] [Pinned: ${h.pinned}] Text: "${h.text}"`).join("\n")}

    AD DESCRIPTIONS AUDITED:
    ${descriptions.map((d: any, i: number) => `${i + 1}. [${d.performance}] [Pinned: ${d.pinned}] Text: "${d.text}"`).join("\n")}

    ${lpMarkdown ? `LANDING PAGE COPY CONTEXT:\n${lpMarkdown}\n` : ""}
    ${
      competitorAds.length > 0
        ? `COMPETITOR ADS SERVING IN AUCTION:\n${competitorAds
            .map(
              (c: any) =>
                `Domain: ${c.domain}\nHeadlines: ${c.headlines.join(" | ")}\nDescriptions: ${c.descriptions.join(" | ")}`,
            )
            .join("\n\n")}`
        : ""
    }

    ---
    OUTPUT FORMAT: Return a valid, parsable JSON object matching this schema exactly:
    {
      "overall_score": 75,
      "message_match_score": 85,
      "ad_strength_analysis": "PPC critique of the current Google Ad Strength score and how to improve it.",
      "copy_relevance_breakdown": {
        "headlines": {
          "pro": ["Headline strengths..."],
          "con": ["Headline weaknesses..."],
          "fix": "Actionable copywriting advice to improve headlines."
        },
        "descriptions": {
          "pro": ["Description strengths..."],
          "con": ["Description weaknesses..."],
          "fix": "Actionable copywriting advice to improve descriptions."
        }
      },
      "pinning_analysis": {
        "issues": ["Any pinning conflicts detected (e.g. pinning low-performing assets to position 1, over-pinning capping RSA learning)"],
        "recommendations": ["How to optimize pins"]
      },
      "missing_signals": {
        "price_hooks": ["Price points or commercial triggers missing in copy"],
        "speed_urgency": ["Speed/urgency triggers missing in copy"],
        "trust_guarantees": ["Trust badges, guarantees, or safety triggers missing in copy"]
      },
      "competitors": [
        {
          "domain": "competitor.com.au",
          "headlines": ["Headlines used"],
          "descriptions": ["Descriptions used"],
          "takeaway": "Copywriting angle to borrow or counter-pitch."
        }
      ],
      "roadmap": {
        "headlines_to_add": ["3-5 concrete, high-intent headline suggestions (e.g. containing local geo, price, speed, guarantee)"],
        "descriptions_to_add": ["2-3 specific description line suggestions"],
        "pins_to_adjust": ["Specific pinning suggestions (e.g. unpin low performer, pin keyword to headline 1)"]
      },
      "client_action_script": "A punchy copy-paste script the account manager can email or text the client highlighting the recommended creative updates."
    }

    CRITICAL CONSTRAINTS:
    - Do NOT include markdown code blocks (e.g. \`\`\`json) in the response text, return ONLY the raw JSON string.
    - Ensure all key names match the schema.
    - Be highly constructive, trade-specific, and include actual text recommendations (do not say "make it look better", suggest specific text).
  `;

  console.log("[Ad Audit] Querying gemini-3.5-flash for scoring...");
  const aiResponse = await ai.models.generateContent({
    model: "gemini-3.5-flash",
    contents: prompt,
    config: { responseMimeType: "application/json" },
  });

  const parsedAudit: AdCopyAuditAnalysis = JSON.parse(
    aiResponse.text as string,
  );

  // Append pinning issues discovered mechanically
  if (pinningIssues.length > 0) {
    parsedAudit.pinning_analysis.issues = [
      ...new Set([
        ...(parsedAudit.pinning_analysis.issues || []),
        ...pinningIssues,
      ]),
    ];
  }

  // Save audit to DB
  console.log("[Ad Audit] Saving audit results to database...");
  const [savedAudit] = await db
    .insert(adGroupAdAudits)
    .values({
      adAccountId,
      campaignId,
      campaignName,
      adGroupId,
      adGroupName,
      adId,
      searchTerm,
      score: parsedAudit.overall_score || 0,
      adStrength: targetAd.adStrength,
      messageMatchScore: parsedAudit.message_match_score || 0,
      aiAnalysis: parsedAudit,
      createdAt: new Date(),
    })
    .returning({ id: adGroupAdAudits.id });

  return {
    auditId: savedAudit.id,
    score: parsedAudit.overall_score,
  };
}

/**
 * Server Action for running an ad copy audit
 */
export async function runAdCopyAuditAction(
  adAccountId: number,
  campaignId: string,
  campaignName: string,
  adGroupId: string,
  adGroupName: string,
  adId: string,
  searchTerm: string,
  focusUrl?: string,
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  try {
    const data = await runAdCopyAuditInternal(
      adAccountId,
      campaignId,
      campaignName,
      adGroupId,
      adGroupName,
      adId,
      searchTerm,
      focusUrl,
    );
    return { success: true as const, data };
  } catch (error: any) {
    console.error("[runAdCopyAuditAction Error]:", error);
    return { success: false as const, error: error.message };
  }
}

/**
 * Logic to list ad group ads and their latest audit status
 */
export async function listAdGroupAdsInternal(adAccountId: number) {
  const account = await db.query.adAccounts.findFirst({
    where: eq(adAccounts.id, adAccountId),
  });
  if (!account) throw new Error("Account not found");

  const googleAccountId = account.googleAccountId;

  // Retrieve enabled ads
  const ads = await fetchAdGroupAds(googleAccountId);

  // Retrieve existing audits for this account to join
  const audits = await db.query.adGroupAdAudits.findMany({
    where: eq(adGroupAdAudits.adAccountId, adAccountId),
    orderBy: (table, { desc }) => desc(table.createdAt),
  });

  // Map latest audits by adId
  const latestAuditsMap = new Map<
    string,
    typeof adGroupAdAudits.$inferSelect
  >();
  for (const audit of audits) {
    if (!latestAuditsMap.has(audit.adId)) {
      latestAuditsMap.set(audit.adId, audit);
    }
  }

  return ads.map((ad: any) => {
    const latestAudit = latestAuditsMap.get(ad.adId);
    return {
      ...ad,
      latestAuditScore: latestAudit ? latestAudit.score : null,
      latestAuditDate: latestAudit ? latestAudit.createdAt : null,
      latestAuditId: latestAudit ? latestAudit.id : null,
    };
  });
}

/**
 * Server Action for listing ad group ads
 */
export async function listAdGroupAdsAction(adAccountId: number) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  try {
    const data = await listAdGroupAdsInternal(adAccountId);
    return { success: true as const, data };
  } catch (error: any) {
    console.error("[listAdGroupAdsAction Error]:", error);
    return { success: false as const, error: error.message };
  }
}

/**
 * Logic to retrieve detailed ad copy audit results
 */
export async function getAdCopyAuditDetailsInternal(auditId: number) {
  const audit = await db.query.adGroupAdAudits.findFirst({
    where: eq(adGroupAdAudits.id, auditId),
    with: {
      account: true,
    },
  });
  if (!audit) throw new Error("Ad copy audit not found");
  return audit;
}

/**
 * Server Action for retrieving ad copy audit details
 */
export async function getAdCopyAuditDetailsAction(auditId: number) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  try {
    const data = await getAdCopyAuditDetailsInternal(auditId);
    return { success: true as const, data };
  } catch (error: any) {
    console.error("[getAdCopyAuditDetailsAction Error]:", error);
    return { success: false as const, error: error.message };
  }
}

/**
 * Logic to generate a lightweight asset performance report (Layer 1 only, no Gemini)
 */
export async function getAssetPerformanceReportInternal(
  adAccountId: number,
  campaignId?: string,
) {
  const account = await db.query.adAccounts.findFirst({
    where: eq(adAccounts.id, adAccountId),
  });
  if (!account) throw new Error("Account not found");

  const googleAccountId = account.googleAccountId;
  const assetPerformance = await fetchAdGroupAdAssetPerformance(
    googleAccountId,
    campaignId,
  );

  // Group assets by performance label
  const lowCount = assetPerformance.filter(
    (a: any) => a.performanceLabel === "LOW",
  ).length;
  const goodCount = assetPerformance.filter(
    (a: any) => a.performanceLabel === "GOOD",
  ).length;
  const bestCount = assetPerformance.filter(
    (a: any) => a.performanceLabel === "BEST",
  ).length;
  const otherCount =
    assetPerformance.length - (lowCount + goodCount + bestCount);

  // Find pinning conflicts
  const pinningConflicts = assetPerformance
    .filter(
      (a: any) =>
        a.performanceLabel === "LOW" &&
        a.pinnedField !== "UNSPECIFIED" &&
        a.pinnedField !== "UNKNOWN",
    )
    .map((a: any) => ({
      adId: a.adId,
      fieldType: a.fieldType,
      pinnedField: a.pinnedField,
      text: a.text,
    }));

  return {
    totalAssetsAudited: assetPerformance.length,
    lowCount,
    goodCount,
    bestCount,
    otherCount,
    pinningConflicts,
    assets: assetPerformance,
  };
}

/**
 * Server Action for generating a lightweight asset performance report
 */
export async function getAssetPerformanceReportAction(
  adAccountId: number,
  campaignId?: string,
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  try {
    const data = await getAssetPerformanceReportInternal(
      adAccountId,
      campaignId,
    );
    return { success: true as const, data };
  } catch (error: any) {
    console.error("[getAssetPerformanceReportAction Error]:", error);
    return { success: false as const, error: error.message };
  }
}
