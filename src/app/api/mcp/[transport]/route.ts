// app/api/mcp/[transport]/route.ts
import { z } from "zod";
import { createMcpHandler, experimental_withMcpAuth } from "mcp-handler";
import { getOrGenerateAgencyAiInsightsAction, getAgencyPortfolioMetricsAction } from "@/actions/agency.actions";
import { getDashboardMetricsAction } from "@/actions/dashboard.actions";
import { getAccountByNameAction, getAccountByIdAction } from "@/actions/agency.actions";
import { db } from "@/db";
import { mcpSettings, adAccounts } from "@/db/schema";
import { eq } from "drizzle-orm";

const handler = createMcpHandler(
    (server) => {
        server.registerTool(
            "get_agency_god_view",
            {
                title: "Agency God View",
                description: "Fetches macro portfolio performance and identifies critical fires.",
                inputSchema: {
                    startDate: z.string().describe("Start date in YYYY-MM-DD format"),
                    endDate: z.string().describe("End date in YYYY-MM-DD format"),
                },
            },
            async ({ startDate, endDate }) => {
                const portfolioRes = await getAgencyPortfolioMetricsAction(startDate, endDate);

                if (!portfolioRes.success || !portfolioRes.data) {
                    return {
                        content: [{ type: "text", text: JSON.stringify({ error: "Failed to fetch portfolio data." }) }],
                    };
                }

                const result = await getOrGenerateAgencyAiInsightsAction(
                    startDate,
                    endDate,
                    portfolioRes.data
                );

                return {
                    content: [{ type: "text", text: JSON.stringify(result.data) }],
                };
            }
        );

        server.registerTool(
            "get_account_metrics",
            {
                title: "Account Metrics",
                description: "Fetches detailed dashboard metrics for a specific ad account by its internal ID.",
                inputSchema: {
                    accountId: z.number().describe("The internal database ID of the ad account"),
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
                        content: [{ type: "text", text: JSON.stringify({ error: `No account found with ID ${accountId}.` }) }],
                    };
                }

                const result = await getDashboardMetricsAction(
                    account.id,
                    account.googleAccountId,
                    startDate,
                    endDate
                );

                if (!result.success || !result.data) {
                    return {
                        content: [{ type: "text", text: JSON.stringify({ error: "Failed to fetch account metrics." }) }],
                    };
                }

                return {
                    content: [{ type: "text", text: JSON.stringify({ account: { id: account.id, name: account.name, currencyCode: account.currencyCode }, metrics: result.data }) }],
                };
            }
        );

        server.registerTool(
            "lookup_account_by_name",
            {
                title: "Lookup Account by Name",
                description: "Searches for ad accounts by name (partial match). Use this to find an account's internal ID before calling get_account_metrics.",
                inputSchema: {
                    name: z.string().describe("Full or partial account name to search for"),
                },
            },
            async ({ name }) => {
                const result = await getAccountByNameAction(name);

                if (!result.success || !result.data) {
                    return {
                        content: [{ type: "text", text: JSON.stringify({ error: result.error }) }],
                    };
                }

                return {
                    content: [{ type: "text", text: JSON.stringify(result.data) }],
                };
            }
        );

        server.registerTool(
            "lookup_account_by_id",
            {
                title: "Lookup Account by ID",
                description: "Fetches account name and details for a given internal account ID.",
                inputSchema: {
                    accountId: z.number().describe("The internal database ID of the ad account"),
                },
            },
            async ({ accountId }) => {
                const result = await getAccountByIdAction(accountId);

                if (!result.success || !result.data) {
                    return {
                        content: [{ type: "text", text: JSON.stringify({ error: result.error }) }],
                    };
                }

                return {
                    content: [{ type: "text", text: JSON.stringify(result.data) }],
                };
            }
        );
    },
    {},
    {
        basePath: "/api/mcp",
        maxDuration: 60,
        verboseLogs: true,
    }
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
    { required: true }
);

export { authHandler as GET, authHandler as POST, authHandler as DELETE };