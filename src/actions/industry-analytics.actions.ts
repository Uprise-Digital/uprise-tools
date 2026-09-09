"use server";

import { and, eq, gte, inArray, lte } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getMetaAccountsPerformanceAction } from "@/actions/meta-settings.actions";
import { db } from "@/db";
import { adAccounts, adPerformanceDaily, metaAdAccounts } from "@/db/schema";
import { unifyAccounts } from "@/lib/account-unification";
import { GEMINI_MODEL_LOW } from "@/lib/ai-config";
import { generateContentTracked } from "@/lib/ai-logger";
import { logAction } from "@/lib/audit";
import { getAuthOrgContext } from "@/lib/auth-helpers";
import {
  classifyAccountByRules,
  getIndustryMeta,
  INDUSTRY_KEYS,
  type IndustryKey,
} from "@/lib/industry-config";

export interface AccountIndustryMetric {
  key: string;
  accountId: number;
  name: string;
  googleAccountId?: string;
  googleStatus?: string;
  websiteUrl: string | null;
  industry: IndustryKey;
  subNiche: string | null;
  targetCpa: number;
  spend: number;
  clicks: number;
  impressions: number;
  conversions: number;
  cpa: number;
  cpc: number;
  ctr: number;
  conversionRate: number;
  cpaDeltaVsSector: number; // percentage difference vs industry benchmark (negative is better)
  peerRank: number;
  efficiencyStatus: "APEX" | "HEALTHY" | "LAGGING" | "INACTIVE";
  // Cross-platform additions
  platforms: ("google" | "meta")[];
  primaryPlatform: "google" | "meta";
  primaryId: number;
  googleId?: number;
  metaId?: number;
  metaAccountId?: string;
}

export interface IndustryGroupMetric {
  industry: IndustryKey;
  label: string;
  shortLabel: string;
  iconName: string;
  color: string;
  bgBadge: string;
  textBadge: string;
  borderBadge: string;
  subNiches: string[];
  description: string;
  accountsCount: number;
  activeAccountsCount: number;
  spend: number;
  clicks: number;
  impressions: number;
  conversions: number;
  blendedCpa: number;
  blendedCpc: number;
  blendedCtr: number;
  blendedConvRate: number;
  spendSharePct: number;
  conversionsSharePct: number;
  accounts: AccountIndustryMetric[];
}

export interface IndustryPortfolioData {
  agencyTotals: {
    totalAccounts: number;
    activeAccounts: number;
    totalSpend: number;
    totalConversions: number;
    totalClicks: number;
    totalImpressions: number;
    blendedCpa: number;
    blendedCpc: number;
    blendedCtr: number;
    blendedConvRate: number;
    activeIndustriesCount: number;
  };
  industryGroups: IndustryGroupMetric[];
  allAccounts: AccountIndustryMetric[];
}

/**
 * Fetch portfolio metrics aggregated by canonical industry and calculate peer benchmarks
 */
export async function getIndustryPortfolioMetricsAction(
  startDate: string,
  endDate: string,
  platformFilter: "all" | "google" | "meta" = "all",
): Promise<{ success: boolean; data?: IndustryPortfolioData; error?: string }> {
  try {
    const ctx = await getAuthOrgContext();
    const orgId = ctx?.orgId || null;

    if (!orgId) {
      return {
        success: false,
        error: "Unauthorized: Active organization context missing",
      };
    }

    // 1. Fetch all active Google accounts for the current organization
    let googleAccounts = await db.query.adAccounts.findMany({
      where: and(
        eq(adAccounts.isActive, true),
        eq(adAccounts.organizationId, orgId),
      ),
    });

    // Auto-classify check: If Google accounts are unclassified ('OTHER' or null), run auto-classification
    const unclassifiedAccounts = googleAccounts.filter(
      (a) => !a.industry || a.industry === "OTHER",
    );
    if (unclassifiedAccounts.length > 0) {
      try {
        await classifyAccountsBatchInternal(orgId, false);
        // Refresh accounts list after classification
        googleAccounts = await db.query.adAccounts.findMany({
          where: and(
            eq(adAccounts.isActive, true),
            eq(adAccounts.organizationId, orgId),
          ),
        });
      } catch (err) {
        console.warn("Auto-classification on load encountered an issue:", err);
      }
    }

    // 2. Fetch all active Meta accounts for the current organization
    const metaAccounts = await db.query.metaAdAccounts.findMany({
      where: and(
        eq(metaAdAccounts.isActive, true),
        eq(metaAdAccounts.organizationId, orgId),
      ),
    });

    if (googleAccounts.length === 0 && metaAccounts.length === 0) {
      return {
        success: true,
        data: {
          agencyTotals: {
            totalAccounts: 0,
            activeAccounts: 0,
            totalSpend: 0,
            totalConversions: 0,
            totalClicks: 0,
            totalImpressions: 0,
            blendedCpa: 0,
            blendedCpc: 0,
            blendedCtr: 0,
            blendedConvRate: 0,
            activeIndustriesCount: 0,
          },
          industryGroups: [],
          allAccounts: [],
        },
      };
    }

    // 3. Unify Google and Meta accounts
    const unifiedAccounts = unifyAccounts(googleAccounts, metaAccounts);
    const googleAccountsMap = new Map(googleAccounts.map((g) => [g.id, g]));
    const metaAccountsMap = new Map(metaAccounts.map((m) => [m.id, m]));

    // Filter unified accounts by active platform filter
    const filteredUnified = unifiedAccounts.filter((acc) => {
      if (platformFilter === "google") return acc.platforms.includes("google");
      if (platformFilter === "meta") return acc.platforms.includes("meta");
      return true;
    });

    if (filteredUnified.length === 0) {
      return {
        success: true,
        data: {
          agencyTotals: {
            totalAccounts: 0,
            activeAccounts: 0,
            totalSpend: 0,
            totalConversions: 0,
            totalClicks: 0,
            totalImpressions: 0,
            blendedCpa: 0,
            blendedCpc: 0,
            blendedCtr: 0,
            blendedConvRate: 0,
            activeIndustriesCount: 0,
          },
          industryGroups: [],
          allAccounts: [],
        },
      };
    }

    // 4. Fetch daily Google performance rows within range if needed
    const googleAccountIds = googleAccounts.map((a) => a.id);
    let performanceRows: (typeof adPerformanceDaily.$inferSelect)[] = [];
    if (googleAccountIds.length > 0 && platformFilter !== "meta") {
      performanceRows = await db.query.adPerformanceDaily.findMany({
        where: and(
          inArray(adPerformanceDaily.adAccountId, googleAccountIds),
          gte(adPerformanceDaily.date, startDate),
          lte(adPerformanceDaily.date, endDate),
        ),
      });
    }

    // Pre-aggregate Google metrics by adAccountId
    const googleMetricByAccId = new Map<
      number,
      {
        spend: number;
        clicks: number;
        impressions: number;
        conversions: number;
      }
    >();
    performanceRows.forEach((row) => {
      const cur = googleMetricByAccId.get(row.adAccountId) || {
        spend: 0,
        clicks: 0,
        impressions: 0,
        conversions: 0,
      };
      cur.spend += Number(row.spend || 0);
      cur.clicks += Number(row.clicks || 0);
      cur.impressions += Number(row.impressions || 0);
      cur.conversions += Number(row.conversions || 0);
      googleMetricByAccId.set(row.adAccountId, cur);
    });

    // 5. Fetch Meta live performance metrics if needed
    const metaPerformanceMap = new Map<
      string,
      {
        spend: number;
        clicks: number;
        impressions: number;
        conversions: number;
      }
    >();
    if (metaAccounts.length > 0 && platformFilter !== "google") {
      try {
        const metaRes = await getMetaAccountsPerformanceAction(
          startDate,
          endDate,
        );
        if (metaRes.success && metaRes.breakdown) {
          for (const item of metaRes.breakdown) {
            metaPerformanceMap.set(String(item.metaAccountId), {
              spend: Number(item.spend || 0),
              clicks: Number(item.clicks || 0),
              impressions: Number(item.impressions || 0),
              conversions: Number(item.conversions || 0),
            });
          }
        }
      } catch (err) {
        console.warn(
          "Failed to fetch Meta performance in industry analytics:",
          err,
        );
      }
    }

    // 6. Build raw metrics per unified account
    const rawAccountList = filteredUnified.map((uAcc) => {
      const gMetrics =
        uAcc.googleId && platformFilter !== "meta"
          ? googleMetricByAccId.get(uAcc.googleId) || {
              spend: 0,
              clicks: 0,
              impressions: 0,
              conversions: 0,
            }
          : { spend: 0, clicks: 0, impressions: 0, conversions: 0 };

      const mMetrics =
        uAcc.metaAccountId && platformFilter !== "google"
          ? metaPerformanceMap.get(String(uAcc.metaAccountId)) || {
              spend: 0,
              clicks: 0,
              impressions: 0,
              conversions: 0,
            }
          : { spend: 0, clicks: 0, impressions: 0, conversions: 0 };

      const spend = gMetrics.spend + mMetrics.spend;
      const clicks = gMetrics.clicks + mMetrics.clicks;
      const impressions = gMetrics.impressions + mMetrics.impressions;
      const conversions = gMetrics.conversions + mMetrics.conversions;

      const rawInd = uAcc.industry as IndustryKey;
      const validIndustry: IndustryKey = INDUSTRY_KEYS.includes(rawInd)
        ? rawInd
        : "OTHER";

      const gAcc = uAcc.googleId
        ? googleAccountsMap.get(uAcc.googleId)
        : undefined;
      const mAcc = uAcc.metaId ? metaAccountsMap.get(uAcc.metaId) : undefined;

      const gTargetCpa = gAcc?.targetCpa ? parseFloat(gAcc.targetCpa) : 0;
      const mTargetCpa = mAcc?.targetCpa ? parseFloat(mAcc.targetCpa) : 0;
      const targetCpa =
        platformFilter === "meta"
          ? mTargetCpa
          : platformFilter === "google"
            ? gTargetCpa
            : gTargetCpa > 0
              ? gTargetCpa
              : mTargetCpa;

      return {
        key: uAcc.key,
        accountId: uAcc.googleId || uAcc.primaryId,
        name: uAcc.name,
        googleAccountId: uAcc.googleAccountId,
        googleStatus: uAcc.googleStatus,
        websiteUrl: gAcc?.websiteUrl || null,
        industry: validIndustry,
        subNiche: uAcc.subNiche || null,
        targetCpa,
        spend,
        clicks,
        impressions,
        conversions,
        platforms: uAcc.platforms,
        primaryPlatform: uAcc.primaryPlatform,
        primaryId: uAcc.primaryId,
        googleId: uAcc.googleId,
        metaId: uAcc.metaId,
        metaAccountId: uAcc.metaAccountId,
      };
    });

    // 7. Aggregate by Industry Group
    const industryMap: Record<
      IndustryKey,
      {
        spend: number;
        clicks: number;
        impressions: number;
        conversions: number;
        accountList: typeof rawAccountList;
      }
    > = {} as any;

    INDUSTRY_KEYS.forEach((key) => {
      industryMap[key] = {
        spend: 0,
        clicks: 0,
        impressions: 0,
        conversions: 0,
        accountList: [],
      };
    });

    let agencySpend = 0;
    let agencyConversions = 0;
    let agencyClicks = 0;
    let agencyImpressions = 0;

    rawAccountList.forEach((acc) => {
      agencySpend += acc.spend;
      agencyConversions += acc.conversions;
      agencyClicks += acc.clicks;
      agencyImpressions += acc.impressions;

      const group = industryMap[acc.industry] || industryMap.OTHER;
      group.spend += acc.spend;
      group.clicks += acc.clicks;
      group.impressions += acc.impressions;
      group.conversions += acc.conversions;
      group.accountList.push(acc);
    });

    // 8. Build Rich Industry Group Output with Peer Rankings
    const allEnrichedAccounts: AccountIndustryMetric[] = [];

    const industryGroups: IndustryGroupMetric[] = INDUSTRY_KEYS.map((key) => {
      const meta = getIndustryMeta(key);
      const groupData = industryMap[key];

      const industryCpa =
        groupData.conversions > 0 ? groupData.spend / groupData.conversions : 0;
      const industryCpc =
        groupData.clicks > 0 ? groupData.spend / groupData.clicks : 0;
      const industryCtr =
        groupData.impressions > 0
          ? (groupData.clicks / groupData.impressions) * 100
          : 0;
      const industryConvRate =
        groupData.clicks > 0
          ? (groupData.conversions / groupData.clicks) * 100
          : 0;

      // Sort accounts in this industry by spend desc
      const sortedRawAccounts = [...groupData.accountList].sort(
        (a, b) => b.spend - a.spend,
      );

      const enrichedAccounts: AccountIndustryMetric[] = sortedRawAccounts.map(
        (acc, idx) => {
          const accCpa = acc.conversions > 0 ? acc.spend / acc.conversions : 0;
          const accCpc = acc.clicks > 0 ? acc.spend / acc.clicks : 0;
          const accCtr =
            acc.impressions > 0 ? (acc.clicks / acc.impressions) * 100 : 0;
          const accConvRate =
            acc.clicks > 0 ? (acc.conversions / acc.clicks) * 100 : 0;

          // Efficiency delta vs sector baseline
          let cpaDeltaVsSector = 0;
          if (industryCpa > 0 && accCpa > 0) {
            cpaDeltaVsSector = ((accCpa - industryCpa) / industryCpa) * 100;
          }

          let efficiencyStatus: "APEX" | "HEALTHY" | "LAGGING" | "INACTIVE" =
            "HEALTHY";
          if (acc.spend === 0) {
            efficiencyStatus = "INACTIVE";
          } else if (
            (acc.spend > 100 && acc.conversions === 0) ||
            (industryCpa > 0 && accCpa > industryCpa * 1.3)
          ) {
            efficiencyStatus = "LAGGING";
          } else if (
            industryCpa > 0 &&
            accCpa > 0 &&
            accCpa <= industryCpa * 0.8 &&
            acc.conversions >= 3
          ) {
            efficiencyStatus = "APEX";
          }

          const accountMetric: AccountIndustryMetric = {
            ...acc,
            cpa: accCpa,
            cpc: accCpc,
            ctr: accCtr,
            conversionRate: accConvRate,
            cpaDeltaVsSector,
            peerRank: idx + 1,
            efficiencyStatus,
          };

          allEnrichedAccounts.push(accountMetric);
          return accountMetric;
        },
      );

      const activeCount = enrichedAccounts.filter((a) => a.spend > 0).length;
      const spendShare =
        agencySpend > 0 ? (groupData.spend / agencySpend) * 100 : 0;
      const convShare =
        agencyConversions > 0
          ? (groupData.conversions / agencyConversions) * 100
          : 0;

      return {
        industry: key,
        label: meta.label,
        shortLabel: meta.shortLabel,
        iconName: meta.iconName,
        color: meta.color,
        bgBadge: meta.bgBadge,
        textBadge: meta.textBadge,
        borderBadge: meta.borderBadge,
        subNiches: meta.subNiches,
        description: meta.description,
        accountsCount: enrichedAccounts.length,
        activeAccountsCount: activeCount,
        spend: groupData.spend,
        clicks: groupData.clicks,
        impressions: groupData.impressions,
        conversions: groupData.conversions,
        blendedCpa: industryCpa,
        blendedCpc: industryCpc,
        blendedCtr: industryCtr,
        blendedConvRate: industryConvRate,
        spendSharePct: spendShare,
        conversionsSharePct: convShare,
        accounts: enrichedAccounts,
      };
    });

    // Filter and sort industry groups (active spend first, then by spend desc)
    const activeIndustryCount = industryGroups.filter(
      (g) => g.accountsCount > 0,
    ).length;
    const sortedIndustryGroups = industryGroups.sort(
      (a, b) => b.spend - a.spend || b.accountsCount - a.accountsCount,
    );

    const agencyTotals = {
      totalAccounts: filteredUnified.length,
      activeAccounts: allEnrichedAccounts.filter((a) => a.spend > 0).length,
      totalSpend: agencySpend,
      totalConversions: agencyConversions,
      totalClicks: agencyClicks,
      totalImpressions: agencyImpressions,
      blendedCpa: agencyConversions > 0 ? agencySpend / agencyConversions : 0,
      blendedCpc: agencyClicks > 0 ? agencySpend / agencyClicks : 0,
      blendedCtr:
        agencyImpressions > 0 ? (agencyClicks / agencyImpressions) * 100 : 0,
      blendedConvRate:
        agencyClicks > 0 ? (agencyConversions / agencyClicks) * 100 : 0,
      activeIndustriesCount: activeIndustryCount,
    };

    return {
      success: true,
      data: {
        agencyTotals,
        industryGroups: sortedIndustryGroups,
        allAccounts: allEnrichedAccounts,
      },
    };
  } catch (error: any) {
    console.error("getIndustryPortfolioMetricsAction error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Update an account's assigned industry and optional sub-niche
 */
export async function updateAccountIndustryAction(
  accountId: number,
  industry: IndustryKey,
  subNiche?: string | null,
) {
  try {
    const ctx = await getAuthOrgContext();
    if (!ctx) throw new Error("Unauthorized");
    const { session, orgId } = ctx;

    const account = await db.query.adAccounts.findFirst({
      where: and(
        eq(adAccounts.id, accountId),
        eq(adAccounts.organizationId, orgId),
      ),
    });

    if (!account) {
      throw new Error(`Account ID ${accountId} not found.`);
    }

    const validIndustry: IndustryKey = INDUSTRY_KEYS.includes(industry)
      ? industry
      : "OTHER";

    await db
      .update(adAccounts)
      .set({
        industry: validIndustry,
        subNiche: subNiche ? subNiche.trim() : null,
      })
      .where(eq(adAccounts.id, accountId));

    await logAction(
      session.user.id,
      "UPDATE_ACCOUNT_INDUSTRY",
      "ad_accounts",
      accountId,
      { industry: validIndustry, subNiche },
    );

    revalidatePath("/overview/industry");
    revalidatePath("/overview");
    revalidatePath("/accounts");
    revalidatePath(`/accounts/${accountId}`);

    return { success: true as const };
  } catch (error: any) {
    console.error("updateAccountIndustryAction error:", error);
    return { success: false as const, error: error.message };
  }
}

/**
 * Internal hybrid classifier combining rules and Gemini AI
 */
export async function classifyAccountsBatchInternal(
  orgId: string,
  forceAll: boolean = false,
): Promise<{ updatedCount: number; results: any[] }> {
  const accounts = await db.query.adAccounts.findMany({
    where: and(
      eq(adAccounts.isActive, true),
      eq(adAccounts.organizationId, orgId),
    ),
  });

  const accountsToClassify = forceAll
    ? accounts
    : accounts.filter((a) => !a.industry || a.industry === "OTHER");

  if (accountsToClassify.length === 0) {
    return { updatedCount: 0, results: [] };
  }

  // Fetch recent campaigns for context
  const recentCampaigns = await db.query.adPerformanceDaily.findMany({
    where: inArray(
      adPerformanceDaily.adAccountId,
      accountsToClassify.map((a) => a.id),
    ),
    limit: 150,
  });

  const campaignsByAccount: Record<number, string[]> = {};
  recentCampaigns.forEach((c) => {
    if (!campaignsByAccount[c.adAccountId]) {
      campaignsByAccount[c.adAccountId] = [];
    }
    if (!campaignsByAccount[c.adAccountId].includes(c.campaignName)) {
      campaignsByAccount[c.adAccountId].push(c.campaignName);
    }
  });

  const classifiedMap: Record<
    number,
    { industry: IndustryKey; subNiche: string | null }
  > = {};
  const unmatchedAccounts: Array<{
    accountId: number;
    name: string;
    websiteUrl: string;
    campaigns: string[];
  }> = [];

  // Phase 1: High-precision Rule Engine
  for (const acc of accountsToClassify) {
    const campaigns = campaignsByAccount[acc.id] || [];
    const ruleMatch = classifyAccountByRules(
      acc.name,
      acc.websiteUrl,
      campaigns,
    );

    if (ruleMatch) {
      classifiedMap[acc.id] = ruleMatch;
    } else {
      unmatchedAccounts.push({
        accountId: acc.id,
        name: acc.name,
        websiteUrl: acc.websiteUrl || "Not provided",
        campaigns: campaigns.slice(0, 5),
      });
    }
  }

  // Phase 2: Gemini AI Classification for nuanced/unmatched accounts
  if (unmatchedAccounts.length > 0) {
    try {
      const allowedIndustriesList = INDUSTRY_KEYS.map((k) => {
        const meta = getIndustryMeta(k);
        return `- ${k}: ${meta.label} (${meta.subNiches.join(", ")})`;
      }).join("\n");

      const prompt = `
You are an expert digital marketing analyst for an agency. Classify each of the following Google Ads accounts into ONE canonical industry key.

### ALLOWED CANONICAL INDUSTRY KEYS:
${allowedIndustriesList}

### ACCOUNTS TO CLASSIFY:
${JSON.stringify(unmatchedAccounts, null, 2)}

### INSTRUCTIONS:
1. Examine the account name, website URL, and campaign names.
2. Choose the BEST matching canonical industry key from the allowed list.
3. Provide a concise subNiche string (e.g. "Emergency Plumbing", "Family Law", "Dental & Ortho", "Solar Installation", "DTC Fashion", "Managed IT Services").
4. Return a strictly valid JSON array of objects with schema:
[
  {
    "accountId": 123,
    "industry": "HOME_SERVICES_TRADES",
    "subNiche": "Plumbing & Gas"
  }
]
`;

      const result = await generateContentTracked(
        {
          model: GEMINI_MODEL_LOW,
          contents: prompt,
          config: { responseMimeType: "application/json" },
        },
        {
          feature: "auto_classify_industries",
        },
      );

      const parsedResults: Array<{
        accountId: number;
        industry: string;
        subNiche: string;
      }> = JSON.parse(result.response.text || "[]");

      for (const item of parsedResults) {
        const validIndustry: IndustryKey = INDUSTRY_KEYS.includes(
          item.industry as IndustryKey,
        )
          ? (item.industry as IndustryKey)
          : "OTHER";

        classifiedMap[item.accountId] = {
          industry: validIndustry,
          subNiche: item.subNiche || null,
        };
      }
    } catch (err) {
      console.warn("AI classification error, relying on rule matches:", err);
    }
  }

  // Phase 3: Batch persist updates to DB
  let updatedCount = 0;
  for (const [accountIdStr, val] of Object.entries(classifiedMap)) {
    const accountId = parseInt(accountIdStr, 10);
    await db
      .update(adAccounts)
      .set({
        industry: val.industry,
        subNiche: val.subNiche,
      })
      .where(
        and(eq(adAccounts.id, accountId), eq(adAccounts.organizationId, orgId)),
      );
    updatedCount += 1;
  }

  return {
    updatedCount,
    results: Object.entries(classifiedMap).map(([id, val]) => ({
      accountId: Number(id),
      ...val,
    })),
  };
}

/**
 * AI Auto-Classification Engine (Action):
 * Batch-classifies unclassified accounts (or all accounts) into canonical industries.
 */
export async function autoClassifyAccountIndustriesAction(
  forceAll: boolean = false,
) {
  try {
    const ctx = await getAuthOrgContext();
    if (!ctx) throw new Error("Unauthorized");
    const { session, orgId } = ctx;

    const { updatedCount } = await classifyAccountsBatchInternal(
      orgId,
      forceAll,
    );

    await logAction(
      session.user.id,
      "AUTO_CLASSIFY_ACCOUNT_INDUSTRIES",
      "ad_accounts",
      0,
      { count: updatedCount, forceAll },
    );

    revalidatePath("/overview/industry");
    revalidatePath("/overview");
    revalidatePath("/accounts");

    return {
      success: true,
      message: `Successfully classified ${updatedCount} accounts.`,
      classifiedCount: updatedCount,
    };
  } catch (error: any) {
    console.error("autoClassifyAccountIndustriesAction error:", error);
    return { success: false, error: error.message };
  }
}
