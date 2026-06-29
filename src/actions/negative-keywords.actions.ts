"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { db } from "@/db";
import { adAccounts, negativeKeywordSuggestions } from "@/db/schema";
import { logAction } from "@/lib/audit";
import { auth } from "@/lib/auth";
import {
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
      const metricsObj = row.metrics || {};

      return {
        query: stView.searchTerm || "",
        campaignId: campaignObj.id || "",
        campaignName: campaignObj.name || "",
        clicks: Number(metricsObj.clicks || 0),
        impressions: Number(metricsObj.impressions || 0),
        spend: Number(metricsObj.costMicros || 0) / 1_000_000,
        conversions: Number(metricsObj.conversions || 0),
      };
    })
    .filter((st: any) => st.query);

  // 4. Send to Gemini for negative keywords suggestions
  const suggestions = await generateNegativeKeywordSuggestions({
    clientName: account.name,
    websiteUrl: account.websiteUrl,
    targetNotes: account.targetNotes,
    searchTerms: formattedSearchTerms,
    existingNegatives: activeNegTextList,
  });

  // 5. Fetch existing suggestions in DB to prevent duplicates
  const existingDBSuggestions =
    await db.query.negativeKeywordSuggestions.findMany({
      where: eq(negativeKeywordSuggestions.adAccountId, adAccountId),
    });

  // Create a unique compound key for lookups: "keyword|campaignId|matchType"
  const existingDBKeySet = new Set(
    existingDBSuggestions.map(
      (s) =>
        `${s.keyword.toLowerCase().trim()}|${s.campaignId}|${s.matchType.toLowerCase()}`,
    ),
  );

  // Filter out any suggestion that is already in our DB
  const newSuggestions = suggestions.filter(
    (s) =>
      !existingDBKeySet.has(
        `${s.keyword.toLowerCase().trim()}|${s.campaignId}|${s.matchType.toLowerCase()}`,
      ),
  );

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

    if (status === "approved") {
      // Push to Google Ads
      console.log(
        `[Actions] User ${session.user.email} approved keyword "${suggestion.keyword}" (Match: ${finalMatchType}) for campaign ID ${suggestion.campaignId}`,
      );

      if (suggestion.campaignId === "ALL") {
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
      } else {
        await addCampaignNegativeKeyword(
          suggestion.account.googleAccountId,
          suggestion.campaignId,
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
