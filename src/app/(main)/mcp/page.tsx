// app/settings/mcp/page.tsx
import { getMcpSettingsAction } from "@/actions/mcp.actions";
import McpSettingsClient from "./pageClient";

export default async function McpSettingsPage() {
  return <McpSettingsClient />;
}
