// app/api/mcp/[transport]/route.ts

import { eq } from "drizzle-orm";
import { createMcpHandler, experimental_withMcpAuth } from "mcp-handler";
import { z } from "zod";
import { setAccountTargetsMcpAction } from "@/actions/account-targets.actions";
import {
  getAccountAnomaliesAction,
  getAccountByIdAction,
  getAccountByNameAction,
  getAccountTargetsAction,
  getAgencyPortfolioMetricsAction,
  getCampaignDetailsAction,
  getConcentrationReportAction,
  getHistoricalComparisonAction,
  getOrGenerateAgencyAiInsightsAction,
  getSearchTermInsightsAction,
  listAccountsAction,
} from "@/actions/agency.actions";
import { getDashboardMetricsAction } from "@/actions/dashboard.actions";
import { generateSuggestionsInternal } from "@/actions/negative-keywords.actions";
import {
  getAccountTriageSettingsAction,
  getOrgTriageDefaultsAction,
} from "@/actions/triage-settings.actions";
import { db } from "@/db";
import {
  accountTriageSettings,
  adAccounts,
  mcpSettings,
  negativeKeywordSuggestions,
  orgTriageDefaults,
} from "@/db/schema";
import { logAction } from "@/lib/audit";
import {
  addCampaignNegativeKeyword,
  fetchAccountCampaigns,
  fetchActiveNegativeKeywords,
} from "@/lib/google-ads";

const handler = createMcpHandler(
  (server) => {
    server.registerTool(
      "get_agency_god_view",
      {
        title: "Agency God View",
        description:
          "Fetches macro portfolio performance and identifies critical fires.",
        inputSchema: {
          startDate: z.string().describe("Start date in YYYY-MM-DD format"),
          endDate: z.string().describe("End date in YYYY-MM-DD format"),
        },
      },
      async ({ startDate, endDate }) => {
        const portfolioRes = await getAgencyPortfolioMetricsAction(
          startDate,
          endDate,
        );

        if (!portfolioRes.success || !portfolioRes.data) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  error: "Failed to fetch portfolio data.",
                }),
              },
            ],
          };
        }

        const result = await getOrGenerateAgencyAiInsightsAction(
          startDate,
          endDate,
          portfolioRes.data,
        );

        return {
          content: [{ type: "text", text: JSON.stringify(result.data) }],
        };
      },
    );

    server.registerTool(
      "get_account_metrics",
      {
        title: "Account Metrics",
        description:
          "Fetches detailed dashboard metrics for a specific ad account by its internal ID.",
        inputSchema: {
          accountId: z
            .number()
            .describe("The internal database ID of the ad account"),
          startDate: z.string().describe("Start date in YYYY-MM-DD format"),
          endDate: z.string().describe("End date in YYYY-MM-DD format"),
        },
      },
      async ({ accountId, startDate, endDate }) => {
        const account = await db.query.adAccounts.findFirst({
          where: eq(adAccounts.id, accountId),
        });

        if (!account) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  error: `No account found with ID ${accountId}.`,
                }),
              },
            ],
          };
        }

        const result = await getDashboardMetricsAction(
          account.id,
          account.googleAccountId,
          startDate,
          endDate,
        );

        if (!result.success || !result.data) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  error: "Failed to fetch account metrics.",
                }),
              },
            ],
          };
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                account: {
                  id: account.id,
                  name: account.name,
                  currencyCode: account.currencyCode,
                },
                metrics: result.data,
              }),
            },
          ],
        };
      },
    );

    server.registerTool(
      "lookup_account_by_name",
      {
        title: "Lookup Account by Name",
        description:
          "Searches for ad accounts by name (partial match). Use this to find an account's internal ID before calling get_account_metrics.",
        inputSchema: {
          name: z
            .string()
            .describe("Full or partial account name to search for"),
        },
      },
      async ({ name }) => {
        const result = await getAccountByNameAction(name);

        if (!result.success || !result.data) {
          return {
            content: [
              { type: "text", text: JSON.stringify({ error: result.error }) },
            ],
          };
        }

        return {
          content: [{ type: "text", text: JSON.stringify(result.data) }],
        };
      },
    );

    server.registerTool(
      "lookup_account_by_id",
      {
        title: "Lookup Account by ID",
        description:
          "Fetches account name and details for a given internal account ID.",
        inputSchema: {
          accountId: z
            .number()
            .describe("The internal database ID of the ad account"),
        },
      },
      async ({ accountId }) => {
        const result = await getAccountByIdAction(accountId);

        if (!result.success || !result.data) {
          return {
            content: [
              { type: "text", text: JSON.stringify({ error: result.error }) },
            ],
          };
        }

        return {
          content: [{ type: "text", text: JSON.stringify(result.data) }],
        };
      },
    );

    server.registerTool(
      "list_accounts",
      {
        title: "List All Accounts",
        description:
          "Returns all ad accounts in the system with their internal IDs, names, Google account IDs, currency, and active status. Use this to discover account IDs before calling other tools.",
        inputSchema: {},
      },
      async () => {
        const result = await listAccountsAction();

        if (!result.success || !result.data) {
          return {
            content: [
              { type: "text", text: JSON.stringify({ error: result.error }) },
            ],
          };
        }

        return {
          content: [{ type: "text", text: JSON.stringify(result.data) }],
        };
      },
    );

    server.registerTool(
      "get_historical_comparison",
      {
        title: "Historical Period Comparison",
        description:
          "Compares an account's performance for a given date range against the equivalent prior period of the same length. Returns both periods' metrics side-by-side with percentage deltas for spend, clicks, impressions, conversions, CPA, CTR, and conversion rate.",
        inputSchema: {
          accountId: z
            .number()
            .describe("The internal database ID of the ad account"),
          startDate: z
            .string()
            .describe("Start date of the CURRENT period in YYYY-MM-DD format"),
          endDate: z
            .string()
            .describe("End date of the CURRENT period in YYYY-MM-DD format"),
        },
      },
      async ({ accountId, startDate, endDate }) => {
        const result = await getHistoricalComparisonAction(
          accountId,
          startDate,
          endDate,
        );

        if (!result.success || !result.data) {
          return {
            content: [
              { type: "text", text: JSON.stringify({ error: result.error }) },
            ],
          };
        }

        return {
          content: [{ type: "text", text: JSON.stringify(result.data) }],
        };
      },
    );

    server.registerTool(
      "get_search_term_insights",
      {
        title: "Search Term Insights",
        description:
          "Returns the top search terms driving spend for an account, segmented into converting terms and wasted spend terms (spend with zero conversions). Includes a summary of total wasted spend and percentage. Useful for negative keyword identification and budget leak analysis.",
        inputSchema: {
          accountId: z
            .number()
            .describe("The internal database ID of the ad account"),
          startDate: z.string().describe("Start date in YYYY-MM-DD format"),
          endDate: z.string().describe("End date in YYYY-MM-DD format"),
          limit: z
            .number()
            .optional()
            .describe("Max search terms to return (default 20, max 50)"),
        },
      },
      async ({ accountId, startDate, endDate, limit }) => {
        const result = await getSearchTermInsightsAction(
          accountId,
          startDate,
          endDate,
          limit,
        );

        if (!result.success || !result.data) {
          return {
            content: [
              { type: "text", text: JSON.stringify({ error: result.error }) },
            ],
          };
        }

        return {
          content: [{ type: "text", text: JSON.stringify(result.data) }],
        };
      },
    );

    server.registerTool(
      "get_campaign_details",
      {
        title: "Campaign Settings & Details",
        description:
          "Returns configuration details for all campaigns in an account — bidding strategy, daily budget, campaign type, status, target CPA/ROAS set in Google Ads, geo targets, and flight dates. Does not require a date range. Use this to diagnose structural issues (wrong bidding strategy, missing geo targets, etc.) rather than performance issues.",
        inputSchema: {
          accountId: z
            .number()
            .describe("The internal database ID of the ad account"),
        },
      },
      async ({ accountId }) => {
        const result = await getCampaignDetailsAction(accountId);

        if (!result.success || !result.data) {
          return {
            content: [
              { type: "text", text: JSON.stringify({ error: result.error }) },
            ],
          };
        }

        return {
          content: [{ type: "text", text: JSON.stringify(result.data) }],
        };
      },
    );

    server.registerTool(
      "get_account_anomalies",
      {
        title: "Account Anomaly Detection",
        description:
          "Detects statistically significant deviations in an account's recent performance (last 7 days) compared to its own historical baseline. Flags anomalies in spend, conversions, CPA, and CTR with severity ratings. Unlike the god view which compares accounts against portfolio averages, this tool benchmarks each account against its own history.",
        inputSchema: {
          accountId: z
            .number()
            .describe("The internal database ID of the ad account"),
          lookbackDays: z
            .number()
            .optional()
            .describe(
              "Number of days to use as the historical baseline window (default 30). Must have data in adPerformanceDaily for this period.",
            ),
        },
      },
      async ({ accountId, lookbackDays }) => {
        const result = await getAccountAnomaliesAction(accountId, lookbackDays);

        if (!result.success) {
          return {
            content: [
              { type: "text", text: JSON.stringify({ error: result.error }) },
            ],
          };
        }

        return {
          content: [{ type: "text", text: JSON.stringify(result.data) }],
        };
      },
    );

    server.registerTool(
      "get_concentration_report",
      {
        title: "Portfolio Concentration Report",
        description:
          "Returns a quantified analysis of revenue concentration risk across the agency portfolio. Includes HHI (Herfindahl-Hirschman Index) score with interpretation, whale account identification, top-5 spend share, revenue at risk, and period-over-period HHI trend to show whether concentration is improving or worsening.",
        inputSchema: {
          startDate: z.string().describe("Start date in YYYY-MM-DD format"),
          endDate: z.string().describe("End date in YYYY-MM-DD format"),
        },
      },
      async ({ startDate, endDate }) => {
        const result = await getConcentrationReportAction(startDate, endDate);

        if (!result.success || !result.data) {
          return {
            content: [
              { type: "text", text: JSON.stringify({ error: result.error }) },
            ],
          };
        }

        return {
          content: [{ type: "text", text: JSON.stringify(result.data) }],
        };
      },
    );

    server.registerTool(
      "get_account_targets",
      {
        title: "Account KPI Targets",
        description:
          "Returns the agreed KPI targets for an account — target CPA, target ROAS, and monthly budget cap. These are stored internally (not pulled from Google Ads) and represent what was agreed with the client. Use these to assess whether actual performance is on-target rather than comparing against portfolio averages. Returns a warning if no targets have been configured for the account yet.",
        inputSchema: {
          accountId: z
            .number()
            .describe("The internal database ID of the ad account"),
        },
      },
      async ({ accountId }) => {
        const result = await getAccountTargetsAction(accountId);

        if (!result.success || !result.data) {
          return {
            content: [
              { type: "text", text: JSON.stringify({ error: result.error }) },
            ],
          };
        }

        return {
          content: [{ type: "text", text: JSON.stringify(result.data) }],
        };
      },
    );

    server.registerTool(
      "get_org_triage_defaults",
      {
        title: "Get Organization Triage Defaults",
        description:
          "Fetches the organization-wide defaults for alert and anomaly triage thresholds.",
        inputSchema: {},
      },
      async () => {
        const result = await getOrgTriageDefaultsAction();

        if (!result.success || !result.data) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  error:
                    result.error ||
                    "Failed to fetch organization triage defaults.",
                }),
              },
            ],
          };
        }

        return {
          content: [{ type: "text", text: JSON.stringify(result.data) }],
        };
      },
    );

    server.registerTool(
      "get_account_triage_settings",
      {
        title: "Get Account Triage Settings",
        description:
          "Fetches the triage threshold override settings for a specific client account by its internal ID.",
        inputSchema: {
          accountId: z
            .number()
            .describe("The internal database ID of the ad account"),
        },
      },
      async ({ accountId }) => {
        const result = await getAccountTriageSettingsAction(accountId);

        if (!result.success) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  error:
                    result.error ||
                    `Failed to fetch triage settings for account ${accountId}.`,
                }),
              },
            ],
          };
        }

        return {
          content: [{ type: "text", text: JSON.stringify(result.data) }],
        };
      },
    );

    server.registerTool(
      "set_org_triage_defaults",
      {
        title: "Set Organization Triage Defaults",
        description:
          "Sets/updates the organization-wide defaults for alert and anomaly triage thresholds. All parameters are required.",
        inputSchema: {
          criticalSpendThreshold: z
            .number()
            .positive()
            .describe(
              "Critical spend threshold above which alerts trigger if conversions are low (e.g. 70.0)",
            ),
          criticalConversionsThreshold: z
            .number()
            .int()
            .nonnegative()
            .describe(
              "Upper limit of conversions to count as critical leak (e.g. 0)",
            ),
          ctrHighThreshold: z
            .number()
            .positive()
            .describe("CTR threshold percentage (e.g. 7.0)"),
          ctrHighSpendThreshold: z
            .number()
            .positive()
            .describe("Minimum spend to trigger high CTR check (e.g. 50.0)"),
          cpcHighThreshold: z
            .number()
            .positive()
            .describe("High CPC limit (e.g. 30.0)"),
          anomalySpendChangeThreshold: z
            .number()
            .max(0)
            .describe(
              "Percentage drop in spend for anomaly warning (must be <= 0, e.g. -30.0)",
            ),
          anomalyConversionsChangeThreshold: z
            .number()
            .max(0)
            .describe(
              "Percentage drop in conversions for anomaly warning (must be <= 0, e.g. -25.0)",
            ),
        },
      },
      async (data) => {
        try {
          const payload = {
            criticalSpendThreshold: data.criticalSpendThreshold,
            criticalConversionsThreshold: data.criticalConversionsThreshold,
            ctrHighThreshold: data.ctrHighThreshold,
            ctrHighSpendThreshold: data.ctrHighSpendThreshold,
            cpcHighThreshold: data.cpcHighThreshold,
            anomalySpendChangeThreshold: data.anomalySpendChangeThreshold,
            anomalyConversionsChangeThreshold:
              data.anomalyConversionsChangeThreshold,
            updatedAt: new Date(),
          };

          const existing = await db.query.orgTriageDefaults.findFirst();
          let savedId: number;

          if (existing) {
            await db
              .update(orgTriageDefaults)
              .set(payload)
              .where(eq(orgTriageDefaults.id, existing.id));
            savedId = existing.id;
          } else {
            const [newDefaults] = await db
              .insert(orgTriageDefaults)
              .values(payload)
              .returning();
            savedId = newDefaults.id;
          }

          await logAction(
            "MCP_AGENT",
            "SAVE_ORG_TRIAGE_DEFAULTS",
            "org_triage_defaults",
            savedId,
            payload,
          );

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  success: true,
                  message:
                    "Organization-wide triage defaults saved successfully.",
                  data: { id: savedId, ...data },
                }),
              },
            ],
          };
        } catch (error) {
          const errorMessage =
            error instanceof Error
              ? error.message
              : "An error occurred while saving organization defaults.";
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  success: false,
                  error: errorMessage,
                }),
              },
            ],
          };
        }
      },
    );

    server.registerTool(
      "set_account_triage_settings",
      {
        title: "Set Account Triage Settings",
        description:
          "Sets/updates the custom triage threshold override settings for a specific client account. Set fields to null to clear overrides.",
        inputSchema: {
          accountId: z
            .number()
            .int()
            .positive()
            .describe("The internal database ID of the ad account"),
          criticalSpendThreshold: z
            .number()
            .positive()
            .nullable()
            .optional()
            .describe("Override for critical spend limit"),
          criticalConversionsThreshold: z
            .number()
            .int()
            .nonnegative()
            .nullable()
            .optional()
            .describe("Override for max conversions target"),
          ctrHighThreshold: z
            .number()
            .positive()
            .nullable()
            .optional()
            .describe("Override for CTR anomaly limit (%)"),
          ctrHighSpendThreshold: z
            .number()
            .positive()
            .nullable()
            .optional()
            .describe("Override for min spend for CTR anomaly"),
          cpcHighThreshold: z
            .number()
            .positive()
            .nullable()
            .optional()
            .describe("Override for high CPC limit"),
          anomalySpendChangeThreshold: z
            .number()
            .max(0)
            .nullable()
            .optional()
            .describe("Override for spend drop threshold (%)"),
          anomalyConversionsChangeThreshold: z
            .number()
            .max(0)
            .nullable()
            .optional()
            .describe("Override for conversions drop threshold (%)"),
        },
      },
      async ({ accountId, ...data }) => {
        try {
          // Safety Precaution: Verify that the account exists before modifying its configuration
          const account = await db.query.adAccounts.findFirst({
            where: eq(adAccounts.id, accountId),
          });

          if (!account) {
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify({
                    success: false,
                    error: `No ad account found with ID ${accountId}.`,
                  }),
                },
              ],
            };
          }

          const payload = {
            adAccountId: accountId,
            criticalSpendThreshold:
              data.criticalSpendThreshold !== undefined
                ? data.criticalSpendThreshold
                : null,
            criticalConversionsThreshold:
              data.criticalConversionsThreshold !== undefined
                ? data.criticalConversionsThreshold
                : null,
            ctrHighThreshold:
              data.ctrHighThreshold !== undefined
                ? data.ctrHighThreshold
                : null,
            ctrHighSpendThreshold:
              data.ctrHighSpendThreshold !== undefined
                ? data.ctrHighSpendThreshold
                : null,
            cpcHighThreshold:
              data.cpcHighThreshold !== undefined
                ? data.cpcHighThreshold
                : null,
            anomalySpendChangeThreshold:
              data.anomalySpendChangeThreshold !== undefined
                ? data.anomalySpendChangeThreshold
                : null,
            anomalyConversionsChangeThreshold:
              data.anomalyConversionsChangeThreshold !== undefined
                ? data.anomalyConversionsChangeThreshold
                : null,
            updatedAt: new Date(),
          };

          const existing = await db.query.accountTriageSettings.findFirst({
            where: eq(accountTriageSettings.adAccountId, accountId),
          });
          let savedId: number;

          if (existing) {
            await db
              .update(accountTriageSettings)
              .set(payload)
              .where(eq(accountTriageSettings.id, existing.id));
            savedId = existing.id;
          } else {
            const [newSettings] = await db
              .insert(accountTriageSettings)
              .values(payload)
              .returning();
            savedId = newSettings.id;
          }

          await logAction(
            "MCP_AGENT",
            "SAVE_ACCOUNT_TRIAGE_SETTINGS",
            "account_triage_settings",
            savedId,
            payload,
          );

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  success: true,
                  message: `Triage override settings for account ${account.name} (ID: ${accountId}) saved successfully.`,
                  data: { id: savedId, ...data },
                }),
              },
            ],
          };
        } catch (error) {
          const errorMessage =
            error instanceof Error
              ? error.message
              : `An error occurred while saving triage overrides for account ${accountId}.`;
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  success: false,
                  error: errorMessage,
                }),
              },
            ],
          };
        }
      },
    );

    server.registerTool(
      "set_account_targets",
      {
        title: "Set Account KPI Targets",
        description:
          "Sets or updates the agreed client KPI targets for an account — target CPA, target ROAS, monthly budget cap, and notes. These are stored internally and represent what was agreed with the client (not pulled from Google Ads). Setting these unlocks target-relative fire detection in the god view, replacing portfolio-average benchmarking with actual client-agreed KPIs. Also invalidates the agency god view cache so the next call reflects the new targets immediately.",
        inputSchema: {
          accountId: z
            .number()
            .int()
            .positive()
            .describe("The internal database ID of the ad account"),
          targetCpa: z
            .number()
            .positive()
            .nullable()
            .optional()
            .describe(
              "Agreed target cost-per-acquisition in the account's currency. Set to null to clear.",
            ),
          targetRoas: z
            .number()
            .positive()
            .nullable()
            .optional()
            .describe(
              "Agreed target return-on-ad-spend as a multiplier (e.g. 4.0 = 400% ROAS). Set to null to clear.",
            ),
          monthlyBudgetCap: z
            .number()
            .positive()
            .nullable()
            .optional()
            .describe(
              "Agreed monthly budget cap in the account's currency. Set to null to clear.",
            ),
          targetNotes: z
            .string()
            .nullable()
            .optional()
            .describe(
              "Free-text notes about client targets or agreements (e.g. 'Client happy with $150 CPA, reviewing Q3'). Set to null to clear.",
            ),
        },
      },
      async ({
        accountId,
        targetCpa,
        targetRoas,
        monthlyBudgetCap,
        targetNotes,
      }) => {
        const result = await setAccountTargetsMcpAction(accountId, {
          targetCpa: targetCpa ?? null,
          targetRoas: targetRoas ?? null,
          monthlyBudgetCap: monthlyBudgetCap ?? null,
          targetNotes: targetNotes ?? null,
        });

        if (!result.success) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  success: false,
                  error: result.error,
                }),
              },
            ],
          };
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result),
            },
          ],
        };
      },
    );

    server.registerTool(
      "get_negative_keyword_suggestions",
      {
        title: "Get Negative Keyword Suggestions",
        description:
          "Fetches all negative keyword suggestions (pending, approved, denied, archived) for an account.",
        inputSchema: {
          accountId: z
            .number()
            .describe("The internal database ID of the ad account"),
        },
      },
      async ({ accountId }) => {
        try {
          const suggestions =
            await db.query.negativeKeywordSuggestions.findMany({
              where: eq(negativeKeywordSuggestions.adAccountId, accountId),
              orderBy: (table, { desc }) => [desc(table.suggestedAt)],
            });
          return {
            content: [{ type: "text", text: JSON.stringify(suggestions) }],
          };
        } catch (error: any) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  success: false,
                  error: error.message || "Failed to fetch suggestions",
                }),
              },
            ],
          };
        }
      },
    );

    server.registerTool(
      "generate_negative_keyword_suggestions",
      {
        title: "Generate Negative Keyword Suggestions",
        description:
          "Pulls search terms and active keywords from Google Ads, runs AI analysis via Gemini to find waste, and saves pending recommendations to the database.",
        inputSchema: {
          accountId: z
            .number()
            .describe("The internal database ID of the ad account"),
          startDate: z
            .string()
            .optional()
            .describe("Start date in YYYY-MM-DD format (optional)"),
          endDate: z
            .string()
            .optional()
            .describe("End date in YYYY-MM-DD format (optional)"),
        },
      },
      async ({ accountId, startDate, endDate }) => {
        try {
          const res = await generateSuggestionsInternal(
            accountId,
            startDate,
            endDate,
            "MCP_TOOL_AUTOMATION",
          );
          return {
            content: [
              { type: "text", text: JSON.stringify({ success: true, ...res }) },
            ],
          };
        } catch (error: any) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  success: false,
                  error: error.message || "Failed to generate suggestions",
                }),
              },
            ],
          };
        }
      },
    );

    server.registerTool(
      "add_negative_keyword",
      {
        title: "Add Negative Keyword",
        description:
          "Applies/pushes a campaign-level negative keyword directly to Google Ads and marks it as approved in the database.",
        inputSchema: {
          accountId: z
            .number()
            .describe("The internal database ID of the ad account"),
          campaignId: z
            .string()
            .describe(
              "The Google Ads Campaign ID to add the negative keyword to",
            ),
          keyword: z.string().describe("The negative keyword text to add"),
          matchType: z
            .enum(["broad", "phrase", "exact"])
            .describe("The match type: 'broad', 'phrase', or 'exact'"),
          suggestionId: z
            .number()
            .optional()
            .describe(
              "Optional database suggestion ID if resolving an existing pending card",
            ),
        },
      },
      async ({ accountId, campaignId, keyword, matchType, suggestionId }) => {
        try {
          const account = await db.query.adAccounts.findFirst({
            where: eq(adAccounts.id, accountId),
          });

          if (!account) {
            throw new Error(`Ad account with ID ${accountId} not found.`);
          }

          // Push to Google Ads campaign
          if (campaignId === "ALL") {
            const campaigns = await fetchAccountCampaigns(
              account.googleAccountId,
            );
            for (const c of campaigns) {
              await addCampaignNegativeKeyword(
                account.googleAccountId,
                c.id,
                keyword,
                matchType,
              );
            }
          } else {
            await addCampaignNegativeKeyword(
              account.googleAccountId,
              campaignId,
              keyword,
              matchType,
            );
          }

          let campaignName = "Manual Campaign Exclusion";
          if (campaignId === "ALL") {
            campaignName = "All Campaigns";
          } else {
            try {
              const campaigns = await fetchAccountCampaigns(
                account.googleAccountId,
              );
              const matched = campaigns.find((c: any) => c.id === campaignId);
              if (matched) campaignName = matched.name;
            } catch (err) {
              console.error(
                "Failed to fetch campaign name for audit log:",
                err,
              );
            }
          }

          if (suggestionId) {
            // Update suggestion status to approved
            await db
              .update(negativeKeywordSuggestions)
              .set({
                status: "approved",
                matchType: matchType,
                processedAt: new Date(),
                error: null,
              })
              .where(eq(negativeKeywordSuggestions.id, suggestionId));
          } else {
            // Insert a direct approved record in DB
            await db.insert(negativeKeywordSuggestions).values({
              adAccountId: accountId,
              keyword,
              matchType,
              campaignId,
              campaignName,
              rationale: "Directly added via AI chat",
              status: "approved",
              searchQuery: "Manual addition",
              processedAt: new Date(),
            });
          }

          await logAction(
            "mcp-user",
            "ADD_NEGATIVE_KEYWORD",
            "negative_keyword_suggestions",
            accountId,
            { keyword, campaignId, matchType },
          );

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  success: true,
                  message: `Successfully added negative keyword "${keyword}" to campaign ${campaignId}.`,
                }),
              },
            ],
          };
        } catch (error: any) {
          if (suggestionId) {
            try {
              await db
                .update(negativeKeywordSuggestions)
                .set({
                  error: error.message || "Failed to push via MCP tool.",
                })
                .where(eq(negativeKeywordSuggestions.id, suggestionId));
            } catch (dbErr) {
              console.error("Failed to log error on suggestion:", dbErr);
            }
          }
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  success: false,
                  error: error.message || "Failed to add negative keyword",
                }),
              },
            ],
          };
        }
      },
    );

    server.registerTool(
      "get_active_negative_keywords",
      {
        title: "Get Active Negative Keywords",
        description:
          "Fetches campaign-level negative keywords that are currently active in Google Ads for a specific account.",
        inputSchema: {
          accountId: z
            .number()
            .describe("The internal database ID of the ad account"),
        },
      },
      async ({ accountId }) => {
        try {
          const account = await db.query.adAccounts.findFirst({
            where: eq(adAccounts.id, accountId),
          });

          if (!account) {
            throw new Error(`Ad account with ID ${accountId} not found.`);
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

          return {
            content: [{ type: "text", text: JSON.stringify(formatted) }],
          };
        } catch (error: any) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  success: false,
                  error:
                    error.message || "Failed to fetch active negative keywords",
                }),
              },
            ],
          };
        }
      },
    );

    server.registerTool(
      "get_account_persona",
      {
        title: "Get Account Persona & Business Scope",
        description:
          "Fetches the structured buyer persona, targeting intent, and scope defaults for a given ad account.",
        inputSchema: {
          accountId: z
            .number()
            .describe("The internal database ID of the ad account"),
        },
      },
      async ({ accountId }) => {
        try {
          const account = await db.query.adAccounts.findFirst({
            where: eq(adAccounts.id, accountId),
          });

          if (!account) {
            throw new Error(`Ad account with ID ${accountId} not found.`);
          }

          let persona = null;
          if (account.targetNotes) {
            try {
              persona = JSON.parse(account.targetNotes);
            } catch {
              persona = { rawNotes: account.targetNotes };
            }
          }

          return {
            content: [{ type: "text", text: JSON.stringify(persona || { message: "No persona configured yet." }) }],
          };
        } catch (error: any) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  success: false,
                  error: error.message || "Failed to fetch account persona",
                }),
              },
            ],
          };
        }
      },
    );

    server.registerTool(
      "set_account_persona",
      {
        title: "Set Account Persona & Business Scope",
        description:
          "Sets or updates the structured buyer persona and targeting intent notes for a given ad account in the database.",
        inputSchema: {
          accountId: z
            .number()
            .describe("The internal database ID of the ad account"),
          targetBuyer: z
            .string()
            .describe("Description of the ideal target buyer (e.g. IT managers, CISOs at Australian businesses)"),
          notTargetBuyer: z
            .string()
            .describe("Description of who is NOT a target buyer (e.g. students, researchers, seekers of free templates)"),
          serviceScope: z
            .array(z.string())
            .describe("List of services in scope"),
          outOfScope: z
            .array(z.string())
            .describe("List of out-of-scope services or concepts to block"),
          convertingIntentSignals: z
            .array(z.string())
            .describe("List of terms indicating commercial/converting intent"),
          researchIntentSignals: z
            .array(z.string())
            .describe("List of terms indicating pure informational or research intent"),
        },
      },
      async ({
        accountId,
        targetBuyer,
        notTargetBuyer,
        serviceScope,
        outOfScope,
        convertingIntentSignals,
        researchIntentSignals,
      }) => {
        try {
          const account = await db.query.adAccounts.findFirst({
            where: eq(adAccounts.id, accountId),
          });

          if (!account) {
            throw new Error(`Ad account with ID ${accountId} not found.`);
          }

          const personaData = {
            targetBuyer,
            notTargetBuyer,
            serviceScope,
            outOfScope,
            convertingIntentSignals,
            researchIntentSignals,
          };

          const personaString = JSON.stringify(personaData);

          await db
            .update(adAccounts)
            .set({ targetNotes: personaString })
            .where(eq(adAccounts.id, accountId));

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  success: true,
                  message: "Account buyer persona updated successfully.",
                  persona: personaData,
                }),
              },
            ],
          };
        } catch (error: any) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  success: false,
                  error: error.message || "Failed to update account persona",
                }),
              },
            ],
          };
        }
      },
    );
  },
  {},
  {
    basePath: "/api/mcp",
    maxDuration: 60,
    verboseLogs: true,
  },
);

const authHandler = experimental_withMcpAuth(
  handler,
  async (req, bearerToken) => {
    const url = new URL(req.url);
    const keyFromUrl = url.searchParams.get("key");
    const token = bearerToken || keyFromUrl;

    if (!token) return undefined;

    const validSettings = await db.query.mcpSettings.findFirst({
      where: eq(mcpSettings.apiKey, token),
    });

    if (!validSettings) return undefined;

    return { token, clientId: "uprise-mcp", scopes: [] };
  },
  { required: true },
);

export { authHandler as GET, authHandler as POST, authHandler as DELETE };
