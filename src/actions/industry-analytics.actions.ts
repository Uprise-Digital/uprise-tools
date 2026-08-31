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

// Rule-based classification engine
export function classifyAccountByRules(
  name: string,
  websiteUrl?: string | null,
  campaigns: string[] = [],
): { industry: IndustryKey; subNiche: string } | null {
  const text =
    `${name} ${websiteUrl || ""} ${campaigns.join(" ")}`.toLowerCase();

  // 1. Energy & Solar
  if (
    /\b(solar|battery|batteries|inverter|solar panel|solar system|ev charger|ev charging|renewable|clean energy|off-grid|heat pump solar|solar power)\b/i.test(
      text,
    )
  ) {
    if (
      /\b(battery|batteries|storage|off-grid|tesla powerwall)\b/i.test(text)
    ) {
      return {
        industry: "ENERGY_SOLAR",
        subNiche: "Battery Storage & Off-Grid",
      };
    }
    if (/\b(commercial|business solar|industrial)\b/i.test(text)) {
      return { industry: "ENERGY_SOLAR", subNiche: "Commercial Solar" };
    }
    if (/\b(ev|charger|charging)\b/i.test(text)) {
      return { industry: "ENERGY_SOLAR", subNiche: "EV Charging" };
    }
    return { industry: "ENERGY_SOLAR", subNiche: "Residential Solar" };
  }

  // 2. Home Services & Trades
  if (/\b(plumb|gas|drain|blocked|hot water|leak|tap|pipe)\b/i.test(text)) {
    return { industry: "HOME_SERVICES_TRADES", subNiche: "Plumbing & Gas" };
  }
  if (/\b(electric|sparky|switchboard|rewir|power|lighting)\b/i.test(text)) {
    return {
      industry: "HOME_SERVICES_TRADES",
      subNiche: "Electricians",
    };
  }
  if (/\b(roof|gutter|metal roof|tile roof|restoration|fascia)\b/i.test(text)) {
    return { industry: "HOME_SERVICES_TRADES", subNiche: "Roofing & Gutters" };
  }
  if (
    /\b(air con|aircon|air conditioning|hvac|heat pump|cooling|ducted|refrigeration)\b/i.test(
      text,
    )
  ) {
    return {
      industry: "HOME_SERVICES_TRADES",
      subNiche: "HVAC & Air Conditioning",
    };
  }
  if (/\b(pest|termite|rodent|possum|fumigat|bug|wasp)\b/i.test(text)) {
    return { industry: "HOME_SERVICES_TRADES", subNiche: "Pest Control" };
  }
  if (/\b(locksmith|key|lock|safe|deadbolt|rekey)\b/i.test(text)) {
    return { industry: "HOME_SERVICES_TRADES", subNiche: "Locksmiths" };
  }
  if (
    /\b(clean|carpet|bond clean|pressure wash|window clean|house clean)\b/i.test(
      text,
    )
  ) {
    return { industry: "HOME_SERVICES_TRADES", subNiche: "Cleaning Services" };
  }
  if (/\b(paint|painter|decorat)\b/i.test(text)) {
    return {
      industry: "HOME_SERVICES_TRADES",
      subNiche: "Painting & Decorating",
    };
  }
  if (
    /\b(landscape|tree|arborist|garden|lawn|fenc|deck|pergola)\b/i.test(text)
  ) {
    return {
      industry: "HOME_SERVICES_TRADES",
      subNiche: "Landscaping & Outdoor",
    };
  }
  if (
    /\b(trades|handyman|glaz|glass|tiler|tiling|plaster|carpenter)\b/i.test(
      text,
    )
  ) {
    return {
      industry: "HOME_SERVICES_TRADES",
      subNiche: "General Trade Services",
    };
  }

  // 2. Legal & Financial
  if (
    /\b(law|legal|solicitor|attorney|injury|compensation|criminal|divorce|family law|probate|estate law|litigat)\b/i.test(
      text,
    )
  ) {
    return { industry: "LEGAL_FINANCIAL", subNiche: "Legal & Law Firms" };
  }
  if (/\b(conveyanc|settlement)\b/i.test(text)) {
    return { industry: "LEGAL_FINANCIAL", subNiche: "Conveyancing" };
  }
  if (/\b(account|tax|bookkeep|cpa|audit|payroll|smsf)\b/i.test(text)) {
    return { industry: "LEGAL_FINANCIAL", subNiche: "Accounting & Tax" };
  }
  if (
    /\b(mortgage|broker|finance|loan|wealth|financial plan|superannuation)\b/i.test(
      text,
    )
  ) {
    return { industry: "LEGAL_FINANCIAL", subNiche: "Mortgage & Wealth" };
  }

  // 3. Healthcare & Medical
  if (
    /\b(dent|ortho|teeth|invisalign|smile|veneer|dental|implant)\b/i.test(text)
  ) {
    return {
      industry: "HEALTHCARE_MEDICAL",
      subNiche: "Dental & Orthodontics",
    };
  }
  if (/\b(physio|physical therapy|rehab|occupational therapy)\b/i.test(text)) {
    return { industry: "HEALTHCARE_MEDICAL", subNiche: "Physiotherapy" };
  }
  if (/\b(chiro|chiropract|osteopath|massage)\b/i.test(text)) {
    return {
      industry: "HEALTHCARE_MEDICAL",
      subNiche: "Chiropractic & Wellness",
    };
  }
  if (
    /\b(cosmetic|botox|filler|laser|skin clinic|dermatolog|aesthet|plastic surg)\b/i.test(
      text,
    )
  ) {
    return {
      industry: "HEALTHCARE_MEDICAL",
      subNiche: "Cosmetic & Aesthetics",
    };
  }
  if (
    /\b(psycholog|therap|counsel|mental health|adhd|psychiatr)\b/i.test(text)
  ) {
    return {
      industry: "HEALTHCARE_MEDICAL",
      subNiche: "Mental Health & Psychology",
    };
  }
  if (/\b(optom|eye|vision|lasik|glasses|contact lens)\b/i.test(text)) {
    return {
      industry: "HEALTHCARE_MEDICAL",
      subNiche: "Optometry & Eye Care",
    };
  }
  if (
    /\b(doctor|clinic|medical|gp|podiatry|hearing|audiolog|health)\b/i.test(
      text,
    )
  ) {
    return {
      industry: "HEALTHCARE_MEDICAL",
      subNiche: "Medical Clinics & Health",
    };
  }

  // 4. Building & Construction
  if (
    /\b(builder|construction|custom home|renovat|extension|architect)\b/i.test(
      text,
    )
  ) {
    return {
      industry: "BUILDING_CONSTRUCTION",
      subNiche: "Home Builders & Construction",
    };
  }
  if (/\b(concrete|paving|driveway|slab|asphalt)\b/i.test(text)) {
    return {
      industry: "BUILDING_CONSTRUCTION",
      subNiche: "Concreting & Paving",
    };
  }
  if (/\b(pool|spa|swimming pool|fibreglass pool)\b/i.test(text)) {
    return { industry: "BUILDING_CONSTRUCTION", subNiche: "Pools & Spas" };
  }
  if (/\b(demolition|earthmov|excavat|scaffold|steel)\b/i.test(text)) {
    return {
      industry: "BUILDING_CONSTRUCTION",
      subNiche: "Commercial Construction & Heavy",
    };
  }

  // 5. Automotive & Transport
  if (
    /\b(mechanic|car service|auto repair|brake|clutch|logbook|tyre|tire)\b/i.test(
      text,
    )
  ) {
    return {
      industry: "AUTOMOTIVE_TRANSPORT",
      subNiche: "Mechanics & Auto Service",
    };
  }
  if (
    /\b(smash|panel beat|dent repair|spray paint|accident repair)\b/i.test(text)
  ) {
    return {
      industry: "AUTOMOTIVE_TRANSPORT",
      subNiche: "Panel Beaters & Smash Repair",
    };
  }
  if (/\b(detail|wrap|tint|ceramic coating|car wash)\b/i.test(text)) {
    return {
      industry: "AUTOMOTIVE_TRANSPORT",
      subNiche: "Car Detailing & Wrap",
    };
  }
  if (/\b(tow|towing|breakdown|roadside)\b/i.test(text)) {
    return {
      industry: "AUTOMOTIVE_TRANSPORT",
      subNiche: "Towing & Roadside",
    };
  }
  if (
    /\b(car hire|car rental|rental car|dealership|used car|fleet)\b/i.test(text)
  ) {
    return {
      industry: "AUTOMOTIVE_TRANSPORT",
      subNiche: "Dealerships & Rentals",
    };
  }

  // 6. Real Estate & Property
  if (
    /\b(real estate|realty|property manage|buyers agent|rent|lease|appraisal|estate agent)\b/i.test(
      text,
    )
  ) {
    return {
      industry: "REAL_ESTATE_PROPERTY",
      subNiche: "Real Estate Agencies",
    };
  }
  if (/\b(storage|self storage|container storage)\b/i.test(text)) {
    return { industry: "REAL_ESTATE_PROPERTY", subNiche: "Self Storage" };
  }

  // 7. E-Commerce & Retail
  if (
    /\b(shop|store|brand|apparel|clothing|fashion|shoe|supplement|jewelry|boutique|ecommerce|cart|order|retail|merch)\b/i.test(
      text,
    )
  ) {
    return { industry: "ECOMMERCE_RETAIL", subNiche: "DTC & Retail Store" };
  }

  // 8. B2B & Corporate Services
  if (
    /\b(msp|it support|managed it|cybersecurity|software|saas|cloud|b2b|consult|freight|logistics|commercial clean|recruitment|agency|marketing)\b/i.test(
      text,
    )
  ) {
    return {
      industry: "PROFESSIONAL_B2B",
      subNiche: "B2B & Professional Services",
    };
  }

  // 9. Education & Training
  if (
    /\b(college|rto|course|training|tutor|childcare|daycare|driving school|academy|school|university|learn)\b/i.test(
      text,
    )
  ) {
    return {
      industry: "EDUCATION_TRAINING",
      subNiche: "Education & Courses",
    };
  }

  // 10. Hospitality & Events
  if (
    /\b(venue|wedding|cater|hotel|resort|restaurant|bar|cafe|event|party hire|photo|video|travel|tour)\b/i.test(
      text,
    )
  ) {
    return {
      industry: "HOSPITALITY_EVENTS",
      subNiche: "Hospitality & Events",
    };
  }

  return null;
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
    let accounts = await db.query.adAccounts.findMany({
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

    // Auto-classify check: If accounts are unclassified ('OTHER' or null), run auto-classification
    const unclassifiedAccounts = accounts.filter(
      (a) => !a.industry || a.industry === "OTHER",
    );
    if (unclassifiedAccounts.length > 0) {
      try {
        await classifyAccountsBatchInternal(orgId, false);
        // Refresh accounts list after classification
        accounts = await db.query.adAccounts.findMany({
          where: and(
            eq(adAccounts.isActive, true),
            eq(adAccounts.organizationId, orgId),
          ),
        });
      } catch (err) {
        console.warn("Auto-classification on load encountered an issue:", err);
      }
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
