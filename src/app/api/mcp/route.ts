import { z } from "zod";
import { createMcpHandler } from "mcp-handler";
import { getOrGenerateAgencyAiInsightsAction } from "@/actions/agency.actions";

// 1. Create the MCP handler (this automatically initializes the McpServer internally)
const handler = createMcpHandler((server) => {

    // 2. Register your tools directly on the provided server instance
    server.tool(
        "get_agency_god_view",
        "Fetches macro portfolio performance and identifies critical fires.",
        { startDate: z.string(), endDate: z.string() },
        async ({ startDate, endDate }) => {
            // Because Claude doesn't have your frontend state,
            // we pass an empty object and let the server action fetch its own data.
            const result = await getOrGenerateAgencyAiInsightsAction(startDate, endDate, {});
            return {
                content: [{ type: "text", text: JSON.stringify(result.data) }],
            };
        }
    );

});

// 3. Wrap the handler with your Bearer token authentication
const authMiddleware = async (req: Request) => {
    const authHeader = req.headers.get("Authorization");

    // Ensure this matches the generated key in your UI (and your Railway environment variables)
    if (authHeader !== `Bearer ${process.env.MCP_API_KEY}`) {
        return new Response("Unauthorized MCP Access", { status: 401 });
    }

    // If authenticated, let the Vercel MCP handler process the request
    return handler(req);
};

// 4. Export standard Next.js route verbs
export const GET = authMiddleware;
export const POST = authMiddleware;
export const OPTIONS = authMiddleware;