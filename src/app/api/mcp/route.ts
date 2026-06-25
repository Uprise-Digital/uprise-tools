// app/api/mcp/route.ts
import { z } from "zod";
import { createMcpHandler } from "mcp-handler";
import { getOrGenerateAgencyAiInsightsAction } from "@/actions/agency.actions";
import { db } from "@/db";
import { mcpSettings } from "@/db/schema";
import { eq } from "drizzle-orm";

const handler = createMcpHandler((server) => {
    // @ts-ignore - Bypassing the strict TS deprecation warning for the 4-arg signature.
    // This signature is still fully supported at runtime by the MCP engine.
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

// REQUIRED FOR CLAUDE WEB: Standard CORS Headers
const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, x-api-key",
};

const authMiddleware = async (req: Request) => {
    // 1. ALWAYS let CORS Preflight (OPTIONS) pass without authentication
    if (req.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: corsHeaders });
    }

    const url = new URL(req.url);
    const tokenFromUrl = url.searchParams.get("key");
    const authHeader = req.headers.get("Authorization");

    const providedKey = tokenFromUrl || (authHeader ? authHeader.replace("Bearer ", "") : null);

    // 2. Reject unauthorized requests, but include CORS headers so Claude can read the rejection
    if (!providedKey) {
        return new Response("Unauthorized: No key provided", { status: 401, headers: corsHeaders });
    }

    // 3. Verify against the Database (The Single Source of Truth)
    const validSettings = await db.query.mcpSettings.findFirst({
        where: eq(mcpSettings.apiKey, providedKey)
    });

    if (!validSettings) {
        return new Response("Unauthorized: Invalid MCP API Key", { status: 401, headers: corsHeaders });
    }

    // 4. Process the authorized request via the MCP Handler
    const response = await handler(req);

    // 5. Intercept the handler's response and attach the CORS headers to it
    const newHeaders = new Headers(response.headers);
    Object.entries(corsHeaders).forEach(([key, value]) => {
        newHeaders.set(key, value);
    });

    return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders,
    });
};

export const GET = authMiddleware;
export const POST = authMiddleware;
export const OPTIONS = authMiddleware;