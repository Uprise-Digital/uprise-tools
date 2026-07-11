"use client";

import {
  ActivitySquare,
  Bot,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Copy,
  Database,
  Globe,
  Loader2,
  ShieldCheck,
  Terminal,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
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
    title: "Get Account Metrics",
    description:
      "Fetches detailed dashboard metrics for a specific ad account by its internal ID.",
  },
  {
    name: "lookup_account_by_name",
    title: "Lookup Account By Name",
    description:
      "Searches for ad accounts by name (partial match). Use this to find an account ID.",
  },
  {
    name: "lookup_account_by_id",
    title: "Lookup Account By Id",
    description:
      "Fetches account name and details for a given internal account ID.",
  },
  {
    name: "list_accounts",
    title: "List Accounts",
    description:
      "Returns all ad accounts in the system with their internal IDs, names, Google account IDs, currency, and active status.",
  },
  {
    name: "list_campaign_landing_pages",
    title: "List Campaign Landing Pages",
    description:
      "Lists campaign landing pages, URLs, and latest audit scores for an ad account.",
  },
  {
    name: "sync_campaign_landing_pages",
    title: "Sync Campaign Landing Pages",
    description:
      "Syncs campaign landing page URLs from the Google Ads API for an ad account.",
  },
  {
    name: "save_campaign_landing_page_url",
    title: "Save Campaign Landing Page Url",
    description:
      "Manually saves/attaches a landing page URL to a specific campaign.",
  },
  {
    name: "run_landing_page_cro_audit",
    title: "Run Landing Page Cro Audit",
    description:
      "Runs a 10-dimension landing page CRO audit with competitor scanning on a focus keyword using Gemini.",
  },
  {
    name: "get_landing_page_audit_details",
    title: "Get Landing Page Audit Details",
    description:
      "Retrieves the detailed breakdown, score cards, and AM action plan script for a specific landing page audit by its ID.",
  },
  {
    name: "list_ad_group_ads",
    title: "List Ad Group Ads",
    description:
      "Retrieves a list of active ad group ads with latest audit status and parameters.",
  },
  {
    name: "get_asset_performance_report",
    title: "Get Asset Performance Report",
    description:
      "Fetches performance labels and pinning info for RSA assets across campaigns.",
  },
  {
    name: "run_ad_copy_audit",
    title: "Run Ad Copy Audit",
    description:
      "Runs a Google RSA ad copy audit, comparing asset performance, pinning config, and message-match using Gemini.",
  },
  {
    name: "get_ad_copy_audit_details",
    title: "Get Ad Copy Audit Details",
    description: "Retrieves detailed ad copy audit results by audit ID.",
  },
  {
    name: "get_historical_comparison",
    title: "Get Historical Comparison",
    description:
      "Compares current performance against the prior period side-by-side with delta percentages.",
  },
  {
    name: "get_search_term_insights",
    title: "Get Search Term Insights",
    description:
      "Returns top search terms, converting terms, and wasted spend analysis.",
  },
  {
    name: "get_campaign_details",
    title: "Get Campaign Details",
    description:
      "Returns campaign configuration details, bidding strategies, budgets, status, and targets set in Google Ads.",
  },
  {
    name: "get_account_anomalies",
    title: "Get Account Anomalies",
    description:
      "Detects statistically significant deviations in an account's recent performance.",
  },
  {
    name: "get_concentration_report",
    title: "Get Concentration Report",
    description:
      "Returns a quantified HHI analysis of client concentration risk across the agency portfolio.",
  },
  {
    name: "get_account_targets",
    title: "Get Account Targets",
    description:
      "Returns agreed client targets, such as target CPA, target ROAS, and budget caps.",
  },
  {
    name: "get_org_triage_defaults",
    title: "Get Org Triage Defaults",
    description:
      "Fetches the organization-wide defaults for alert and anomaly triage thresholds.",
  },
  {
    name: "get_account_triage_settings",
    title: "Get Account Triage Settings",
    description:
      "Fetches the triage threshold override settings for a specific client account.",
  },
  {
    name: "set_org_triage_defaults",
    title: "Set Org Triage Defaults",
    description:
      "Sets/updates the organization-wide defaults for alert and anomaly triage thresholds.",
  },
  {
    name: "set_account_triage_settings",
    title: "Set Account Triage Settings",
    description:
      "Sets/updates the custom triage threshold override settings for a specific client account.",
  },
  {
    name: "set_account_targets",
    title: "Set Account Targets",
    description:
      "Sets or updates the agreed client KPI targets for an account — target CPA, target ROAS, and monthly budget cap.",
  },
  {
    name: "get_negative_keyword_suggestions",
    title: "Get Negative Keyword Suggestions",
    description:
      "Fetches all negative keyword suggestions (pending, approved, denied, archived) for an account.",
  },
  {
    name: "generate_negative_keyword_suggestions",
    title: "Generate Negative Keyword Suggestions",
    description:
      "Pulls search terms and active keywords, runs AI waste analysis via Gemini, and saves pending recommendations.",
  },
  {
    name: "add_negative_keyword",
    title: "Add Negative Keyword",
    description:
      "Pushes a campaign-level negative keyword directly to Google Ads and marks it as approved.",
  },
  {
    name: "get_active_negative_keywords",
    title: "Get Active Negative Keywords",
    description:
      "Fetches campaign-level negative keywords currently active in Google Ads.",
  },
  {
    name: "get_account_persona",
    title: "Get Account Persona",
    description:
      "Fetches the structured buyer persona, targeting intent, and scope defaults for an ad account.",
  },
  {
    name: "set_account_persona",
    title: "Set Account Persona",
    description:
      "Sets or updates the structured buyer persona and targeting intent notes for an ad account.",
  },
  {
    name: "get_impression_share_report",
    title: "Get Impression Share Report",
    description:
      "Fetches search impression share, lost IS due to budget/rank, and constraint flags.",
  },
  {
    name: "audit_conversion_tracking",
    title: "Audit Conversion Tracking",
    description:
      "Audits conversion actions, counting type, and flags issues like inflated goals or broken tags.",
  },
];

const TOOL_CATEGORIES = [
  {
    id: "portfolio",
    title: "Portfolio & Directory",
    description: "Discover accounts and view macro metrics.",
    tools: [
      "get_agency_god_view",
      "list_accounts",
      "lookup_account_by_name",
      "lookup_account_by_id",
      "get_account_metrics",
      "get_historical_comparison",
    ],
  },
  {
    id: "campaigns",
    title: "Campaign & Bidding",
    description: "Diagnose bidding strategy, budgets, and impressions.",
    tools: [
      "get_campaign_details",
      "get_impression_share_report",
      "get_account_anomalies",
      "get_concentration_report",
      "audit_conversion_tracking",
    ],
  },
  {
    id: "keywords",
    title: "Negative Keyword Automation",
    description: "Scan search queries, detect waste, and apply keywords.",
    tools: [
      "get_search_term_insights",
      "get_active_negative_keywords",
      "get_negative_keyword_suggestions",
      "generate_negative_keyword_suggestions",
      "add_negative_keyword",
    ],
  },
  {
    id: "cro",
    title: "Landing Page CRO",
    description: "Audit page copy alignment and run competitor scans.",
    tools: [
      "list_campaign_landing_pages",
      "sync_campaign_landing_pages",
      "save_campaign_landing_page_url",
      "run_landing_page_cro_audit",
      "get_landing_page_audit_details",
    ],
  },
  {
    id: "copywriting",
    title: "Ad Copy & RSA Pinning",
    description: "Audit ad copies and check asset performance pinning.",
    tools: [
      "list_ad_group_ads",
      "get_asset_performance_report",
      "run_ad_copy_audit",
      "get_ad_copy_audit_details",
    ],
  },
  {
    id: "targets",
    title: "KPI Targets & Thresholds",
    description: "Configure targets and customize anomaly triggers.",
    tools: [
      "get_account_targets",
      "set_account_targets",
      "get_org_triage_defaults",
      "set_org_triage_defaults",
      "get_account_triage_settings",
      "set_account_triage_settings",
      "get_account_persona",
      "set_account_persona",
    ],
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
  const [expandedCategory, setExpandedCategory] = useState<string | null>(
    "portfolio",
  );

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
            <CardContent className="p-5 pt-3 space-y-4">
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

          <Card className="py-0 border-slate-200 shadow-sm overflow-hidden gap-0">
            <CardHeader className="bg-slate-900 border-b border-slate-800 p-5">
              <CardTitle className="text-sm text-slate-100 flex items-center gap-2">
                <Globe className="w-4 h-4 text-indigo-400" />
                Claude Web (Claude.ai) Configuration
              </CardTitle>
              <CardDescription className="text-slate-400 text-xs">
                Configure connection settings in your Claude.ai account
                settings.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 bg-white space-y-4 text-slate-600">
              <div className="space-y-3.5">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Connection URL (Pre-authenticated)
                  </span>
                  <div className="flex items-center gap-2">
                    <Input
                      readOnly
                      value={`https://uprise-tools-production.up.railway.app/api/mcp/mcp?key=${apiKey}`}
                      className="font-mono text-xs bg-slate-50 border-slate-200 text-slate-600 h-8"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs h-8 w-20"
                      onClick={() => {
                        navigator.clipboard.writeText(
                          `https://uprise-tools-production.up.railway.app/api/mcp/mcp?key=${apiKey}`,
                        );
                        toast.success("Connection URL copied!");
                      }}
                    >
                      Copy URL
                    </Button>
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-[11px] leading-relaxed text-slate-500">
                  <span className="font-bold text-slate-700 block mb-1">
                    Detailed Steps:
                  </span>
                  1. Log into{" "}
                  <span className="font-semibold text-slate-700">
                    Claude.ai
                  </span>{" "}
                  and navigate to your profile menu at the bottom left.
                  <br />
                  2. Select{" "}
                  <span className="font-semibold text-slate-700">Settings</span>
                  , then click on the{" "}
                  <span className="font-semibold text-slate-700">
                    MCP Servers
                  </span>{" "}
                  tab.
                  <br />
                  3. Click{" "}
                  <span className="font-semibold text-slate-700">
                    Add Server
                  </span>
                  , name it{" "}
                  <code className="bg-slate-150 px-1 rounded font-bold text-slate-800">
                    Uprise Digital MCP
                  </code>
                  , and paste the copied pre-authenticated{" "}
                  <span className="font-bold">Connection URL</span>.
                  <br />
                  4. Click <span className="font-bold">Connect</span>.
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT COLUMN: Available MCP Tools */}
        <div className="lg:col-span-1">
          <Card className="py-0 border-slate-200 shadow-sm flex flex-col min-h-[750px] overflow-hidden bg-white">
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
            <CardContent className="p-0 overflow-y-auto divide-y divide-slate-100 flex-1">
              {TOOL_CATEGORIES.map((cat) => {
                const isExpanded = expandedCategory === cat.id;
                const categoryTools = AVAILABLE_TOOLS.filter((tool) =>
                  cat.tools.includes(tool.name),
                );

                return (
                  <div
                    key={cat.id}
                    className="border-b border-slate-100 last:border-b-0"
                  >
                    <button
                      onClick={() =>
                        setExpandedCategory(isExpanded ? null : cat.id)
                      }
                      className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors text-left"
                    >
                      <div>
                        <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                          {cat.title}
                          <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">
                            {categoryTools.length}
                          </span>
                        </span>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          {cat.description}
                        </p>
                      </div>
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-slate-450" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-slate-450" />
                      )}
                    </button>

                    {isExpanded && (
                      <div className="bg-slate-50/50 px-4 pb-4 divide-y divide-slate-100/60 border-t border-slate-100">
                        {categoryTools.map((tool) => (
                          <div
                            key={tool.name}
                            className="py-3 last:pb-0 first:pt-3"
                          >
                            <div className="space-y-1">
                              <div className="text-[11px] font-bold text-slate-800 flex items-center gap-1.5">
                                <ActivitySquare className="w-3 h-3 text-indigo-500 shrink-0" />
                                {tool.title}
                              </div>
                              <div className="pt-0.5">
                                <code className="text-[8px] font-mono bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">
                                  {tool.name}
                                </code>
                              </div>
                              <p className="text-[10px] text-slate-500 leading-normal pt-1">
                                {tool.description}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
