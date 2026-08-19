"use client";

import {
  ActivitySquare,
  Bot,
  CheckCircle2,
  ChevronRight,
  Copy,
  Database,
  Globe,
  Key,
  Loader2,
  Plus,
  ShieldCheck,
  Terminal,
  Trash2,
  User,
  Zap,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  createMcpKeyAction,
  getMcpSettingsAction,
  getMcpUsageLogsAction,
  listMcpKeysAction,
  revokeMcpKeyAction,
  rollMcpApiKeyAction,
} from "@/actions/mcp.actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getAppUrl } from "@/lib/app-url";

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

export default function McpSettingsClient() {
  const [activeTab, setActiveTab] = useState<
    "keys" | "logs" | "setup" | "catalog"
  >("keys");
  const [legacyApiKey, setLegacyApiKey] = useState("");
  const [keys, setKeys] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [rolling, setRolling] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [creating, setCreating] = useState(false);
  const [newlyCreatedRawKey, setNewlyCreatedRawKey] = useState<string | null>(
    null,
  );

  useEffect(() => {
    loadMcpData();
  }, []);

  const loadMcpData = async () => {
    setLoading(true);
    try {
      const [settingsRes, keysRes, logsRes] = await Promise.all([
        getMcpSettingsAction(),
        listMcpKeysAction(),
        getMcpUsageLogsAction(50),
      ]);

      if (settingsRes.success && settingsRes.data) {
        setLegacyApiKey(settingsRes.data.apiKey);
      }
      if (keysRes.success && keysRes.keys) {
        setKeys(keysRes.keys);
      }
      if (logsRes.success && logsRes.logs) {
        setLogs(logsRes.logs);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to load MCP settings.");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName.trim()) {
      toast.error("Please enter a name for the key");
      return;
    }

    setCreating(true);
    try {
      const res = await createMcpKeyAction({
        name: newKeyName,
        scopes: ["read:analytics", "run:audits", "write:negatives"],
      });

      if (res.success && res.rawKey) {
        setNewlyCreatedRawKey(res.rawKey);
        setShowCreateModal(false);
        setNewKeyName("");
        toast.success("New MCP Key generated!");
        loadMcpData();
      } else {
        toast.error(res.error || "Failed to create key");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to generate key");
    } finally {
      setCreating(false);
    }
  };

  const handleRevokeKey = async (keyId: string) => {
    if (
      !confirm(
        "Are you sure you want to revoke this MCP key? Connected AI clients will lose access instantly.",
      )
    ) {
      return;
    }

    setRevokingId(keyId);
    try {
      const res = await revokeMcpKeyAction(keyId);
      if (res.success) {
        toast.success("MCP API Key revoked.");
        setKeys((prev) => prev.filter((k) => k.id !== keyId));
      } else {
        toast.error(res.error || "Failed to revoke key");
      }
    } catch (err: any) {
      toast.error(err.message || "Error revoking key");
    } finally {
      setRevokingId(null);
    }
  };

  const handleRollLegacyKey = async () => {
    if (
      !confirm(
        "Rolling legacy master key will immediately disconnect existing external agents using the legacy key. Proceed?",
      )
    ) {
      return;
    }
    setRolling(true);
    try {
      const res = await rollMcpApiKeyAction();
      if (res.success && res.apiKey) {
        setLegacyApiKey(res.apiKey);
        toast.success("Legacy master key rolled successfully!");
      } else {
        toast.error(res.error || "Failed to roll key.");
      }
    } catch (err: any) {
      toast.error(err.message || "An error occurred.");
    } finally {
      setRolling(false);
    }
  };

  const mcpSseUrl = `${getAppUrl()}/api/mcp/sse?key=${keys[0]?.keyPrefix || legacyApiKey}`;
  const mcpHttpUrl = `${getAppUrl()}/api/mcp/messages`;

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard!`);
  };

  const claudeDesktopConfig = JSON.stringify(
    {
      mcpServers: {
        "uprise-tools": {
          command: "node",
          args: [
            "/path/to/mcp-bridge.js",
            "--url",
            mcpSseUrl,
            "--key",
            keys[0]?.keyPrefix ? "agv_live_YOUR_RAW_SECRET_KEY" : legacyApiKey,
          ],
        },
      },
    },
    null,
    2,
  );

  return (
    <div className="space-y-8 md:p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 flex items-center gap-2">
            <Bot className="h-7 w-7 text-indigo-600" />
            Model Context Protocol (MCP) Hub
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Provision per-user API keys, configure tool scopes, and inspect
            real-time tool execution logs for Claude Desktop & Cursor.
          </p>
        </div>

        <Button
          onClick={() => setShowCreateModal(true)}
          className="w-full md:w-auto bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-200 text-indigo-700 hover:from-indigo-100 hover:to-blue-100 shadow-sm font-semibold flex items-center justify-center gap-2"
        >
          <Plus className="h-4 w-4 text-indigo-600" />
          Generate New MCP Key
        </Button>
      </div>

      {/* Top Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <Card className="border-t-4 border-t-emerald-500 bg-white border border-slate-200/80 shadow-sm rounded-2xl p-5">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            ACTIVE API KEYS
          </div>
          <div className="text-2xl font-extrabold text-slate-900 mt-1">
            {keys.length} Configured
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Per-user keys generated for team members.
          </p>
        </Card>
        <Card className="border-t-4 border-t-indigo-500 bg-white border border-slate-200/80 shadow-sm rounded-2xl p-5">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            TOTAL EXECUTION LOGS
          </div>
          <div className="text-2xl font-extrabold text-slate-900 mt-1">
            {logs.length} Logged
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Real-time MCP tool executions recorded.
          </p>
        </Card>
        <Card className="border-t-4 border-t-blue-500 bg-white border border-slate-200/80 shadow-sm rounded-2xl p-5">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            TOOL CATALOG CAPACITY
          </div>
          <div className="text-2xl font-extrabold text-slate-900 mt-1">
            {AVAILABLE_TOOLS.length} Tools Available
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Google Ads GAQL, CRO audits & RSA tools.
          </p>
        </Card>
      </div>

      {/* Main Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab("keys")}
          className={`px-4 py-2 text-sm font-semibold rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === "keys"
              ? "bg-indigo-600 text-white shadow-sm"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          <Key className="w-4 h-4" />
          API Keys ({keys.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("logs")}
          className={`px-4 py-2 text-sm font-semibold rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === "logs"
              ? "bg-indigo-600 text-white shadow-sm"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          <ActivitySquare className="w-4 h-4" />
          Execution Logs ({logs.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("setup")}
          className={`px-4 py-2 text-sm font-semibold rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === "setup"
              ? "bg-indigo-600 text-white shadow-sm"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          <Terminal className="w-4 h-4" />
          Claude / Cursor Setup
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("catalog")}
          className={`px-4 py-2 text-sm font-semibold rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === "catalog"
              ? "bg-indigo-600 text-white shadow-sm"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          <Database className="w-4 h-4" />
          Tool Catalog ({AVAILABLE_TOOLS.length})
        </button>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16 text-slate-500 gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
          <span>Loading MCP Server Configuration...</span>
        </div>
      )}

      {/* TAB 1: API KEYS TABLE */}
      {!loading && activeTab === "keys" && (
        <div className="space-y-6">
          <Card className="bg-white border-slate-200/80 shadow-sm rounded-2xl p-6">
            <CardHeader className="px-0 pt-0 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <Key className="w-5 h-5 text-indigo-600" />
                  Per-User MCP API Keys
                </CardTitle>
                <CardDescription className="text-slate-500 text-sm mt-1">
                  Active API keys for your agency members and automated AI
                  agents.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              {keys.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-slate-200 rounded-2xl bg-slate-50/50 space-y-3">
                  <ShieldCheck className="w-10 h-10 text-slate-400 mx-auto" />
                  <p className="text-sm text-slate-600 font-medium">
                    No per-user MCP keys generated yet.
                  </p>
                  <Button
                    onClick={() => setShowCreateModal(true)}
                    variant="outline"
                    className="border-indigo-200 text-indigo-600 hover:bg-indigo-50"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Create Your First MCP Key
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-slate-700">
                    <thead className="bg-slate-50 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-3">Key Name</th>
                        <th className="px-4 py-3">Owner</th>
                        <th className="px-4 py-3">Key Prefix</th>
                        <th className="px-4 py-3">Scopes</th>
                        <th className="px-4 py-3">Last Used</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {keys.map((k) => (
                        <tr
                          key={k.id}
                          className="hover:bg-slate-50/80 transition-colors"
                        >
                          <td className="px-4 py-3.5 font-bold text-slate-900">
                            {k.name}
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-1.5 text-xs text-slate-600">
                              <User className="w-3.5 h-3.5 text-indigo-600" />
                              <span>{k.ownerName}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3.5 font-mono text-xs text-indigo-600 font-semibold">
                            {k.keyPrefix}
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="flex flex-wrap gap-1">
                              {Array.isArray(k.scopes) &&
                                k.scopes.map((s: string) => (
                                  <span
                                    key={s}
                                    className="px-2 py-0.5 rounded bg-indigo-50 border border-indigo-100 text-[10px] font-mono text-indigo-700 font-medium"
                                  >
                                    {s}
                                  </span>
                                ))}
                            </div>
                          </td>
                          <td className="px-4 py-3.5 text-xs text-slate-500">
                            {k.lastUsedAt
                              ? new Date(k.lastUsedAt).toLocaleString()
                              : "Never"}
                          </td>
                          <td className="px-4 py-3.5 text-right">
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={revokingId === k.id}
                              onClick={() => handleRevokeKey(k.id)}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50 h-8 px-2"
                            >
                              {revokingId === k.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="w-3.5 h-3.5" />
                              )}
                              <span className="ml-1 text-xs">Revoke</span>
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Legacy Organization Master Key Section */}
          <Card className="bg-slate-50/60 border-slate-200/80 rounded-2xl p-5">
            <CardHeader className="px-0 pt-0 pb-3">
              <CardTitle className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Legacy Master Organization Key
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Backward compatible master fallback key for single-tenant bots.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-0 pb-0 flex items-center justify-between gap-4">
              <Input
                readOnly
                type="password"
                value={legacyApiKey}
                className="bg-white border-slate-200 text-slate-800 font-mono text-xs max-w-md rounded-xl"
              />
              <Button
                variant="outline"
                size="sm"
                disabled={rolling}
                onClick={handleRollLegacyKey}
                className="border-slate-200 hover:bg-white text-slate-700 font-semibold"
              >
                {rolling ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                ) : null}
                Roll Master Key
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB 2: EXECUTION LOGS TABLE */}
      {!loading && activeTab === "logs" && (
        <Card className="bg-white border-slate-200/80 shadow-sm rounded-2xl p-6">
          <CardHeader className="px-0 pt-0">
            <CardTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <ActivitySquare className="w-5 h-5 text-indigo-600" />
              Real-Time MCP Tool Execution Logs
            </CardTitle>
            <CardDescription className="text-slate-500 text-sm mt-1">
              Live audit stream of all tool calls executed by connected AI
              clients.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            {logs.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                <p className="text-sm text-slate-500">
                  No MCP tool execution logs recorded yet.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-700">
                  <thead className="bg-slate-50 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3">Timestamp</th>
                      <th className="px-4 py-3">Tool Name</th>
                      <th className="px-4 py-3">Latency</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">IP Address</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono text-xs">
                    {logs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50/80">
                        <td className="px-4 py-3 text-slate-500">
                          {new Date(log.createdAt).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 font-semibold text-indigo-600">
                          {log.toolName}
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {log.executionTimeMs} ms
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              log.status === "success"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : "bg-red-50 text-red-700 border border-red-200"
                            }`}
                          >
                            {log.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-500">
                          {log.ipAddress || "internal"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* TAB 3: SETUP INSTRUCTIONS */}
      {!loading && activeTab === "setup" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="bg-white border-slate-200/80 shadow-sm rounded-2xl p-6">
            <CardHeader className="px-0 pt-0">
              <CardTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Bot className="w-5 h-5 text-indigo-600" />
                Claude Desktop Integration
              </CardTitle>
              <CardDescription className="text-xs text-slate-500 mt-1">
                Add this config snippet to your local{" "}
                <code className="text-indigo-600 font-semibold">
                  claude_desktop_config.json
                </code>{" "}
                file.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-0 pb-0 space-y-4">
              <div className="relative bg-slate-900 p-4 rounded-xl border border-slate-800 font-mono text-xs text-indigo-300 overflow-x-auto">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    copyToClipboard(
                      claudeDesktopConfig,
                      "Claude Desktop Config",
                    )
                  }
                  className="absolute top-2 right-2 text-slate-400 hover:text-white"
                >
                  <Copy className="w-3.5 h-3.5" />
                </Button>
                <pre>{claudeDesktopConfig}</pre>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border-slate-200/80 shadow-sm rounded-2xl p-6">
            <CardHeader className="px-0 pt-0">
              <CardTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Globe className="w-5 h-5 text-indigo-600" />
                HTTP & SSE Endpoints
              </CardTitle>
              <CardDescription className="text-xs text-slate-500 mt-1">
                Direct endpoints for Cursor, Antigravity, or custom agent
                frameworks.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-0 pb-0 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  SSE Endpoint URL
                </label>
                <div className="flex items-center gap-2 mt-1">
                  <Input
                    readOnly
                    value={mcpSseUrl}
                    className="bg-slate-50 border-slate-200 text-xs font-mono text-slate-800 rounded-xl"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyToClipboard(mcpSseUrl, "SSE URL")}
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  HTTP Transport URL
                </label>
                <div className="flex items-center gap-2 mt-1">
                  <Input
                    readOnly
                    value={mcpHttpUrl}
                    className="bg-slate-50 border-slate-200 text-xs font-mono text-slate-800 rounded-xl"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyToClipboard(mcpHttpUrl, "HTTP URL")}
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB 4: TOOL CATALOG */}
      {!loading && activeTab === "catalog" && (
        <div className="space-y-6">
          {TOOL_CATEGORIES.map((category) => (
            <Card
              key={category.id}
              className="bg-white border-slate-200/80 shadow-sm rounded-2xl p-6"
            >
              <CardHeader className="px-0 pt-0">
                <CardTitle className="text-lg font-bold text-slate-900">
                  {category.title}
                </CardTitle>
                <CardDescription className="text-xs text-slate-500 mt-0.5">
                  {category.description}
                </CardDescription>
              </CardHeader>
              <CardContent className="px-0 pb-0 grid grid-cols-1 md:grid-cols-2 gap-4">
                {category.tools.map((toolName) => {
                  const tool = AVAILABLE_TOOLS.find((t) => t.name === toolName);
                  if (!tool) return null;
                  return (
                    <div
                      key={tool.name}
                      className="p-3.5 bg-slate-50/80 border border-slate-200/80 rounded-xl space-y-1"
                    >
                      <div className="flex items-center gap-2">
                        <Zap className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                        <span className="font-mono text-xs font-bold text-slate-900">
                          {tool.name}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 pl-5 leading-relaxed">
                        {tool.description}
                      </p>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* CREATE KEY MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-6 shadow-2xl space-y-5">
            <div className="space-y-1">
              <h3 className="text-xl font-bold text-slate-900">
                Generate Per-User MCP Key
              </h3>
              <p className="text-xs text-slate-500">
                Create a dedicated API key for your Claude Desktop, Cursor
                agent, or AI bot.
              </p>
            </div>

            <form onSubmit={handleCreateKey} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Key Label / Name *
                </label>
                <Input
                  required
                  placeholder="e.g. Alex's Claude Desktop"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  className="bg-slate-50 border-slate-200 text-slate-900 rounded-xl"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowCreateModal(false)}
                  className="text-slate-600 hover:text-slate-900"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={creating}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl"
                >
                  {creating ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-1" />
                  ) : null}
                  Generate Key
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ONE-TIME SECRET DISPLAY MODAL */}
      {newlyCreatedRawKey && (
        <div className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white border border-slate-200 rounded-2xl p-6 shadow-2xl space-y-5">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-emerald-600 font-bold text-sm">
                <CheckCircle2 className="w-4 h-4" />
                MCP Key Created Successfully
              </div>
              <h3 className="text-xl font-bold text-slate-900">
                Save Your API Secret Key
              </h3>
              <p className="text-xs text-amber-600 font-medium">
                ⚠️ Make sure to copy your API secret now. You will not be able to
                see it again!
              </p>
            </div>

            <div className="p-3.5 bg-slate-50 border border-indigo-200 rounded-xl font-mono text-xs text-indigo-700 break-all select-all flex items-center justify-between gap-3">
              <span>{newlyCreatedRawKey}</span>
              <Button
                size="sm"
                onClick={() =>
                  copyToClipboard(newlyCreatedRawKey, "MCP Secret Key")
                }
                className="bg-indigo-600 hover:bg-indigo-500 text-white shrink-0 rounded-lg"
              >
                <Copy className="w-3.5 h-3.5 mr-1" />
                Copy
              </Button>
            </div>

            <div className="flex justify-end pt-2">
              <Button
                onClick={() => setNewlyCreatedRawKey(null)}
                className="bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl"
              >
                Done
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
