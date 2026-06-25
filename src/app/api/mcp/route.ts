// app/api/mcp/route.ts
import { z } from "zod";
import { createMcpHandler } from "mcp-handler";
import { getOrGenerateAgencyAiInsightsAction } from "@/actions/agency.actions";
import { db } from "@/db"; // Ensure this path matches your setup
import { mcpSettings } from "@/db/schema";
import { eq } from "drizzle-orm";

const handler = createMcpHandler((server) => {
    server.tool(
        "get_agency_god_view",
        "Fetches macro portfolio performance and identifies critical fires.",
        { startDate: z.string(), endDate: z.string() },
        async ({ startDate, endDate }) => {
            const result = await getOrGenerateAgencyAiInsightsAction(startDate, endDate, {});
            return {
                content: [{ type: "text", text: JSON.stringify(result.data) }],
            };
        }
    );
});

const authMiddleware = async (req: Request) => {
    const url = new URL(req.url);
    const tokenFromUrl = url.searchParams.get("key");
    const authHeader = req.headers.get("Authorization");

    const providedKey = tokenFromUrl || (authHeader ? authHeader.replace("Bearer ", "") : null);

    if (!providedKey) {
        return new Response("Unauthorized: No key provided", { status: 401 });
    }

    // SOURCE OF TRUTH: Verify the key against the Database
    const validSettings = await db.query.mcpSettings.findFirst({
        where: eq(mcpSettings.apiKey, providedKey)
    });

    if (!validSettings) {
        return new Response("Unauthorized: Invalid MCP API Key", { status: 401 });
    }

    // Optional: You could pass the agencyId from validSettings into your handler here
    // if your agency.actions need to know WHICH agency is making the request.

    return handler(req);
};

export const GET = authMiddleware;
export const POST = authMiddleware;
export const OPTIONS = authMiddleware;