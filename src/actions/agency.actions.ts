"use server";

import { GoogleGenAI } from "@google/genai";
import { and, eq, gte, ilike, lte } from "drizzle-orm";
import { getDashboardMetricsAction } from "@/actions/dashboard.actions";
import { db } from "@/db";
import {
  adAccounts,
  adPerformanceDaily,
  agencyAiInsightsCache,
} from "@/db/schema";
import {
  getCurrentPeriodDateClause,
  getManagementAccessToken,
  getPreviousPeriodDateClause,
} from "@/lib/google-ads";

const DEVELOPER_TOKEN = process.env.GOOGLE_ADS_DEVELOPER_TOKEN!;
const MANAGER_ID = process.env.GOOGLE_ADS_MANAGER_ID!;
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

// Bulletproof number parser
function parseDataNumber(val: any): number {
  if (val === undefined || val === null) return 0;
  if (typeof val === "number") return val;
  const cleaned = String(val).replace(/[^0-9.-]+/g, "");
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

// Deeply searches any object to find the array of data
function extractArrayDeep(obj: any): any[] {
  if (!obj) return [];
  if (Array.isArray(obj)) return obj;
  if (typeof obj === "object") {
    for (const key in obj) {
      const result = extractArrayDeep(obj[key]);
      if (result.length > 0) return result;
    }
  }
  return [];
}

/**
 * PORTFOLIO GOD-VIEW ENGINE
 */
export async function getOrGenerateAgencyAiInsightsAction(
  startDate: string,
  endDate: string,
  portfolioData: any,
  forceRefresh: boolean = false,
) {
  // 1. Check Cache First
  if (!forceRefresh) {
    const cached = await db.query.agencyAiInsightsCache.findFirst({
      where: and(
        eq(agencyAiInsightsCache.startDate, startDate),
        eq(agencyAiInsightsCache.endDate, endDate),
      ),
    });

    if (cached) {
      return {
        success: true,
        data: cached.insights,
        generatedAt: cached.createdAt,
        isCached: true,
      };
    }
  }

  if (!portfolioData) {
    throw new Error("Portfolio data is required to generate new insights.");
  }

  // --- PRE-COMPUTATION ENGINE (Upgraded with Analyst Logic) ---
  const accountsArray = extractArrayDeep(portfolioData);
  let preCalculatedContext = "";

  try {
    const parsedAccounts = accountsArray
      .map((acc) => {
        if (typeof acc !== "object" || !acc) return null;
        const keys = Object.keys(acc);

        const getVal = (terms: string[]) => {
          const foundKey = keys.find((k) =>
            terms.some((t) => k.toLowerCase().includes(t)),
          );
          return foundKey ? acc[foundKey] : undefined;
        };

        const name = getVal(["name", "client", "account"]) || "Unknown Account";
        const spend = parseDataNumber(getVal(["spend", "cost", "amount"]));
        const conversions = parseDataNumber(getVal(["conv"]));
        const targetCpa = parseDataNumber(
          getVal(["target", "goal", "expected"]),
        ); // Added Target CPA lookup
        const cpa = conversions > 0 ? spend / conversions : 0;

        return { name, spend, conversions, cpa, targetCpa };
      })
      .filter(Boolean) as any[];

    const activeAccounts = parsedAccounts.filter((a) => a.spend > 0);
    const validAccountsCount = activeAccounts.length;

    if (validAccountsCount > 0) {
      let totalSpend = 0;
      let totalConversions = 0;

      activeAccounts.forEach((a) => {
        totalSpend += a.spend;
        totalConversions += a.conversions;
      });

      const blendedCPA =
        totalConversions > 0 ? totalSpend / totalConversions : 0;

      // Isolate Whales & Calculate True Long-Tail Average
      const whales = activeAccounts.filter((a) => a.spend > totalSpend * 0.25);
      const whaleSpend = whales.reduce((sum, w) => sum + w.spend, 0);
      const whaleConversions = whales.reduce(
        (sum, w) => sum + w.conversions,
        0,
      );

      const nonWhaleSpend = totalSpend - whaleSpend;
      const nonWhaleConversions = totalConversions - whaleConversions;
      const nonWhaleCPA =
        nonWhaleConversions > 0 ? nonWhaleSpend / nonWhaleConversions : 0;

      const formattedWhales = whales.map((w) => ({
        name: w.name,
        spend_share: ((w.spend / totalSpend) * 100).toFixed(1) + "%",
      }));

      // Upgraded Bleed Index: Uses Target CPA if available, otherwise falls back to Non-Whale CPA
      const criticalFires = activeAccounts
        .filter(
          (a) =>
            a.spend > 200 &&
            (a.conversions === 0 ||
              a.cpa >
                (a.targetCpa > 0 ? a.targetCpa * 1.5 : nonWhaleCPA * 1.5)),
        )
        .map((a) => {
          const evaluationBaseline =
            a.targetCpa > 0 ? a.targetCpa : nonWhaleCPA;
          const relativeMultiplier =
            evaluationBaseline > 0 ? a.cpa / evaluationBaseline : 1;
          const bleedScore =
            a.conversions === 0 ? a.spend * 2 : a.spend * relativeMultiplier;

          return { ...a, bleedScore, evaluationBaseline };
        })
        .sort((a, b) => b.bleedScore - a.bleedScore)
        .map((a) => ({
          name: a.name,
          spend: a.spend,
          cpa: a.cpa,
          baseline_used:
            a.targetCpa > 0
              ? `Target CPA: $${a.targetCpa}`
              : `Non-Whale Avg: $${nonWhaleCPA.toFixed(2)}`,
        }));

      preCalculatedContext = `
            --- PRE-CALCULATED GROUND TRUTH (USE THESE EXACT FIGURES) ---
            - Total Active Accounts: ${validAccountsCount}
            - Overall Portfolio Blended CPA: $${blendedCPA.toFixed(2)}
            - NON-WHALE PORTFOLIO CPA (The true long-tail average): $${nonWhaleCPA.toFixed(2)}
            - Whale Accounts Identified (>25% spend): ${whales.length > 0 ? JSON.stringify(formattedWhales) : "None"}
            - Top Mathematical Cash Bleeders: ${JSON.stringify(criticalFires.slice(0, 5))}
            -------------------------------------------------------------
            `;
    }
  } catch (e) {
    console.warn("Silent fallback: Using base prompt only.");
  }
  // --------------------------------

  // 2. Exact Working Prompt Construction (With updated Blended Efficiency instructions)
  const prompt = `
    You are the Strategy Director for an elite Performance Marketing Agency. Analyze this agency-wide portfolio data.

    PORTFOLIO DATA: ${JSON.stringify(portfolioData)}
    ${preCalculatedContext}

    Your primary job is to protect agency retention by identifying "Critical Fires"—accounts that are actively bleeding money and at high risk of churning. You must also identify true growth opportunities.

    CRITICAL FIRE LOGIC & CONSTRAINTS (READ CAREFULLY):
    1. IGNORE THE GRAVEYARD: Completely ignore accounts with $0 spend and 0 impressions. Do not list them. Assume they are paused or legacy accounts.
    2. THE MONEY FURNACE: Flag accounts that have significant spend but zero conversions, or a CPA that is astronomically higher (e.g., 3x+) than the blended agency average.
    3. PREVENT FALSE POSITIVES: DO NOT flag an account for a low CTR (e.g., < 3%) IF it is driving strong conversion volume at a healthy CPA. For example, if a top spender has a 2.9% CTR but drives 50%+ of agency conversions, THAT IS A SUCCESS, not a fire. CPA and Volume always trump CTR.
    4. WHALE AWARENESS: Identify if the agency is overly reliant on 1 or 2 "Whale" accounts. If a Whale is failing, mark severity as "Critical". If a Whale is succeeding, protect it.

    OUTPUT FORMAT (Strict JSON):
    {
      "macro_summary": "3-sentence high-level summary. Explicitly call out if the agency portfolio is dangerously top-heavy (reliant on a single whale account) and mention the total active (non-zero) accounts.",
      "blended_efficiency": "Analysis of the blended agency CPA. You MUST contrast the 'Overall Portfolio Blended CPA' against the 'NON-WHALE PORTFOLIO CPA'. Explain how the whale is masking the true average of the long-tail accounts.",
      "critical_fires": [
        {
          "account_name": "Name of the failing account",
          "severity": "High/Critical",
          "the_problem": "Data-backed explanation of the exact failure (e.g., 'Spent $1,584 for a single lead, resulting in a CPA 12x the agency average.').",
          "recommended_action": "What the account manager must do IMMEDIATELY to stop the cash bleed and save the relationship."
        }
      ],
      "growth_opportunities": [
        {
          "account_name": "Name of an over-performing account (Strong conversions, excellent CPA)",
          "reasoning": "Data-backed reason why this specific client is highly profitable and should be pitched for a budget increase."
        }
      ]
    }

    CONSTRAINTS:
    - Base all analysis strictly on the provided JSON figures.
    - Use the PRE-CALCULATED GROUND TRUTH explicitly if it is provided above.
    - If there are no genuine critical fires matching the criteria above, return an empty array [].
    `;

  // 3. Resilient API Call
  let response;
  let retries = 3;

  while (retries > 0) {
    try {
      response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: { responseMimeType: "application/json" },
      });
      break;
    } catch (error: any) {
      retries -= 1;
      console.warn(`Gemini API connection failed. Retries left: ${retries}.`);
      if (retries === 0) {
        throw new Error(
          "Failed to generate portfolio insights due to network timeout.",
        );
      }
      await new Promise((res) => setTimeout(res, 2000));
    }
  }

  try {
    const parsedInsights = JSON.parse(response!.text as string);

    const [upserted] = await db
      .insert(agencyAiInsightsCache)
      .values({
        startDate,
        endDate,
        insights: parsedInsights,
        createdAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [
          agencyAiInsightsCache.startDate,
          agencyAiInsightsCache.endDate,
        ],
        set: {
          insights: parsedInsights,
          createdAt: new Date(),
        },
      })
      .returning({ createdAt: agencyAiInsightsCache.createdAt });

    return {
      success: true,
      data: parsedInsights,
      generatedAt: upserted.createdAt,
      isCached: false,
    };
  } catch (error) {
    console.error("Agency AI Insights Parsing/DB Error:", error);
    throw new Error("Failed to process portfolio insights.");
  }
}

export async function getAgencyPortfolioMetricsAction(
  startDate: string,
  endDate: string,
) {
  try {
    // 1. Get all active accounts
    const activeAccounts = await db.query.adAccounts.findMany({
      where: eq(adAccounts.isActive, true),
    });

    const accountIds = activeAccounts.map((a) => a.id);
    if (accountIds.length === 0) return { success: true, data: null };

    // 2. Fetch all performance data for these accounts in the date range
    const allPerformance = await db.query.adPerformanceDaily.findMany({
      where: and(
        gte(adPerformanceDaily.date, startDate),
        lte(adPerformanceDaily.date, endDate),
      ),
    });

    // 3. Aggregate Agency Totals
    let totalSpend = 0;
    let totalClicks = 0;
    let totalImpressions = 0;
    let totalConversions = 0;

    // 4. Map account breakdown
    const accountBreakdownMap: Record<number, any> = {};
    activeAccounts.forEach((acc) => {
      accountBreakdownMap[acc.id] = {
        accountId: acc.id,
        name: acc.name,
        googleAccountId: acc.googleAccountId,
        spend: 0,
        clicks: 0,
        impressions: 0,
        conversions: 0,
      };
    });

    allPerformance.forEach((row) => {
      const spend = Number(row.spend || 0);
      const clicks = Number(row.clicks || 0);
      const impressions = Number(row.impressions || 0);
      const conversions = Number(row.conversions || 0);

      // Add to totals
      totalSpend += spend;
      totalClicks += clicks;
      totalImpressions += impressions;
      totalConversions += conversions;

      // Add to account breakdown
      if (accountBreakdownMap[row.adAccountId]) {
        accountBreakdownMap[row.adAccountId].spend += spend;
        accountBreakdownMap[row.adAccountId].clicks += clicks;
        accountBreakdownMap[row.adAccountId].impressions += impressions;
        accountBreakdownMap[row.adAccountId].conversions += conversions;
      }
    });

    // 5. Format Breakdown & Calculate derived metrics (CPA, CTR)
    const accountBreakdown = Object.values(accountBreakdownMap)
      .map((acc) => ({
        ...acc,
        cpa: acc.conversions > 0 ? acc.spend / acc.conversions : 0,
        ctr: acc.impressions > 0 ? (acc.clicks / acc.impressions) * 100 : 0,
        cpc: acc.clicks > 0 ? acc.spend / acc.clicks : 0,
      }))
      .sort((a, b) => b.spend - a.spend); // Sort by highest spend

    return {
      success: true,
      data: {
        agencyTotals: {
          activeAccountsCount: activeAccounts.length,
          spend: totalSpend,
          clicks: totalClicks,
          impressions: totalImpressions,
          conversions: totalConversions,
          cpa: totalConversions > 0 ? totalSpend / totalConversions : 0,
          ctr:
            totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0,
          cpc: totalClicks > 0 ? totalSpend / totalClicks : 0,
        },
        accountBreakdown,
      },
    };
  } catch (error: any) {
    console.error("Failed to fetch agency portfolio:", error);
    return { success: false, error: error.message };
  }
}

export async function syncAgencyPortfolioAction(
  startDate: string,
  endDate: string,
) {
  try {
    // 1. Get all active accounts
    const activeAccounts = await db.query.adAccounts.findMany({
      where: eq(adAccounts.isActive, true),
    });

    if (activeAccounts.length === 0) return { success: true, syncedCount: 0 };

    // 2. Loop through and trigger the JIT sync for each account.
    // We use a `for...of` loop instead of `Promise.all` to avoid hitting
    // Google Ads API rate limits by sending 50 concurrent requests.
    let syncedCount = 0;
    for (const account of activeAccounts) {
      try {
        // By calling this, we force your existing JIT sync to run for this account
        await getDashboardMetricsAction(
          account.id,
          account.googleAccountId,
          startDate,
          endDate,
        );
        syncedCount++;
      } catch (err) {
        console.error(`Failed to sync account ${account.name}:`, err);
        // Continue to the next account even if one fails
      }
    }

    return { success: true, syncedCount };
  } catch (error: any) {
    console.error("Failed to sync agency portfolio:", error);
    return { success: false, error: error.message };
  }
}

export async function getAccountByNameAction(name: string) {
  try {
    const results = await db.query.adAccounts.findMany({
      where: ilike(adAccounts.name, `%${name}%`),
      columns: {
        id: true,
        name: true,
        googleAccountId: true,
        currencyCode: true,
        isActive: true,
      },
    });

    if (results.length === 0) {
      return { success: false, error: `No accounts found matching "${name}".` };
    }

    return { success: true, data: results };
  } catch (error) {
    console.error("getAccountByNameAction error:", error);
    return { success: false, error: "Failed to look up account by name." };
  }
}

export async function getAccountByIdAction(id: number) {
  try {
    const account = await db.query.adAccounts.findFirst({
      where: eq(adAccounts.id, id),
      columns: {
        id: true,
        name: true,
        googleAccountId: true,
        currencyCode: true,
        isActive: true,
      },
    });

    if (!account) {
      return { success: false, error: `No account found with ID ${id}.` };
    }

    return { success: true, data: account };
  } catch (error) {
    console.error("getAccountByIdAction error:", error);
    return { success: false, error: "Failed to look up account by ID." };
  }
}

// ---------------------------------------------------------------------------
// HELPER: shared Google Ads POST fetch
// ---------------------------------------------------------------------------
async function gaqlFetch(googleAccountId: string, query: string) {
  const accessToken = await getManagementAccessToken();
  const sanitizedId = googleAccountId.replace(/-/g, "");

  const response = await fetch(
    `https://googleads.googleapis.com/v23/customers/${sanitizedId}/googleAds:search`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "developer-token": DEVELOPER_TOKEN,
        Authorization: `Bearer ${accessToken}`,
        "login-customer-id": MANAGER_ID,
      },
      body: JSON.stringify({ query }),
    },
  );

  const data = await response.json();
  if (data.error) throw new Error(`GAQL Error: ${data.error.message}`);
  return data.results || [];
}

// ---------------------------------------------------------------------------
// 1. list_accounts
//    Simple: all accounts from our DB with active status.
//    Reuses: adAccounts schema. No Google Ads call needed.
// ---------------------------------------------------------------------------
export async function listAccountsAction() {
  try {
    const accounts = await db.query.adAccounts.findMany({
      columns: {
        id: true,
        name: true,
        googleAccountId: true,
        currencyCode: true,
        isActive: true,
      },
      orderBy: (adAccounts, { asc }) => [asc(adAccounts.name)],
    });

    return { success: true, data: accounts };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// ---------------------------------------------------------------------------
// 2. get_historical_comparison
//    Reuses: getDashboardMetricsAction (current period) +
//            getPreviousPeriodDateClause (already calculates equal-length prior period).
//    New:    Wraps both calls together and computes deltas.
// ---------------------------------------------------------------------------
export async function getHistoricalComparisonAction(
  accountId: number,
  startDate: string,
  endDate: string,
) {
  try {
    const account = await db.query.adAccounts.findFirst({
      where: eq(adAccounts.id, accountId),
    });

    if (!account) {
      return {
        success: false,
        error: `No account found with ID ${accountId}.`,
      };
    }

    // Current period — reuse existing action
    const currentRes = await getDashboardMetricsAction(
      account.id,
      account.googleAccountId,
      startDate,
      endDate,
    );

    if (!currentRes.success || !currentRes.data) {
      return {
        success: false,
        error: "Failed to fetch current period metrics.",
      };
    }

    // Previous period — derive dates using the existing helper, then fetch
    const prevDateClause = getPreviousPeriodDateClause(startDate, endDate);

    // Parse the previous period dates back out of the clause string
    // Format: "segments.date BETWEEN 'YYYY-MM-DD' AND 'YYYY-MM-DD'"
    const dateMatches = prevDateClause.match(/\d{4}-\d{2}-\d{2}/g);
    const prevStart = dateMatches?.[0];
    const prevEnd = dateMatches?.[1];

    if (!prevStart || !prevEnd) {
      return {
        success: false,
        error: "Could not calculate previous period dates.",
      };
    }

    const previousRes = await getDashboardMetricsAction(
      account.id,
      account.googleAccountId,
      prevStart,
      prevEnd,
    );

    const current = currentRes.data.totals;
    const previous = previousRes.success ? previousRes.data?.totals : null;

    // Compute deltas — safe divide
    const delta = (curr: number, prev: number | undefined) => {
      if (!prev || prev === 0) return null;
      return parseFloat((((curr - prev) / prev) * 100).toFixed(2));
    };

    return {
      success: true,
      data: {
        account: {
          id: account.id,
          name: account.name,
          currencyCode: account.currencyCode,
        },
        periods: {
          current: { startDate, endDate, metrics: current },
          previous: previous
            ? { startDate: prevStart, endDate: prevEnd, metrics: previous }
            : null,
        },
        deltas: previous
          ? {
              spend_pct: delta(current.spend, previous.spend),
              clicks_pct: delta(current.clicks, previous.clicks),
              impressions_pct: delta(current.impressions, previous.impressions),
              conversions_pct: delta(current.conversions, previous.conversions),
              cpa_pct: delta(current.cpa, previous.cpa),
              ctr_pct: delta(current.ctr, previous.ctr),
              convRate_pct: delta(current.convRate, previous.convRate),
            }
          : null,
      },
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// ---------------------------------------------------------------------------
// 3. get_search_term_insights
//    Reuses: fetchAccountKeywords pattern + fetchTopNonBrandedSearchTerm pattern.
//    New:    Returns a proper ranked list (not just top 1) with conv metrics.
//            Segments into converting vs non-converting terms.
// ---------------------------------------------------------------------------
export async function getSearchTermInsightsAction(
  accountId: number,
  startDate: string,
  endDate: string,
  limit: number = 20,
) {
  try {
    const account = await db.query.adAccounts.findFirst({
      where: eq(adAccounts.id, accountId),
    });

    if (!account) {
      return {
        success: false,
        error: `No account found with ID ${accountId}.`,
      };
    }

    const dateClause = getCurrentPeriodDateClause(startDate, endDate);

    // Reuses the same GAQL pattern as fetchTopNonBrandedSearchTerm but returns full list
    const query = `
            SELECT
                search_term_view.search_term,
                search_term_view.status,
                campaign.name,
                ad_group.name,
                metrics.cost_micros,
                metrics.clicks,
                metrics.impressions,
                metrics.conversions,
                metrics.ctr
            FROM search_term_view
            WHERE ${dateClause}
            ORDER BY metrics.cost_micros DESC
            LIMIT ${Math.min(limit, 50)}
        `;

    const results = await gaqlFetch(account.googleAccountId, query);

    const terms = results.map((row: any) => {
      const spend = (row.metrics?.costMicros || 0) / 1_000_000;
      const conversions = row.metrics?.conversions || 0;
      return {
        search_term: row.searchTermView?.searchTerm,
        status: row.searchTermView?.status,
        campaign: row.campaign?.name,
        ad_group: row.adGroup?.name,
        spend: parseFloat(spend.toFixed(2)),
        clicks: row.metrics?.clicks || 0,
        impressions: row.metrics?.impressions || 0,
        conversions: parseFloat(conversions.toFixed(2)),
        cpa:
          conversions > 0 ? parseFloat((spend / conversions).toFixed(2)) : null,
        ctr: parseFloat(((row.metrics?.ctr || 0) * 100).toFixed(2)),
      };
    });

    // Segment into wasted spend vs converting
    const converting = terms.filter((t: any) => t.conversions > 0);
    const wasted = terms.filter((t: any) => t.conversions === 0 && t.spend > 0);

    const totalSpend = terms.reduce((s: number, t: any) => s + t.spend, 0);
    const wastedSpend = wasted.reduce((s: number, t: any) => s + t.spend, 0);

    return {
      success: true,
      data: {
        account: { id: account.id, name: account.name },
        period: { startDate, endDate },
        summary: {
          total_terms_analysed: terms.length,
          wasted_spend: parseFloat(wastedSpend.toFixed(2)),
          wasted_spend_pct:
            totalSpend > 0
              ? parseFloat(((wastedSpend / totalSpend) * 100).toFixed(1))
              : 0,
        },
        converting_terms: converting,
        wasted_spend_terms: wasted,
      },
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// ---------------------------------------------------------------------------
// 4. get_campaign_details
//    New GAQL query — campaign settings not fetched anywhere in existing code.
//    Returns bidding strategy, status, budget, geo targets per campaign.
// ---------------------------------------------------------------------------
export async function getCampaignDetailsAction(accountId: number) {
  try {
    const account = await db.query.adAccounts.findFirst({
      where: eq(adAccounts.id, accountId),
    });

    if (!account) {
      return {
        success: false,
        error: `No account found with ID ${accountId}.`,
      };
    }

    // Campaign settings query — no date segment needed, these are configuration fields
    const campaignQuery = `
            SELECT
                campaign.id,
                campaign.name,
                campaign.status,
                campaign.advertising_channel_type,
                campaign.bidding_strategy_type,
                campaign.target_cpa.target_cpa_micros,
                campaign.target_roas.target_roas,
                campaign.maximize_conversions.target_cpa_micros,
                campaign_budget.amount_micros,
                campaign_budget.delivery_method,
                campaign.start_date,
                campaign.end_date
            FROM campaign
            WHERE campaign.status != 'REMOVED'
            ORDER BY campaign.name
        `;

    // Geo targets are a separate resource — join via campaign_criterion
    const geoQuery = `
            SELECT
                campaign.id,
                campaign.name,
                campaign_criterion.location.geo_target_constant,
                campaign_criterion.bid_modifier,
                campaign_criterion.negative
            FROM campaign_criterion
            WHERE campaign_criterion.type = 'LOCATION'
              AND campaign.status != 'REMOVED'
            LIMIT 200
        `;

    const [campaignResults, geoResults] = await Promise.all([
      gaqlFetch(account.googleAccountId, campaignQuery),
      gaqlFetch(account.googleAccountId, geoQuery),
    ]);

    // Build geo map by campaign ID
    const geoMap: Record<string, any[]> = {};
    for (const row of geoResults) {
      const id = row.campaign?.id;
      if (!id) continue;
      if (!geoMap[id]) geoMap[id] = [];
      geoMap[id].push({
        geo_target: row.campaignCriterion?.location?.geoTargetConstant,
        negative: row.campaignCriterion?.negative || false,
        bid_modifier: row.campaignCriterion?.bidModifier || 1,
      });
    }

    const campaigns = campaignResults.map((row: any) => {
      const budgetMicros = row.campaignBudget?.amountMicros || 0;
      const targetCpaMicros =
        row.campaign?.targetCpa?.targetCpaMicros ||
        row.campaign?.maximizeConversions?.targetCpaMicros ||
        0;

      return {
        id: row.campaign?.id,
        name: row.campaign?.name,
        status: row.campaign?.status,
        channel_type: row.campaign?.advertisingChannelType,
        bidding_strategy: row.campaign?.biddingStrategyType,
        daily_budget: parseFloat((budgetMicros / 1_000_000).toFixed(2)),
        budget_delivery: row.campaignBudget?.deliveryMethod,
        target_cpa:
          targetCpaMicros > 0
            ? parseFloat((targetCpaMicros / 1_000_000).toFixed(2))
            : null,
        target_roas: row.campaign?.targetRoas?.targetRoas || null,
        start_date: row.campaign?.startDate || null,
        end_date: row.campaign?.endDate || null,
        geo_targets: geoMap[row.campaign?.id] || [],
      };
    });

    return {
      success: true,
      data: {
        account: { id: account.id, name: account.name },
        campaigns,
      },
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// ---------------------------------------------------------------------------
// 5. get_account_anomalies
//    New logic — compares recent performance against account's own rolling
//    baseline from adPerformanceDaily. Makes "critical fires" account-specific
//    rather than portfolio-average-relative.
//
//    Reuses: adPerformanceDaily DB table (already populated by existing sync).
// ---------------------------------------------------------------------------
export async function getAccountAnomaliesAction(
  accountId: number,
  lookbackDays: number = 30, // baseline window
) {
  try {
    const account = await db.query.adAccounts.findFirst({
      where: eq(adAccounts.id, accountId),
    });

    if (!account) {
      return {
        success: false,
        error: `No account found with ID ${accountId}.`,
      };
    }

    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];

    // Recent window: last 7 days
    const recentStart = new Date(today);
    recentStart.setUTCDate(recentStart.getUTCDate() - 7);
    const recentStartStr = recentStart.toISOString().split("T")[0];

    // Baseline window: lookbackDays prior to the recent window
    const baselineEnd = new Date(recentStart);
    baselineEnd.setUTCDate(baselineEnd.getUTCDate() - 1);
    const baselineStart = new Date(baselineEnd);
    baselineStart.setUTCDate(baselineStart.getUTCDate() - lookbackDays);

    const baselineStartStr = baselineStart.toISOString().split("T")[0];
    const baselineEndStr = baselineEnd.toISOString().split("T")[0];

    // Pull both windows from our local DB — no Google Ads API call needed
    const [recentRows, baselineRows] = await Promise.all([
      db.query.adPerformanceDaily.findMany({
        where: and(
          eq((adPerformanceDaily as any).adAccountId, accountId),
          gte(adPerformanceDaily.date, recentStartStr),
          lte(adPerformanceDaily.date, todayStr),
        ),
      }),
      db.query.adPerformanceDaily.findMany({
        where: and(
          eq((adPerformanceDaily as any).adAccountId, accountId),
          gte(adPerformanceDaily.date, baselineStartStr),
          lte(adPerformanceDaily.date, baselineEndStr),
        ),
      }),
    ]);

    if (baselineRows.length === 0) {
      return {
        success: true,
        data: {
          account: { id: account.id, name: account.name },
          message:
            "Insufficient historical data to compute anomalies. Need at least one full prior period in adPerformanceDaily.",
          anomalies: [],
        },
      };
    }

    // Aggregate helpers
    const aggregate = (rows: any[]) => {
      const totalSpend = rows.reduce((s, r) => s + Number(r.spend || 0), 0);
      const totalConversions = rows.reduce(
        (s, r) => s + Number(r.conversions || 0),
        0,
      );
      const totalClicks = rows.reduce((s, r) => s + Number(r.clicks || 0), 0);
      const totalImpressions = rows.reduce(
        (s, r) => s + Number(r.impressions || 0),
        0,
      );
      const days = rows.length || 1;
      return {
        daily_avg_spend: totalSpend / days,
        daily_avg_conversions: totalConversions / days,
        daily_avg_clicks: totalClicks / days,
        cpa: totalConversions > 0 ? totalSpend / totalConversions : 0,
        ctr: totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0,
      };
    };

    const recent = aggregate(recentRows);
    const baseline = aggregate(baselineRows);

    // Detect anomalies: flag if metric deviates > threshold from baseline
    const anomalies: any[] = [];

    const check = (
      metric: string,
      recentVal: number,
      baselineVal: number,
      threshold: number,
      higherIsBad: boolean,
    ) => {
      if (baselineVal === 0) return;
      const changePct = ((recentVal - baselineVal) / baselineVal) * 100;
      const isBad = higherIsBad
        ? changePct > threshold
        : changePct < -threshold;
      if (Math.abs(changePct) > threshold) {
        anomalies.push({
          metric,
          recent_value: parseFloat(recentVal.toFixed(2)),
          baseline_value: parseFloat(baselineVal.toFixed(2)),
          change_pct: parseFloat(changePct.toFixed(1)),
          severity: Math.abs(changePct) > threshold * 2 ? "High" : "Medium",
          direction: changePct > 0 ? "increase" : "decrease",
          is_negative: isBad,
        });
      }
    };

    check(
      "daily_avg_spend",
      recent.daily_avg_spend,
      baseline.daily_avg_spend,
      30,
      false,
    );
    check(
      "daily_avg_conversions",
      recent.daily_avg_conversions,
      baseline.daily_avg_conversions,
      25,
      false,
    ); // decrease is bad
    check("cpa", recent.cpa, baseline.cpa, 30, true); // increase is bad
    check("ctr", recent.ctr, baseline.ctr, 25, false);

    return {
      success: true,
      data: {
        account: { id: account.id, name: account.name },
        windows: {
          recent: {
            startDate: recentStartStr,
            endDate: todayStr,
            metrics: recent,
          },
          baseline: {
            startDate: baselineStartStr,
            endDate: baselineEndStr,
            metrics: baseline,
          },
        },
        anomalies: anomalies.sort(
          (a, b) => Math.abs(b.change_pct) - Math.abs(a.change_pct),
        ),
      },
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// ---------------------------------------------------------------------------
// 6. get_concentration_report
//    Extracts the whale logic already written inline in agency.actions.ts
//    (getOrGenerateAgencyAiInsightsAction pre-computation block) into a
//    standalone, queryable action with trend support.
//
//    Reuses: getAgencyPortfolioMetricsAction for current + prior period data.
// ---------------------------------------------------------------------------
export async function getConcentrationReportAction(
  startDate: string,
  endDate: string,
) {
  try {
    // Current period
    const currentRes = await getAgencyPortfolioMetricsAction(
      startDate,
      endDate,
    );
    if (!currentRes.success || !currentRes.data) {
      return { success: false, error: "Failed to fetch portfolio data." };
    }

    // Previous period — reuse existing helper
    const prevDateClause = getPreviousPeriodDateClause(startDate, endDate);
    const dateMatches = prevDateClause.match(/\d{4}-\d{2}-\d{2}/g);
    const prevStart = dateMatches?.[0];
    const prevEnd = dateMatches?.[1];

    const previousRes =
      prevStart && prevEnd
        ? await getAgencyPortfolioMetricsAction(prevStart, prevEnd)
        : null;

    // Compute concentration for a given period's accountBreakdown
    const computeConcentration = (breakdown: any[], totalSpend: number) => {
      if (totalSpend === 0) return { hhi: 0, whales: [], top5_share_pct: 0 };

      // HHI: Herfindahl–Hirschman Index (0-10000). >2500 = highly concentrated.
      const hhi = breakdown.reduce((sum, acc) => {
        const share = (acc.spend / totalSpend) * 100;
        return sum + share * share;
      }, 0);

      const whales = breakdown
        .filter((acc) => acc.spend / totalSpend > 0.25)
        .map((acc) => ({
          id: acc.accountId,
          name: acc.name,
          spend: parseFloat(acc.spend.toFixed(2)),
          spend_share_pct: parseFloat(
            ((acc.spend / totalSpend) * 100).toFixed(1),
          ),
        }));

      const top5Spend = breakdown
        .slice(0, 5)
        .reduce((s, acc) => s + acc.spend, 0);

      return {
        hhi: parseFloat(hhi.toFixed(0)),
        hhi_interpretation:
          hhi > 2500
            ? "Highly Concentrated"
            : hhi > 1500
              ? "Moderately Concentrated"
              : "Diversified",
        whales,
        top5_share_pct: parseFloat(((top5Spend / totalSpend) * 100).toFixed(1)),
      };
    };

    const currentBreakdown = currentRes.data.accountBreakdown;
    const currentTotalSpend = currentRes.data.agencyTotals.spend;
    const currentConcentration = computeConcentration(
      currentBreakdown,
      currentTotalSpend,
    );

    let previousConcentration = null;
    if (previousRes?.success && previousRes.data) {
      previousConcentration = computeConcentration(
        previousRes.data.accountBreakdown,
        previousRes.data.agencyTotals.spend,
      );
    }

    // Revenue at risk: spend from whale accounts
    const revenueAtRisk = currentConcentration.whales.reduce(
      (s: number, w: any) => s + w.spend,
      0,
    );

    return {
      success: true,
      data: {
        period: { startDate, endDate },
        current: currentConcentration,
        previous: previousConcentration
          ? {
              period: { startDate: prevStart, endDate: prevEnd },
              ...previousConcentration,
            }
          : null,
        hhi_trend: previousConcentration
          ? parseFloat(
              (currentConcentration.hhi - previousConcentration.hhi).toFixed(0),
            )
          : null,
        revenue_at_risk: parseFloat(revenueAtRisk.toFixed(2)),
        active_accounts: currentRes.data.agencyTotals.activeAccountsCount,
      },
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// ---------------------------------------------------------------------------
// 7. get_account_targets
//    Reads target KPIs stored per account in the DB.
//    NOTE: This requires a `targetCpa` and `targetRoas` column on adAccounts.
//    See migration note at the bottom of this file.
// ---------------------------------------------------------------------------
export async function getAccountTargetsAction(accountId: number) {
  try {
    const account = await db.query.adAccounts.findFirst({
      where: eq(adAccounts.id, accountId),
    });

    if (!account) {
      return {
        success: false,
        error: `No account found with ID ${accountId}.`,
      };
    }

    // These fields need to exist on your adAccounts schema — see migration note below.
    const targets = {
      target_cpa: (account as any).targetCpa ?? null,
      target_roas: (account as any).targetRoas ?? null,
      monthly_budget_cap: (account as any).monthlyBudgetCap ?? null,
      notes: (account as any).targetNotes ?? null,
    };

    const hasTargets = Object.values(targets).some((v) => v !== null);

    return {
      success: true,
      data: {
        account: {
          id: account.id,
          name: account.name,
          currencyCode: account.currencyCode,
        },
        targets,
        warning: !hasTargets
          ? "No targets configured for this account. Add targetCpa / targetRoas to the adAccounts table to unlock target-relative analysis."
          : undefined,
      },
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
