// app/api/mcp/[transport]/route.ts

import { eq } from "drizzle-orm";
import { createMcpHandler, experimental_withMcpAuth } from "mcp-handler";
import { z } from "zod";
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
import { db } from "@/db";
import { adAccounts, mcpSettings } from "@/db/schema";

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
