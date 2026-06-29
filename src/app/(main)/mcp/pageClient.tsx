"use client";

import {
  ActivitySquare,
  Bot,
  CheckCircle2,
  Copy,
  Database,
  Loader2,
  ShieldCheck,
  Terminal,
} from "lucide-react";
import { useState } from "react";
import { rollMcpApiKeyAction } from "@/actions/mcp.actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const AVAILABLE_TOOLS = [
  {
    name: "get_agency_god_view",
    title: "Agency God View",
    description:
      "Fetches macro portfolio performance and identifies critical fires.",
  },
  {
    name: "get_account_metrics",
    title: "Account Metrics",
    description:
      "Fetches detailed dashboard metrics for a specific ad account by its internal ID.",
  },
  {
    name: "lookup_account_by_name",
    title: "Lookup Account by Name",
    description:
      "Searches for ad accounts by name (partial match) to discover internal IDs.",
  },
  {
    name: "lookup_account_by_id",
    title: "Lookup Account by ID",
    description:
      "Fetches account name and details for a given internal account ID.",
  },
  {
    name: "list_accounts",
    title: "List All Accounts",
    description:
      "Returns all ad accounts in the system with their internal IDs, names, and active status.",
  },
  {
    name: "get_historical_comparison",
    title: "Historical Period Comparison",
    description:
      "Compares current performance against the prior period side-by-side with delta percentages.",
  },
  {
    name: "get_search_term_insights",
    title: "Search Term Insights",
    description:
      "Returns top search terms, converting terms, and wasted spend analysis.",
  },
  {
    name: "get_campaign_details",
    title: "Campaign Settings & Details",
    description:
      "Returns campaign configuration details, bidding strategies, budgets, and targeting settings.",
  },
  {
    name: "get_account_anomalies",
    title: "Account Anomaly Detection",
    description:
      "Detects statistically significant deviations in an account's recent performance.",
  },
  {
    name: "get_concentration_report",
    title: "Portfolio Concentration Report",
    description:
      "Returns a quantified analysis of revenue concentration risk (HHI) across the portfolio.",
  },
  {
    name: "get_account_targets",
    title: "Account KPI Targets",
    description:
      "Returns agreed client targets, such as target CPA, target ROAS, and budget caps.",
  },
  {
    name: "get_org_triage_defaults",
    title: "Get Organization Triage Defaults",
    description:
      "Fetches the organization-wide defaults for alert and anomaly triage thresholds.",
  },
  {
    name: "get_account_triage_settings",
    title: "Get Account Triage Settings",
    description:
      "Fetches the triage threshold override settings for a specific client account by its internal ID.",
  },
  {
    name: "set_org_triage_defaults",
    title: "Set Organization Triage Defaults",
    description:
      "Sets/updates the organization-wide defaults for alert and anomaly triage thresholds.",
  },
  {
    name: "set_account_triage_settings",
    title: "Set Account Triage Settings",
    description:
      "Sets/updates the custom triage threshold override settings for a specific client account. Set fields to null to clear overrides.",
  },
  {
    name: "set_account_targets",
    title: "Set Account KPI Targets",
    description:
      "Sets or updates the agreed client KPI targets for an account — target CPA, target ROAS, monthly budget cap, and notes.",
  },
  {
    name: "get_negative_keyword_suggestions",
    title: "Get Negative Keyword Suggestions",
    description:
      "Fetches all negative keyword suggestions (pending, approved, denied, archived) for a specific account.",
  },
  {
    name: "generate_negative_keyword_suggestions",
    title: "Generate Negative Keyword Suggestions",
    description:
      "Pulls search terms and active keywords from Google Ads, runs AI analysis via Gemini to discover waste, and saves pending recommendations.",
  },
  {
    name: "add_negative_keyword",
    title: "Add Negative Keyword",
    description:
      "Pushes a campaign-level negative keyword directly to Google Ads and marks it as approved in the database.",
  },
  {
    name: "get_active_negative_keywords",
    title: "Get Active Negative Keywords",
    description:
      "Fetches all campaign-level active negative keywords currently running in Google Ads for a specific account.",
  },
];

interface McpSettingsClientProps {
  initialApiKey: string;
}

export default function McpSettingsClient({
  initialApiKey,
}: McpSettingsClientProps) {
  const [isCopied, setIsCopied] = useState(false);

  // Backend-synced state
  const [apiKey, setApiKey] = useState(initialApiKey);

  // Loading states
  const [isRolling, setIsRolling] = useState(false);

  const handleCopyConfig = () => {
    const config = `{\n  "mcpServers": {\n    "agency-os": {\n      "command": "npx",\n      "args": [\n        "-y",\n        "@modelcontextprotocol/client-sse",\n        "--url",\n        "https://uprise-tools-production.up.railway.app/api/mcp",\n        "--header",\n        "Authorization: Bearer ${apiKey}"\n      ]\n    }\n  }\n}`;
    navigator.clipboard.writeText(config);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleRollKey = async () => {
    if (
      !confirm(
        "Are you sure? This will instantly disconnect any existing Claude integrations using the current key.",
      )
    )
      return;

    setIsRolling(true);
    const res = await rollMcpApiKeyAction();
    if (res.success && res.apiKey) {
      setApiKey(res.apiKey);
    }
    setIsRolling(false);
  };

  return (
    <div className="w-full h-full p-8 font-sans bg-slate-50/50">
      {/* HEADER */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
          <Bot className="w-7 h-7 text-indigo-600" />
          Claude MCP Integration
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Connect your live agency database directly to Claude Desktop using the
          Model Context Protocol.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* LEFT COLUMN: Configuration */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="py-0 border-slate-200 shadow-sm">
            <CardHeader className="bg-slate-50 border-b border-slate-100 p-5">
              <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-800">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                Connection Authentication
              </CardTitle>
              <CardDescription className="text-xs">
                Generate a secure token to authenticate Claude requests.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              <div className="space-y-2">
                <label
                  htmlFor="mcp-api-key"
                  className="text-[10px] font-bold uppercase tracking-wider text-slate-500"
                >
                  MCP API Key
                </label>
                <div className="flex items-center gap-2">
                  <Input
                    id="mcp-api-key"
                    readOnly
                    value={apiKey}
                    className="font-mono text-xs bg-slate-50 border-slate-200 text-slate-600"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs w-24"
                    onClick={handleRollKey}
                    disabled={isRolling}
                  >
                    {isRolling ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      "Roll Key"
                    )}
                  </Button>
                </div>
                <p className="text-[10px] text-slate-400">
                  This token grants read-only access to your permitted tools.
                  Keep it secure. Do NOT roll it - everyone will lose access!
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="py-0 border-slate-200 shadow-sm overflow-hidden gap-0">
            <CardHeader className="bg-slate-900 border-b border-slate-800 p-5">
              <CardTitle className="text-sm text-slate-100 flex items-center gap-2">
                <Terminal className="w-4 h-4 text-indigo-400" />
                Claude Desktop Configuration
              </CardTitle>
              <CardDescription className="text-slate-400 text-xs">
                Paste this directly into your{" "}
                <code className="text-indigo-300">
                  claude_desktop_config.json
                </code>{" "}
                file.
              </CardDescription>
            </CardHeader>
            <CardContent className="py-0 bg-slate-950 p-0 relative">
              <Button
                size="sm"
                variant="secondary"
                className="absolute top-3 right-3 h-7 text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-200 border-0"
                onClick={handleCopyConfig}
              >
                {isCopied ? (
                  <CheckCircle2 className="w-3 h-3 mr-1.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3 h-3 mr-1.5" />
                )}
                {isCopied ? "Copied" : "Copy JSON"}
              </Button>
              <pre className="p-5 text-xs font-mono text-slate-300 overflow-x-auto leading-relaxed">
                {`{
  "mcpServers": {
    "agency-os": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/client-sse",
        "--url",
        "https://uprise-tools-production.up.railway.app/api/mcp",
        "--header",
        "Authorization: Bearer ${apiKey}"
      ]
    }
  }
}`}
              </pre>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT COLUMN: Available MCP Tools */}
        <div className="lg:col-span-1">
          <Card className="py-0 border-slate-200 shadow-sm flex flex-col max-h-[600px] overflow-hidden">
            <CardHeader className="bg-slate-50 border-b border-slate-100 p-5 shrink-0">
              <CardTitle className="text-sm font-bold flex items-center justify-between text-slate-800">
                <span className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-indigo-500" />
                  Available MCP Tools ({AVAILABLE_TOOLS.length})
                </span>
              </CardTitle>
              <CardDescription className="text-xs">
                These tools are exposed to Claude when connected to this MCP
                server.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0 overflow-y-auto divide-y divide-slate-100">
              {AVAILABLE_TOOLS.map((tool) => (
                <div
                  key={tool.name}
                  className="p-4 hover:bg-slate-50 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <ActivitySquare className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                      {tool.title}
                    </div>
                    <div className="pt-0.5">
                      <code className="text-[9px] font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                        {tool.name}
                      </code>
                    </div>
                    <p className="text-[10px] text-slate-500 leading-normal pt-1">
                      {tool.description}
                    </p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
