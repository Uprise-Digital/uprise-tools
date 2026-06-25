// app/api/mcp/[transport]/route.ts
import { z } from "zod";
import { createMcpHandler, experimental_withMcpAuth } from "mcp-handler";
import { getOrGenerateAgencyAiInsightsAction, getAgencyPortfolioMetricsAction } from "@/actions/agency.actions";
import { db } from "@/db";
import { mcpSettings } from "@/db/schema";
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
                // Step 1: Fetch real portfolio data
                const portfolioRes = await getAgencyPortfolioMetricsAction(startDate, endDate);

                if (!portfolioRes.success || !portfolioRes.data) {
                    return {
                        content: [{ type: "text", text: JSON.stringify({ error: "Failed to fetch portfolio data." }) }],
                    };
                }

                // Step 2: Feed portfolio into the AI insights engine
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