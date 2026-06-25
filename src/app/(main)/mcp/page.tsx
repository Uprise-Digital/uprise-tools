// app/settings/mcp/page.tsx
import { getMcpSettingsAction } from "@/actions/mcp.actions";
import McpSettingsClient from "./pageClient";

export default async function McpSettingsPage() {
    const res = await getMcpSettingsAction();

    if (!res.success || !res.data) {
        return <div>Error loading MCP configuration.</div>;
    }

    return (
        <McpSettingsClient
            initialApiKey={res.data.apiKey}
            initialTools={res.data.toolsConfig as { godView: boolean, campaignDiagnostics: boolean }}
        />
    );
}