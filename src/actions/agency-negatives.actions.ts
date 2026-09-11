"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { generateSuggestionsInternal } from "@/actions/negative-keywords.actions";
import { db } from "@/db";
import { adAccounts, negativeKeywordSuggestions } from "@/db/schema";
import { logAction } from "@/lib/audit";
import { getAuthOrgContext } from "@/lib/auth-helpers";
import {
  addAdGroupNegativeKeyword,
  addCampaignNegativeKeyword,
  fetchAccountCampaigns,
  fetchActiveNegativeKeywords,
} from "@/lib/google-ads";

export interface AgencySuggestionRow {
  id: number;
  adAccountId: number;
  accountName: string;
  googleAccountId: string;
  accountIsActive: boolean;
  turboMode: boolean;
  keyword: string;
  matchType: "broad" | "phrase" | "exact";
  campaignId: string;
  campaignName: string;
  adGroupId: string | null;
  adGroupName: string | null;
  triggerCampaignId: string | null;
  triggerCampaignName: string | null;
  rationale: string;
  status: "pending" | "approved" | "denied" | "archived";
  searchQuery: string | null;
  clicks: number;
  impressions: number;
  spend: number;
  conversions: number;
  suggestedAt: string;
  processedAt: string | null;
  error: string | null;
}

export interface CrossAccountConflict {
  keyword: string;
  accounts: Array<{
    adAccountId: number;
    accountName: string;
    status: string;
    spend: number;
    campaignName: string;
    suggestionId: number;
  }>;
  totalWastedSpend: number;
  accountsCount: number;
  hasDiscrepantStatus: boolean; // e.g. approved in one account, pending or denied in another
}

export interface AgencyNegativeKeywordsData {
  stats: {
    totalAccounts: number;
    turboActiveAccounts: number;
    totalSuggestions: number;
    pendingCount: number;
    approvedCount: number;
    deniedCount: number;
    archivedCount: number;
    totalWastedSpend: number;
    blockedSpendApproved: number;
    uniqueKeywordsCount: number;
    crossAccountConflictsCount: number;
  };
  accountsList: Array<{
    id: number;
    name: string;
    googleAccountId: string;
    isActive: boolean;
    turboMode: boolean;
    hasTargetNotes: boolean;
    pendingCount: number;
    lastExplanation: string | null;
  }>;
  suggestions: AgencySuggestionRow[];
  conflicts: CrossAccountConflict[];
}

/**
 * Fetches agency-wide negative keywords overview, metrics, suggestions, and cross-account conflicts.
 */
export async function getAgencyNegativeKeywordsDataAction(): Promise<{
  success: boolean;
  data?: AgencyNegativeKeywordsData;
  error?: string;
}> {
  try {
    const ctx = await getAuthOrgContext();
    const orgId = ctx?.orgId;
    if (!orgId) {
      throw new Error("Unauthorized: Active organization context missing");
    }

    // 1. Fetch all ad accounts belonging to the organization
    const accounts = await db.query.adAccounts.findMany({
      where: eq(adAccounts.organizationId, orgId),
      orderBy: (table, { asc }) => [asc(table.name)],
    });

    if (accounts.length === 0) {
      return {
        success: true,
        data: {
          stats: {
            totalAccounts: 0,
            turboActiveAccounts: 0,
            totalSuggestions: 0,
            pendingCount: 0,
            approvedCount: 0,
            deniedCount: 0,
            archivedCount: 0,
            totalWastedSpend: 0,
            blockedSpendApproved: 0,
            uniqueKeywordsCount: 0,
            crossAccountConflictsCount: 0,
          },
          accountsList: [],
          suggestions: [],
          conflicts: [],
        },
      };
    }

    const accountMap = new Map<number, (typeof accounts)[0]>();
    for (const acc of accounts) {
      accountMap.set(acc.id, acc);
    }
    const accountIds = accounts.map((a) => a.id);

    // 2. Fetch all suggestions for these accounts
    const allSuggestions = await db.query.negativeKeywordSuggestions.findMany({
      where: inArray(negativeKeywordSuggestions.adAccountId, accountIds),
      orderBy: (table, { desc }) => [desc(table.suggestedAt)],
    });

    // 3. Aggregate metrics
    let totalWastedSpend = 0;
    let blockedSpendApproved = 0;
    let pendingCount = 0;
    let approvedCount = 0;
    let deniedCount = 0;
    let archivedCount = 0;

    const uniqueKeywords = new Set<string>();
    const keywordAccountMap = new Map<
      string,
      Array<{
        adAccountId: number;
        accountName: string;
        status: string;
        spend: number;
        campaignName: string;
        suggestionId: number;
      }>
    >();

    const pendingCountByAccount = new Map<number, number>();

    const formattedSuggestions: AgencySuggestionRow[] = [];

    for (const s of allSuggestions) {
      const acc = accountMap.get(s.adAccountId);
      const accName = acc?.name || `Account #${s.adAccountId}`;
      const gId = acc?.googleAccountId || "";
      const isActive = acc?.isActive ?? true;
      const turbo = acc?.negativeKeywordTurboMode ?? false;

      const spendNum = Number(s.spend || 0);

      if (s.status === "pending") {
        pendingCount++;
        totalWastedSpend += spendNum;
        pendingCountByAccount.set(
          s.adAccountId,
          (pendingCountByAccount.get(s.adAccountId) || 0) + 1,
        );
      } else if (s.status === "approved") {
        approvedCount++;
        blockedSpendApproved += spendNum;
      } else if (s.status === "denied") {
        deniedCount++;
      } else if (s.status === "archived") {
        archivedCount++;
      }

      const normalizedKw = s.keyword.toLowerCase().trim();
      uniqueKeywords.add(normalizedKw);

      // Track occurrences for cross-account conflict detection
      if (!keywordAccountMap.has(normalizedKw)) {
        keywordAccountMap.set(normalizedKw, []);
      }
      keywordAccountMap.get(normalizedKw)!.push({
        adAccountId: s.adAccountId,
        accountName: accName,
        status: s.status,
        spend: spendNum,
        campaignName: s.campaignName,
        suggestionId: s.id,
      });

      formattedSuggestions.push({
        id: s.id,
        adAccountId: s.adAccountId,
        accountName: accName,
        googleAccountId: gId,
        accountIsActive: isActive,
        turboMode: turbo,
        keyword: s.keyword,
        matchType: s.matchType as "broad" | "phrase" | "exact",
        campaignId: s.campaignId,
        campaignName: s.campaignName,
        adGroupId: s.adGroupId,
        adGroupName: s.adGroupName,
        triggerCampaignId: s.triggerCampaignId,
        triggerCampaignName: s.triggerCampaignName,
        rationale: s.rationale,
        status: s.status as "pending" | "approved" | "denied" | "archived",
        searchQuery: s.searchQuery,
        clicks: s.clicks ?? 0,
        impressions: s.impressions ?? 0,
        spend: spendNum,
        conversions: Number(s.conversions || 0),
        suggestedAt: s.suggestedAt
          ? s.suggestedAt.toISOString()
          : new Date().toISOString(),
        processedAt: s.processedAt ? s.processedAt.toISOString() : null,
        error: s.error,
      });
    }

    // 4. Compute cross-account conflicts
    const conflicts: CrossAccountConflict[] = [];
    for (const [kw, items] of keywordAccountMap.entries()) {
      // If keyword appears in suggestions across 2 or more distinct accounts
      const uniqueAccountIds = new Set(items.map((i) => i.adAccountId));
      if (uniqueAccountIds.size > 1) {
        const statuses = new Set(items.map((i) => i.status));
        const totalWaste = items.reduce((sum, i) => sum + i.spend, 0);

        conflicts.push({
          keyword: kw,
          accounts: items,
          totalWastedSpend: totalWaste,
          accountsCount: uniqueAccountIds.size,
          hasDiscrepantStatus: statuses.size > 1,
        });
      }
    }
    conflicts.sort((a, b) => b.totalWastedSpend - a.totalWastedSpend);

    // 5. Build account list summary
    const accountsList = accounts.map((a) => ({
      id: a.id,
      name: a.name,
      googleAccountId: a.googleAccountId,
      isActive: a.isActive,
      turboMode: a.negativeKeywordTurboMode,
      hasTargetNotes: Boolean(a.targetNotes && a.targetNotes.trim().length > 0),
      pendingCount: pendingCountByAccount.get(a.id) || 0,
      lastExplanation: a.lastNegativeGenerationExplanation,
    }));

    const turboActiveAccounts = accounts.filter(
      (a) => a.negativeKeywordTurboMode && a.isActive,
    ).length;

    return {
      success: true,
      data: {
        stats: {
          totalAccounts: accounts.length,
          turboActiveAccounts,
          totalSuggestions: allSuggestions.length,
          pendingCount,
          approvedCount,
          deniedCount,
          archivedCount,
          totalWastedSpend,
          blockedSpendApproved,
          uniqueKeywordsCount: uniqueKeywords.size,
          crossAccountConflictsCount: conflicts.length,
        },
        accountsList,
        suggestions: formattedSuggestions,
        conflicts,
      },
    };
  } catch (err: any) {
    console.error("Failed to get agency negative keywords data:", err);
    return {
      success: false,
      error: err.message || "Failed to load agency negative keywords overview",
    };
  }
}

export interface BatchItemUpdate {
  id: number;
  status: "approved" | "denied" | "archived";
  customMatchType?: "broad" | "phrase" | "exact";
  customScope?: "global" | "campaign" | "adgroup";
  customCampaignId?: string;
}

/**
 * Batch approve, deny, or archive suggestions across multiple client accounts.
 */
export async function batchUpdateAgencySuggestionsAction(
  updates: BatchItemUpdate[],
): Promise<{
  success: boolean;
  succeededCount: number;
  failedCount: number;
  errors?: string[];
}> {
  try {
    const ctx = await getAuthOrgContext();
    const session = ctx?.session;
    const orgId = ctx?.orgId;
    if (!session || !orgId) {
      throw new Error("Unauthorized: Session or organization missing");
    }

    if (!updates || updates.length === 0) {
      return { success: true, succeededCount: 0, failedCount: 0 };
    }

    const suggestionIds = updates.map((u) => u.id);
    const dbSuggestions = await db.query.negativeKeywordSuggestions.findMany({
      where: inArray(negativeKeywordSuggestions.id, suggestionIds),
      with: {
        account: true,
      },
    });

    const suggestionMap = new Map<number, (typeof dbSuggestions)[0]>();
    for (const s of dbSuggestions) {
      suggestionMap.set(s.id, s);
    }

    let succeededCount = 0;
    let failedCount = 0;
    const errors: string[] = [];

    // Cache campaigns per Google Account ID to avoid spamming Google Ads API
    const campaignsCache = new Map<
      string,
      Array<{ id: string; name: string }>
    >();
    const getCachedCampaigns = async (googleAccountId: string) => {
      if (campaignsCache.has(googleAccountId)) {
        return campaignsCache.get(googleAccountId)!;
      }
      try {
        const camps = await fetchAccountCampaigns(googleAccountId);
        campaignsCache.set(googleAccountId, camps || []);
        return camps || [];
      } catch (e: any) {
        console.error(`Failed to fetch campaigns for ${googleAccountId}:`, e);
        return [];
      }
    };

    for (const item of updates) {
      const suggestion = suggestionMap.get(item.id);
      if (!suggestion) {
        failedCount++;
        errors.push(`Suggestion #${item.id} not found`);
        continue;
      }

      // Ensure account belongs to user's organization
      if (suggestion.account?.organizationId !== orgId) {
        failedCount++;
        errors.push(`Unauthorized access to suggestion #${item.id}`);
        continue;
      }

      const finalMatchType = item.customMatchType || suggestion.matchType;
      let finalCampaignId = suggestion.campaignId;
      let finalCampaignName = suggestion.campaignName;
      let finalAdGroupId = suggestion.adGroupId;
      let finalAdGroupName = suggestion.adGroupName;

      if (item.status === "approved") {
        const scopeToUse =
          item.customScope ||
          (suggestion.campaignId === "ALL" ? "global" : "campaign");
        const googleAccountId = suggestion.account?.googleAccountId || "";

        try {
          if (scopeToUse === "global") {
            finalCampaignId = "ALL";
            finalCampaignName = "All Campaigns";
            finalAdGroupId = null;
            finalAdGroupName = null;

            const campaigns = await getCachedCampaigns(googleAccountId);
            for (const c of campaigns) {
              await addCampaignNegativeKeyword(
                googleAccountId,
                c.id,
                suggestion.keyword,
                finalMatchType,
              );
            }
          } else if (scopeToUse === "adgroup" && suggestion.adGroupId) {
            if (suggestion.campaignId === "ALL") {
              finalCampaignId = suggestion.triggerCampaignId || "ALL";
              finalCampaignName =
                suggestion.triggerCampaignName || "All Campaigns";
            } else {
              finalCampaignId = suggestion.campaignId;
              finalCampaignName = suggestion.campaignName;
            }
            finalAdGroupId = suggestion.adGroupId;
            finalAdGroupName = suggestion.adGroupName;

            await addAdGroupNegativeKeyword(
              googleAccountId,
              suggestion.adGroupId,
              suggestion.keyword,
              finalMatchType,
            );
          } else {
            // Campaign scope
            let targetCampaignId = item.customCampaignId || finalCampaignId;
            let targetCampaignName = finalCampaignName;

            if (!targetCampaignId || targetCampaignId === "ALL") {
              if (
                suggestion.triggerCampaignId &&
                suggestion.triggerCampaignId !== "ALL"
              ) {
                targetCampaignId = suggestion.triggerCampaignId;
                targetCampaignName =
                  suggestion.triggerCampaignName || "Trigger Campaign";
              } else {
                const campaigns = await getCachedCampaigns(googleAccountId);
                if (campaigns && campaigns.length > 0) {
                  targetCampaignId = campaigns[0].id;
                  targetCampaignName = campaigns[0].name;
                } else {
                  throw new Error(
                    "No active campaigns found in Google Ads account",
                  );
                }
              }
            }

            finalCampaignId = targetCampaignId;
            if (item.customCampaignId) {
              const campaigns = await getCachedCampaigns(googleAccountId);
              const selectedCamp = campaigns.find(
                (c: { id: string; name: string }) =>
                  c.id === item.customCampaignId,
              );
              if (selectedCamp) {
                finalCampaignName = selectedCamp.name;
              }
            } else if (
              suggestion.campaignId === "ALL" &&
              suggestion.triggerCampaignName
            ) {
              finalCampaignName = suggestion.triggerCampaignName;
            }

            finalAdGroupId = null;
            finalAdGroupName = null;

            await addCampaignNegativeKeyword(
              googleAccountId,
              finalCampaignId,
              suggestion.keyword,
              finalMatchType,
            );
          }

          // Update DB as approved
          await db
            .update(negativeKeywordSuggestions)
            .set({
              status: "approved",
              matchType: finalMatchType,
              campaignId: finalCampaignId,
              campaignName: finalCampaignName,
              adGroupId: finalAdGroupId,
              adGroupName: finalAdGroupName,
              processedAt: new Date(),
              error: null,
            })
            .where(eq(negativeKeywordSuggestions.id, suggestion.id));

          await logAction(
            session.user.id,
            "AGENCY_BATCH_SUGGESTION_APPROVED",
            "negative_keyword_suggestions",
            suggestion.id,
            {
              keyword: suggestion.keyword,
              campaignId: finalCampaignId,
              matchType: finalMatchType,
            },
          );
          succeededCount++;
        } catch (pushErr: any) {
          console.error(
            `Failed to approve negative keyword "${suggestion.keyword}":`,
            pushErr,
          );
          failedCount++;
          errors.push(
            `"${suggestion.keyword}": ${pushErr.message || "API push failure"}`,
          );

          await db
            .update(negativeKeywordSuggestions)
            .set({
              error: pushErr.message || "Failed to push negative keyword",
            })
            .where(eq(negativeKeywordSuggestions.id, suggestion.id));
        }
      } else {
        // Deny or Archive
        await db
          .update(negativeKeywordSuggestions)
          .set({
            status: item.status,
            processedAt: new Date(),
          })
          .where(eq(negativeKeywordSuggestions.id, suggestion.id));

        await logAction(
          session.user.id,
          `AGENCY_BATCH_SUGGESTION_${item.status.toUpperCase()}`,
          "negative_keyword_suggestions",
          suggestion.id,
          { keyword: suggestion.keyword },
        );
        succeededCount++;
      }
    }

    revalidatePath("/overview/negatives");
    return {
      success: failedCount === 0,
      succeededCount,
      failedCount,
      errors: errors.length > 0 ? errors.slice(0, 5) : undefined,
    };
  } catch (err: any) {
    console.error("Batch update failed:", err);
    return {
      success: false,
      succeededCount: 0,
      failedCount: updates.length,
      errors: [err.message || "Failed batch update"],
    };
  }
}

/**
 * Clean up duplicate pending suggestions across all or selected client accounts.
 */
export async function batchDeduplicateAgencySuggestionsAction(
  accountIds?: number[],
): Promise<{ success: boolean; totalRemoved: number; error?: string }> {
  try {
    const ctx = await getAuthOrgContext();
    const orgId = ctx?.orgId;
    if (!orgId) throw new Error("Unauthorized");

    let accountsToClean = await db.query.adAccounts.findMany({
      where: eq(adAccounts.organizationId, orgId),
    });

    if (accountIds && accountIds.length > 0) {
      accountsToClean = accountsToClean.filter((a) =>
        accountIds.includes(a.id),
      );
    }

    let totalRemoved = 0;

    for (const acc of accountsToClean) {
      const allSuggestions = await db.query.negativeKeywordSuggestions.findMany(
        {
          where: eq(negativeKeywordSuggestions.adAccountId, acc.id),
        },
      );

      const pending = allSuggestions.filter((s) => s.status === "pending");
      const nonPending = allSuggestions.filter((s) => s.status !== "pending");

      const activeExclusions = new Set(
        nonPending.map(
          (s) => `${s.keyword.toLowerCase().trim()}|${s.campaignId}`,
        ),
      );
      const globalActiveExclusions = new Set(
        nonPending
          .filter((s) => s.campaignId === "ALL")
          .map((s) => s.keyword.toLowerCase().trim()),
      );

      const toDeleteIds: number[] = [];
      const seenPending = new Set<string>();

      for (const s of pending) {
        const kwNormalized = s.keyword.toLowerCase().trim();
        const key = `${kwNormalized}|${s.campaignId}`;

        if (
          activeExclusions.has(key) ||
          globalActiveExclusions.has(kwNormalized)
        ) {
          toDeleteIds.push(s.id);
          continue;
        }

        if (s.campaignId !== "ALL" && seenPending.has(`${kwNormalized}|ALL`)) {
          toDeleteIds.push(s.id);
          continue;
        }

        if (s.campaignId === "ALL") {
          for (const seenKey of seenPending) {
            if (
              seenKey.startsWith(`${kwNormalized}|`) &&
              !seenKey.endsWith("|ALL")
            ) {
              const matched = pending.find(
                (p) =>
                  p.keyword.toLowerCase().trim() === kwNormalized &&
                  p.campaignId !== "ALL",
              );
              if (matched && !toDeleteIds.includes(matched.id)) {
                toDeleteIds.push(matched.id);
              }
            }
          }
        }

        if (seenPending.has(key)) {
          toDeleteIds.push(s.id);
        } else {
          seenPending.add(key);
        }
      }

      if (toDeleteIds.length > 0) {
        for (const id of toDeleteIds) {
          await db
            .delete(negativeKeywordSuggestions)
            .where(eq(negativeKeywordSuggestions.id, id));
        }
        totalRemoved += toDeleteIds.length;
      }
    }

    revalidatePath("/overview/negatives");
    return { success: true, totalRemoved };
  } catch (err: any) {
    console.error("Deduplication error:", err);
    return { success: false, totalRemoved: 0, error: err.message };
  }
}

/**
 * Triggers negative keyword scan across active accounts.
 */
export async function triggerAgencyScanAction(
  accountIds?: number[],
  startDate?: string,
  endDate?: string,
): Promise<{
  success: boolean;
  scannedCount: number;
  totalNewSuggestions: number;
  errors?: string[];
}> {
  try {
    const ctx = await getAuthOrgContext();
    const session = ctx?.session;
    const orgId = ctx?.orgId;
    if (!session || !orgId) throw new Error("Unauthorized");

    let targetAccounts = await db.query.adAccounts.findMany({
      where: and(
        eq(adAccounts.organizationId, orgId),
        eq(adAccounts.isActive, true),
      ),
    });

    if (accountIds && accountIds.length > 0) {
      targetAccounts = targetAccounts.filter((a) => accountIds.includes(a.id));
    }

    let scannedCount = 0;
    let totalNewSuggestions = 0;
    const errors: string[] = [];

    for (const acc of targetAccounts) {
      try {
        const result = await generateSuggestionsInternal(
          acc.id,
          startDate,
          endDate,
          session.user.id,
        );
        scannedCount++;
        totalNewSuggestions += result.newSuggestionsAdded;
      } catch (err: any) {
        console.error(`Scan failed for account ${acc.name}:`, err);
        errors.push(`${acc.name}: ${err.message || "Failed"}`);
      }
    }

    revalidatePath("/overview/negatives");
    return {
      success: true,
      scannedCount,
      totalNewSuggestions,
      errors: errors.length > 0 ? errors : undefined,
    };
  } catch (err: any) {
    console.error("Trigger agency scan error:", err);
    return {
      success: false,
      scannedCount: 0,
      totalNewSuggestions: 0,
      errors: [err.message || "Failed agency scan"],
    };
  }
}

/**
 * Fetch live active negative keywords across all active Google Ads accounts in the agency.
 */
export async function fetchAllAgencyActiveNegativesAction(): Promise<{
  success: boolean;
  data?: Array<{
    adAccountId: number;
    accountName: string;
    criterionId: string;
    keyword: string;
    matchType: string;
    campaignId: string;
    campaignName: string;
  }>;
  error?: string;
}> {
  try {
    const ctx = await getAuthOrgContext();
    const orgId = ctx?.orgId;
    if (!orgId) throw new Error("Unauthorized");

    const accounts = await db.query.adAccounts.findMany({
      where: and(
        eq(adAccounts.organizationId, orgId),
        eq(adAccounts.isActive, true),
      ),
    });

    const allLive: Array<{
      adAccountId: number;
      accountName: string;
      criterionId: string;
      keyword: string;
      matchType: string;
      campaignId: string;
      campaignName: string;
    }> = [];

    // Parallel fetch with catch per account
    await Promise.all(
      accounts.map(async (acc) => {
        try {
          const rows = await fetchActiveNegativeKeywords(acc.googleAccountId);
          for (const row of rows) {
            const crit = row.campaignCriterion || {};
            const kw = crit.keyword || {};
            const campaign = row.campaign || {};
            allLive.push({
              adAccountId: acc.id,
              accountName: acc.name,
              criterionId: crit.criterionId || "",
              keyword: kw.text || "",
              matchType: kw.matchType || "PHRASE",
              campaignId: campaign.id || "",
              campaignName: campaign.name || "",
            });
          }
        } catch (e: any) {
          console.warn(
            `Could not fetch live negatives for ${acc.name}:`,
            e.message,
          );
        }
      }),
    );

    return { success: true, data: allLive };
  } catch (err: any) {
    console.error("Failed to fetch all live negatives:", err);
    return { success: false, error: err.message };
  }
}
