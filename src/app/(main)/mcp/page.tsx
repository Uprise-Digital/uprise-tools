import { Metadata } from "next";
import McpSettingsClient from "./pageClient";

export const metadata: Metadata = {
    title: "MCP Integration Settings | Agency God View",
    description: "Configure Claude Desktop Model Context Protocol (MCP) access for your agency.",
};

export default async function McpSettingsPage() {
    // ---------------------------------------------------------------------------
    // SERVER-SIDE DATA FETCHING (To implement later)
    // Here is where you would fetch the user's current MCP API key and tool
    // preferences from Drizzle to pass down to the client component as props.
    //
    // const session = await auth();
    // const mcpConfig = await db.query.mcpSettings.findFirst({
    //     where: eq(mcpSettings.agencyId, session.user.agencyId)
    // });
    // ---------------------------------------------------------------------------

    return (
        <main className="min-h-screen bg-slate-50 selection:bg-indigo-100 selection:text-indigo-900">
            {/*
              Pass your fetched server data as props here once connected to the DB:
              <McpSettingsClient initialApiKey={mcpConfig?.apiKey} initialTools={mcpConfig?.tools} />
            */}
            <McpSettingsClient />
        </main>
    );
}