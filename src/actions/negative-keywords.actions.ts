"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { db } from "@/db";
import {
  accountTriageSettings,
  adAccounts,
  negativeKeywordSuggestions,
} from "@/db/schema";
import { logAction } from "@/lib/audit";
import { auth } from "@/lib/auth";
import {
  addAdGroupNegativeKeyword,
  addCampaignNegativeKeyword,
  fetchAccountCampaigns,
  fetchActiveNegativeKeywords,
  fetchSearchTermsReport,
} from "@/lib/google-ads";
import { generateNegativeKeywordSuggestions } from "@/lib/negative-keyword-service";

/**
 * Utility function to check auth session.
 */
async function getSession() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  return session;
}

/**
 * Toggles Turbo Mode for a specific ad account.
 */
export async function toggleTurboModeAction(
  adAccountId: number,
  enabled: boolean,
) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  try {
    await db
      .update(adAccounts)
      .set({ negativeKeywordTurboMode: enabled })
      .where(eq(adAccounts.id, adAccountId));

    await logAction(
      session.user.id,
      enabled ? "ENABLE_TURBO_MODE" : "DISABLE_TURBO_MODE",
      "ad_accounts",
      adAccountId,
      { enabled },
    );

    revalidatePath(`/accounts/${adAccountId}/negatives`);
    return { success: true };
  } catch (error: any) {
    console.error("Failed to toggle turbo mode:", error);
    return {
      success: false,
      error: error.message || "Failed to update turbo mode settings",
    };
  }
}

/**
 * Fetches all saved negative keyword suggestions from the database.
 */
export async function getSuggestionsAction(adAccountId: number) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  try {
    const suggestions = await db.query.negativeKeywordSuggestions.findMany({
      where: eq(negativeKeywordSuggestions.adAccountId, adAccountId),
      orderBy: (table, { desc }) => [desc(table.suggestedAt)],
    });
    return { success: true, data: suggestions };
  } catch (error: any) {
    console.error("Failed to fetch suggestions:", error);
    return {
      success: false,
      error: error.message || "Failed to fetch suggestions",
    };
  }
}

/**
 * Helper logic to trigger negative keyword generation pipeline.
 * Separated so it can be called by both the UI action and the cron endpoint.
 */
export async function generateSuggestionsInternal(
  adAccountId: number,
  startDate?: string,
  endDate?: string,
  actorId?: string,
) {
  // 1. Fetch account details from DB
  const account = await db.query.adAccounts.findFirst({
    where: eq(adAccounts.id, adAccountId),
  });

  if (!account) {
    throw new Error("Ad account not found");
  }

  // 2. Fetch existing active negative keywords from Google Ads API
  const activeGoogleNegatives = await fetchActiveNegativeKeywords(
    account.googleAccountId,
  );

  // Extract clean keyword text strings to pass to filter/Gemini
  const activeNegTextList = activeGoogleNegatives
    .map((row: any) => row.campaignCriterion?.keyword?.text || "")
    .filter(Boolean);

  // 3. Fetch search terms report from Google Ads API
  const rawSearchTerms = await fetchSearchTermsReport(
    account.googleAccountId,
    startDate,
    endDate,
  );

  // Format spend from micros to normal decimal units and map fields
  const formattedSearchTerms = rawSearchTerms
    .map((row: any) => {
      const stView = row.searchTermView || {};
      const campaignObj = row.campaign || {};
      const adGroupObj = row.adGroup || {};
      const metricsObj = row.metrics || {};

      return {
        query: stView.searchTerm || "",
        campaignId: campaignObj.id || "",
        campaignName: campaignObj.name || "",
        adGroupId: adGroupObj.id || "",
        adGroupName: adGroupObj.name || "",
        clicks: Number(metricsObj.clicks || 0),
        impressions: Number(metricsObj.impressions || 0),
        spend: Number(metricsObj.costMicros || 0) / 1_000_000,
        conversions: Number(metricsObj.conversions || 0),
      };
    })
    .filter((st: any) => st.query);

  // --- 4. Fetch Triage Thresholds to isolate Wasted vs Converting Terms ---
  const [triageSettings, orgDefaults] = await Promise.all([
    db.query.accountTriageSettings.findFirst({
      where: eq(accountTriageSettings.adAccountId, adAccountId),
    }),
    db.query.orgTriageDefaults.findFirst(),
  ]);

  // Fallback chain: Account level setting -> Organization level default -> fallback threshold ($25)
  const criticalSpendThreshold = Number(
    triageSettings?.criticalSpendThreshold ??
      orgDefaults?.criticalSpendThreshold ??
      25.0,
  );

  // Separate terms based on performance metrics
  const convertingTerms = formattedSearchTerms.filter(
    (st: any) => st.conversions > 0,
  );
  const wastedTerms = formattedSearchTerms.filter(
    (st: any) => st.conversions === 0 && st.spend >= criticalSpendThreshold,
  );
  const allZeroConversionTerms = formattedSearchTerms.filter(
    (st: any) => st.conversions === 0 && st.spend > 0,
  );

  const activeNegativesSet = new Set(
    activeNegTextList.map((kw: string) => kw.toLowerCase().trim()),
  );
  const filteredWastedTerms = wastedTerms.filter(
    (term: any) => !activeNegativesSet.has(term.query.toLowerCase().trim()),
  );

  // --- 4.5 Fetch historical decisions for feedback loop ---
  const historicalDBSuggestions =
    await db.query.negativeKeywordSuggestions.findMany({
      where: eq(negativeKeywordSuggestions.adAccountId, adAccountId),
    });

  const historicalDecisions = historicalDBSuggestions
    .filter((s) => s.status === "approved" || s.status === "denied")
    .map((s) => ({
      keyword: s.keyword,
      status: s.status,
      rationale: s.rationale,
    }));

  // --- 4.6 Perform Web Research using Serper.dev if available ---
  let webResearchQueries: string[] = [];
  let servicesToSearch: string[] = [];
  if (account.targetNotes) {
    try {
      const parsed = JSON.parse(account.targetNotes);
      if (parsed && parsed.serviceScope) {
        servicesToSearch = Array.isArray(parsed.serviceScope)
          ? parsed.serviceScope
          : [parsed.serviceScope];
      }
    } catch {}
  }
  if (servicesToSearch.length === 0) {
    servicesToSearch = [account.name];
  }

  if (process.env.SERPER_KEY) {
    try {
      console.log(
        `[Negative Keywords] Initiating Serper research for: ${servicesToSearch.slice(0, 2).join(", ")}`,
      );
      const searchPromises = servicesToSearch
        .slice(0, 2)
        .map(async (service) => {
          const res = await fetch("https://google.serper.dev/search", {
            method: "POST",
            headers: {
              "X-API-KEY": process.env.SERPER_KEY!,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ q: service, gl: "au" }),
          });
          if (res.ok) {
            const data = await res.json();
            const queries = (data.relatedSearches || []).map(
              (item: any) => item.query,
            );
            const questions = (data.peopleAlsoAsk || []).map(
              (item: any) => item.question,
            );
            return [...queries, ...questions];
          }
          return [];
        });
      const searchResults = await Promise.all(searchPromises);
      webResearchQueries = Array.from(
        new Set(searchResults.flat().filter(Boolean)),
      );
      console.log(
        `[Negative Keywords] Serper research returned ${webResearchQueries.length} queries.`,
      );
    } catch (searchError) {
      console.error("[Negative Keywords] Serper research failed:", searchError);
    }
  }

  // --- 4.7 Send to Gemini for negative keywords suggestions ---
  const { suggestions, explanation, usageAlert } =
    await generateNegativeKeywordSuggestions({
      clientName: account.name,
      websiteUrl: account.websiteUrl,
      targetNotes: account.targetNotes,
      convertingTerms,
      wastedTerms: filteredWastedTerms,
      existingNegatives: activeNegTextList,
      historicalDecisions,
      webResearchQueries,
      allZeroConversionTerms,
    });

  // 5. Deduplicate suggestions from Gemini response first
  const deduplicatedSuggestions: typeof suggestions = [];
  const sortedIncoming = [...suggestions].sort((a, b) => {
    // Prefer global "ALL" exclusions over campaign-specific ones
    if (a.campaignId === "ALL" && b.campaignId !== "ALL") return -1;
    if (a.campaignId !== "ALL" && b.campaignId === "ALL") return 1;
    return 0;
  });

  for (const s of sortedIncoming) {
    const kwNormalized = s.keyword.toLowerCase().trim();
    if (s.campaignId === "ALL") {
      const alreadySawKeyword = deduplicatedSuggestions.some(
        (d) => d.keyword.toLowerCase().trim() === kwNormalized,
      );
      if (!alreadySawKeyword) {
        deduplicatedSuggestions.push(s);
      }
    } else {
      const alreadySawLocal = deduplicatedSuggestions.some(
        (d) =>
          d.keyword.toLowerCase().trim() === kwNormalized &&
          (d.campaignId === s.campaignId || d.campaignId === "ALL"),
      );
      if (!alreadySawLocal) {
        deduplicatedSuggestions.push(s);
      }
    }
  }

  // Fetch existing suggestions in DB to prevent duplicates
  const existingDBSuggestions =
    await db.query.negativeKeywordSuggestions.findMany({
      where: eq(negativeKeywordSuggestions.adAccountId, adAccountId),
    });

  // Create a unique compound key for lookups: "keyword|campaignId"
  const existingDBKeySet = new Set(
    existingDBSuggestions.map(
      (s) => `${s.keyword.toLowerCase().trim()}|${s.campaignId}`,
    ),
  );

  // Also check if there is an "ALL" exclusion in database
  const globalExclusionsInDB = new Set(
    existingDBSuggestions
      .filter((s) => s.campaignId === "ALL")
      .map((s) => s.keyword.toLowerCase().trim()),
  );

  // Filter out any suggestion that is already in our DB (either locally or globally)
  const newSuggestions = deduplicatedSuggestions.filter((s) => {
    const kwNormalized = s.keyword.toLowerCase().trim();
    const key = `${kwNormalized}|${s.campaignId}`;
    if (globalExclusionsInDB.has(kwNormalized)) return false;
    if (s.campaignId !== "ALL" && existingDBKeySet.has(`${kwNormalized}|ALL`))
      return false;
    return !existingDBKeySet.has(key);
  });

  let pushedCount = 0;
  let savedCount = 0;

  // Cache active campaigns list in case we have "ALL" (global/account-wide) exclusions
  let accountCampaigns: Array<{ id: string; name: string }> | null = null;
  const getCachedCampaigns = async (): Promise<
    Array<{ id: string; name: string }>
  > => {
    if (!accountCampaigns) {
      accountCampaigns = await fetchAccountCampaigns(account.googleAccountId);
    }
    return accountCampaigns || [];
  };

  for (const s of newSuggestions) {
    const originalTerm = wastedTerms.find(
      (w: any) =>
        w.query.toLowerCase().trim() === s.searchQuery.toLowerCase().trim(),
    );
    const adGroupId = originalTerm?.adGroupId || null;
    const adGroupName = originalTerm?.adGroupName || null;

    if (account.negativeKeywordTurboMode) {
      // TURBO MODE IS ON: Push directly to Google Ads
      try {
        if (s.campaignId === "ALL") {
          const campaigns = await getCachedCampaigns();
          for (const c of campaigns) {
            await addCampaignNegativeKeyword(
              account.googleAccountId,
              c.id,
              s.keyword,
              s.matchType,
            );
          }
        } else {
          await addCampaignNegativeKeyword(
            account.googleAccountId,
            s.campaignId,
            s.keyword,
            s.matchType,
          );
        }

        await db.insert(negativeKeywordSuggestions).values({
          adAccountId,
          keyword: s.keyword,
          matchType: s.matchType,
          campaignId: s.campaignId,
          campaignName: s.campaignName,
          adGroupId,
          adGroupName,
          triggerCampaignId: originalTerm?.campaignId || null,
          triggerCampaignName: originalTerm?.campaignName || null,
          rationale: s.rationale,
          status: "approved",
          searchQuery: s.searchQuery,
          clicks: s.clicks,
          impressions: s.impressions,
          spend: String(s.spend),
          conversions: String(s.conversions),
          processedAt: new Date(),
        });
        pushedCount++;
      } catch (mutateErr: any) {
        console.error(
          `Turbo Mode push failed for keyword "${s.keyword}":`,
          mutateErr,
        );

        // Save to DB with 'pending' status but note the push error
        await db.insert(negativeKeywordSuggestions).values({
          adAccountId,
          keyword: s.keyword,
          matchType: s.matchType,
          campaignId: s.campaignId,
          campaignName: s.campaignName,
          adGroupId,
          adGroupName,
          triggerCampaignId: originalTerm?.campaignId || null,
          triggerCampaignName: originalTerm?.campaignName || null,
          rationale: s.rationale,
          status: "pending",
          searchQuery: s.searchQuery,
          clicks: s.clicks,
          impressions: s.impressions,
          spend: String(s.spend),
          conversions: String(s.conversions),
          error:
            mutateErr.message || "Failed to push automatically in Turbo Mode",
        });
        savedCount++;
      }
    } else {
      // TURBO MODE IS OFF: Save as pending for manual review
      await db.insert(negativeKeywordSuggestions).values({
        adAccountId,
        keyword: s.keyword,
        matchType: s.matchType,
        campaignId: s.campaignId,
        campaignName: s.campaignName,
        adGroupId,
        adGroupName,
        triggerCampaignId: originalTerm?.campaignId || null,
        triggerCampaignName: originalTerm?.campaignName || null,
        rationale: s.rationale,
        status: "pending",
        searchQuery: s.searchQuery,
        clicks: s.clicks,
        impressions: s.impressions,
        spend: String(s.spend),
        conversions: String(s.conversions),
      });
      savedCount++;
    }
  }

  // Save generated explanation to database for persistency
  await db
    .update(adAccounts)
    .set({ lastNegativeGenerationExplanation: explanation })
    .where(eq(adAccounts.id, adAccountId));

  // 6. Log Audit action
  if (actorId) {
    await logAction(
      actorId,
      "GENERATE_NEGATIVE_SUGGESTIONS",
      "negative_keyword_suggestions",
      adAccountId,
      {
        totalGenerated: suggestions.length,
        alreadyExistedInDB: suggestions.length - newSuggestions.length,
        newSuggestionsAdded: newSuggestions.length,
        pushedDirectly: pushedCount,
        savedForReview: savedCount,
        turboModeActive: account.negativeKeywordTurboMode,
      },
    );
  }

  return {
    totalGenerated: suggestions.length,
    newSuggestionsAdded: newSuggestions.length,
    pushedDirectly: pushedCount,
    savedForReview: savedCount,
    usageAlert,
    explanation,
  };
}

/**
 * Triggers the generation process on-demand from the UI.
 */
export async function generateNegativeSuggestionsAction(
  adAccountId: number,
  startDate?: string,
  endDate?: string,
) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  try {
    console.log(
      `[Actions] User ${session.user.email} trigger negative keyword generation for account ${adAccountId}...`,
    );
    const result = await generateSuggestionsInternal(
      adAccountId,
      startDate,
      endDate,
      session.user.id,
    );

    revalidatePath(`/accounts/${adAccountId}/negatives`);
    return { success: true, ...result };
  } catch (error: any) {
    console.error("Failed to generate negative suggestions:", error);
    return {
      success: false,
      error: error.message || "Failed to generate suggestions",
    };
  }
}

/**
 * Updates a suggestion status (approves, denies, archives) and pushes to Google Ads if approved.
 */
export async function updateSuggestionStatusAction(
  suggestionId: number,
  status: "approved" | "denied" | "archived",
  customMatchType?: "broad" | "phrase" | "exact",
  customScope?: "global" | "campaign" | "adgroup",
  customCampaignId?: string,
) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  try {
    // 1. Fetch suggestion
    const suggestion = await db.query.negativeKeywordSuggestions.findFirst({
      where: eq(negativeKeywordSuggestions.id, suggestionId),
      with: {
        account: true,
      },
    });

    if (!suggestion) {
      throw new Error("Suggestion not found");
    }

    const finalMatchType = customMatchType || suggestion.matchType;
    let finalCampaignId = suggestion.campaignId;
    let finalCampaignName = suggestion.campaignName;
    let finalAdGroupId = suggestion.adGroupId;
    let finalAdGroupName = suggestion.adGroupName;

    if (status === "approved") {
      const scopeToUse =
        customScope ||
        (suggestion.campaignId === "ALL" ? "global" : "campaign");

      console.log(
        `[Actions] User ${session.user.email} approved keyword "${suggestion.keyword}" (Match: ${finalMatchType}, Scope: ${scopeToUse})`,
      );

      if (scopeToUse === "global") {
        finalCampaignId = "ALL";
        finalCampaignName = "All Campaigns";
        finalAdGroupId = null;
        finalAdGroupName = null;

        const campaigns = await fetchAccountCampaigns(
          suggestion.account.googleAccountId,
        );
        for (const c of campaigns) {
          await addCampaignNegativeKeyword(
            suggestion.account.googleAccountId,
            c.id,
            suggestion.keyword,
            finalMatchType,
          );
        }
      } else if (scopeToUse === "adgroup" && suggestion.adGroupId) {
        if (suggestion.campaignId === "ALL") {
          finalCampaignId = suggestion.triggerCampaignId || "ALL";
          finalCampaignName = suggestion.triggerCampaignName || "All Campaigns";
        } else {
          finalCampaignId = suggestion.campaignId;
          finalCampaignName = suggestion.campaignName;
        }
        finalAdGroupId = suggestion.adGroupId;
        finalAdGroupName = suggestion.adGroupName;

        await addAdGroupNegativeKeyword(
          suggestion.account.googleAccountId,
          suggestion.adGroupId,
          suggestion.keyword,
          finalMatchType,
        );
      } else {
        // Campaign Scope
        let targetCampaignId = customCampaignId || finalCampaignId;
        let targetCampaignName = finalCampaignName;

        if (targetCampaignId === "ALL") {
          if (suggestion.triggerCampaignId) {
            targetCampaignId = suggestion.triggerCampaignId;
            targetCampaignName =
              suggestion.triggerCampaignName || "Trigger Campaign";
          } else {
            throw new Error(
              "Cannot apply to Campaign scope: no campaign selected or triggering campaign details not found.",
            );
          }
        }

        finalCampaignId = targetCampaignId;
        if (customCampaignId) {
          const campaigns = await fetchAccountCampaigns(
            suggestion.account.googleAccountId,
          );
          const selectedCamp = campaigns.find(
            (c: any) => c.id === customCampaignId,
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
          suggestion.account.googleAccountId,
          finalCampaignId,
          suggestion.keyword,
          finalMatchType,
        );
      }

      // Update in DB as approved
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
        .where(eq(negativeKeywordSuggestions.id, suggestionId));
    } else {
      // Just mark as denied or archived in DB
      await db
        .update(negativeKeywordSuggestions)
        .set({
          status,
          processedAt: new Date(),
        })
        .where(eq(negativeKeywordSuggestions.id, suggestionId));
    }

    // 2. Audit log
    await logAction(
      session.user.id,
      `SUGGESTION_${status.toUpperCase()}`,
      "negative_keyword_suggestions",
      suggestionId,
      {
        keyword: suggestion.keyword,
        campaignId: suggestion.campaignId,
        matchType: finalMatchType,
      },
    );

    revalidatePath(`/accounts/${suggestion.adAccountId}/negatives`);
    return { success: true };
  } catch (error: any) {
    console.error(`Failed to update suggestion status to ${status}:`, error);

    // If it failed to push, we can save the error back to the suggestion so the user sees why it failed
    if (status === "approved") {
      try {
        await db
          .update(negativeKeywordSuggestions)
          .set({
            error:
              error.message ||
              "Failed to push negative keyword to Google Ads API.",
          })
          .where(eq(negativeKeywordSuggestions.id, suggestionId));
      } catch (dbErr) {
        console.error("Failed to save error status on suggestion:", dbErr);
      }
    }

    return {
      success: false,
      error: error.message || `Failed to update status to ${status}`,
    };
  }
}

/**
 * Action to fetch live campaign-level negative keywords directly from Google Ads.
 */
export async function fetchActiveNegativeKeywordsAction(adAccountId: number) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  try {
    const account = await db.query.adAccounts.findFirst({
      where: eq(adAccounts.id, adAccountId),
    });

    if (!account) {
      throw new Error("Ad account not found");
    }

    const activeGoogleNegatives = await fetchActiveNegativeKeywords(
      account.googleAccountId,
    );

    const formatted = activeGoogleNegatives.map((row: any) => {
      const crit = row.campaignCriterion || {};
      const kw = crit.keyword || {};
      const campaign = row.campaign || {};
      return {
        criterionId: crit.criterionId || "",
        keyword: kw.text || "",
        matchType: kw.matchType || "PHRASE",
        campaignId: campaign.id || "",
        campaignName: campaign.name || "",
      };
    });

    return { success: true, data: formatted };
  } catch (error: any) {
    console.error("Failed to fetch active negatives:", error);
    return {
      success: false,
      error: error.message || "Failed to fetch active negative keywords",
    };
  }
}

/**
 * Server action to clean up duplicate pending suggestions in the database.
 * If a suggestion is already approved/denied/archived, or if a more global ('ALL')
 * suggestion exists, this action deletes the redundant pending cards.
 */
export async function deduplicateSuggestionsAction(adAccountId: number) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  try {
    const allSuggestions = await db.query.negativeKeywordSuggestions.findMany({
      where: eq(negativeKeywordSuggestions.adAccountId, adAccountId),
    });

    const pending = allSuggestions.filter((s) => s.status === "pending");
    const nonPending = allSuggestions.filter((s) => s.status !== "pending");

    // Group non-pending keywords for quick lookup
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

      // 1. If keyword is already approved/denied/archived locally or globally, remove pending
      if (
        activeExclusions.has(key) ||
        globalActiveExclusions.has(kwNormalized)
      ) {
        toDeleteIds.push(s.id);
        continue;
      }

      // 2. If it's a campaign-specific pending card, but there is a pending global ('ALL') exclusion
      if (s.campaignId !== "ALL" && seenPending.has(`${kwNormalized}|ALL`)) {
        toDeleteIds.push(s.id);
        continue;
      }

      // 3. If it's a global ('ALL') pending card, and we already saw a local campaign pending card
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

      // 4. Standard duplicate checking
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
    }

    revalidatePath(`/accounts/${adAccountId}/negatives`);
    return { success: true, removedCount: toDeleteIds.length };
  } catch (error: any) {
    console.error("Deduplication error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Server action to manually add a negative keyword to campaign(s) in Google Ads.
 */
export async function addManualNegativeKeywordAction(
  adAccountId: number,
  campaignId: string, // campaign ID or "ALL"
  keyword: string,
  matchType: "broad" | "phrase" | "exact",
) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  const keywordClean = keyword.trim();
  if (!keywordClean) throw new Error("Keyword cannot be empty");

  try {
    const account = await db.query.adAccounts.findFirst({
      where: eq(adAccounts.id, adAccountId),
    });

    if (!account) {
      throw new Error("Ad account not found");
    }

    if (campaignId === "ALL") {
      const campaigns = await fetchAccountCampaigns(account.googleAccountId);
      for (const c of campaigns) {
        await addCampaignNegativeKeyword(
          account.googleAccountId,
          c.id,
          keywordClean,
          matchType,
        );
      }
    } else {
      await addCampaignNegativeKeyword(
        account.googleAccountId,
        campaignId,
        keywordClean,
        matchType,
      );
    }

    let campaignName = "All Campaigns";
    if (campaignId !== "ALL") {
      const campaigns = await fetchAccountCampaigns(account.googleAccountId);
      const matched = campaigns.find((c: any) => c.id === campaignId);
      campaignName = matched ? matched.name : "Manual Campaign Exclusion";
    }

    // Insert approved suggestion record in DB
    const [inserted] = await db
      .insert(negativeKeywordSuggestions)
      .values({
        adAccountId,
        keyword: keywordClean,
        matchType,
        campaignId,
        campaignName,
        rationale: "Manually added by user",
        status: "approved",
        searchQuery: "Manual addition",
        clicks: 0,
        impressions: 0,
        spend: "0",
        conversions: "0",
        processedAt: new Date(),
      })
      .returning();

    // Audit log
    await logAction(
      session.user.id,
      "ADD_MANUAL_NEGATIVE_KEYWORD",
      "negative_keyword_suggestions",
      inserted.id,
      { keyword: keywordClean, campaignId, matchType },
    );

    revalidatePath(`/accounts/${adAccountId}/negatives`);
    return { success: true };
  } catch (error: any) {
    console.error("Failed to manually add negative keyword:", error);
    return {
      success: false,
      error: error.message || "Failed to add negative keyword",
    };
  }
}

/**
 * Server action to get all active campaigns for a client account.
 */
export async function getAccountCampaignsAction(adAccountId: number) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  try {
    const account = await db.query.adAccounts.findFirst({
      where: eq(adAccounts.id, adAccountId),
    });

    if (!account) {
      throw new Error("Ad account not found");
    }

    const campaigns = await fetchAccountCampaigns(account.googleAccountId);
    return { success: true, data: campaigns };
  } catch (error: any) {
    console.error("Failed to fetch campaigns list:", error);
    return {
      success: false,
      error: error.message || "Failed to retrieve campaign list",
    };
  }
}

/**
 * Server action to save account persona details (target notes).
 */
export async function saveAccountPersonaAction(
  accountId: number,
  targetNotes: string,
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) throw new Error("Unauthorized");

    await db
      .update(adAccounts)
      .set({ targetNotes })
      .where(eq(adAccounts.id, accountId));

    await logAction(
      session.user.id,
      "SAVE_ACCOUNT_PERSONA",
      "ad_accounts",
      accountId,
      { targetNotes },
    );

    revalidatePath(`/accounts/${accountId}/negatives`);

    return { success: true };
  } catch (error: any) {
    console.error("saveAccountPersonaAction error:", error);
    return { success: false, error: error.message };
  }
}
