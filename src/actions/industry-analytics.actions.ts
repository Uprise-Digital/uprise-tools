"use server";

import { and, eq, gte, inArray, lte } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { adAccounts, adPerformanceDaily, briefingSettings } from "@/db/schema";
import { GEMINI_MODEL_LOW } from "@/lib/ai-config";
import { generateContentTracked } from "@/lib/ai-logger";
import { logAction } from "@/lib/audit";
import { getAuthOrgContext } from "@/lib/auth-helpers";
import {
  type IndustryKey,
  INDUSTRY_KEYS,
  getIndustryMeta,
} from "@/lib/industry-config";

export interface AccountIndustryMetric {
  accountId: number;
  name: string;
  googleAccountId: string;
  googleStatus: string;
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

    // 1. Fetch all active accounts for the current organization
    const accounts = await db.query.adAccounts.findMany({
      where: and(
        eq(adAccounts.isActive, true),
        eq(adAccounts.organizationId, orgId),
      ),
    });

    if (accounts.length === 0) {
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

    const accountIds = accounts.map((a) => a.id);

    // 2. Fetch daily performance rows within range
    const performanceRows = await db.query.adPerformanceDaily.findMany({
      where: and(
        inArray(adPerformanceDaily.adAccountId, accountIds),
        gte(adPerformanceDaily.date, startDate),
        lte(adPerformanceDaily.date, endDate),
      ),
    });

    // 3. Check briefing settings for onlyActive filter
    const bSettings = await db.query.briefingSettings.findFirst({
      where: eq(briefingSettings.organizationId, orgId),
    });
    const onlyActiveAccounts = bSettings?.onlyActiveAccounts ?? true;

    // 4. Aggregate by Account
    const accountMetricMap: Record<
      number,
      {
        accountId: number;
        name: string;
        googleAccountId: string;
        googleStatus: string;
        websiteUrl: string | null;
        industry: IndustryKey;
        subNiche: string | null;
        targetCpa: number;
        spend: number;
        clicks: number;
        impressions: number;
        conversions: number;
      }
    > = {};

    accounts.forEach((acc) => {
      const rawInd = acc.industry as IndustryKey;
      const validIndustry: IndustryKey = INDUSTRY_KEYS.includes(rawInd)
        ? rawInd
        : "OTHER";

      accountMetricMap[acc.id] = {
        accountId: acc.id,
        name: acc.name,
        googleAccountId: acc.googleAccountId,
        googleStatus: acc.googleStatus,
        websiteUrl: acc.websiteUrl,
        industry: validIndustry,
        subNiche: acc.subNiche,
        targetCpa: acc.targetCpa ? parseFloat(acc.targetCpa) : 0,
        spend: 0,
        clicks: 0,
        impressions: 0,
        conversions: 0,
      };
    });

    performanceRows.forEach((row) => {
      const isAccountTracked = Boolean(accountMetricMap[row.adAccountId]);
      if (onlyActiveAccounts && !isAccountTracked) return;

      const accData = accountMetricMap[row.adAccountId];
      if (accData) {
        accData.spend += Number(row.spend || 0);
        accData.clicks += Number(row.clicks || 0);
        accData.impressions += Number(row.impressions || 0);
        accData.conversions += Number(row.conversions || 0);
      }
    });

    // 5. Aggregate by Industry Group
    const industryMap: Record<
      IndustryKey,
      {
        spend: number;
        clicks: number;
        impressions: number;
        conversions: number;
        accountList: any[];
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

    Object.values(accountMetricMap).forEach((acc) => {
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

    // 6. Build Rich Industry Group Output with Peer Rankings
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
      totalAccounts: accounts.length,
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
 * AI Auto-Classification Engine:
 * Batch-classifies unclassified accounts (or all accounts) into canonical industries.
 */
export async function autoClassifyAccountIndustriesAction(
  forceAll: boolean = false,
) {
  try {
    const ctx = await getAuthOrgContext();
    if (!ctx) throw new Error("Unauthorized");
    const { session, orgId } = ctx;

    // 1. Fetch target accounts
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
      return {
        success: true,
        message: "All accounts are already classified.",
        classifiedCount: 0,
      };
    }

    // 2. Fetch sample campaign names for extra context
    const recentCampaigns = await db.query.adPerformanceDaily.findMany({
      where: inArray(
        adPerformanceDaily.adAccountId,
        accountsToClassify.map((a) => a.id),
      ),
      limit: 100,
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

    // 3. Prepare AI prompt
    const accountPayloads = accountsToClassify.map((acc) => ({
      accountId: acc.id,
      name: acc.name,
      websiteUrl: acc.websiteUrl || "Not provided",
      campaigns: (campaignsByAccount[acc.id] || []).slice(0, 5),
    }));

    const allowedIndustriesList = INDUSTRY_KEYS.map((k) => {
      const meta = getIndustryMeta(k);
      return `- ${k}: ${meta.label} (${meta.subNiches.join(", ")})`;
    }).join("\n");

    const prompt = `
You are an expert digital marketing analyst for an agency. Classify each of the following Google Ads accounts into ONE canonical industry key.

### ALLOWED CANONICAL INDUSTRY KEYS:
${allowedIndustriesList}

### ACCOUNTS TO CLASSIFY:
${JSON.stringify(accountPayloads, null, 2)}

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

    let updatedCount = 0;
    for (const item of parsedResults) {
      const validIndustry: IndustryKey = INDUSTRY_KEYS.includes(
        item.industry as IndustryKey,
      )
        ? (item.industry as IndustryKey)
        : "OTHER";

      await db
        .update(adAccounts)
        .set({
          industry: validIndustry,
          subNiche: item.subNiche || null,
        })
        .where(
          and(
            eq(adAccounts.id, item.accountId),
            eq(adAccounts.organizationId, orgId),
          ),
        );
      updatedCount += 1;
    }

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
