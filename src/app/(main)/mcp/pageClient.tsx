"use client";

import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
    ActivitySquare, Bot, CheckCircle2, Copy, Database, ShieldCheck, Terminal, Loader2
} from "lucide-react";
import { rollMcpApiKeyAction, updateMcpToolsAction } from "@/actions/mcp.actions";

interface McpSettingsClientProps {
    initialApiKey: string;
    initialTools: {
        godView: boolean;
        campaignDiagnostics: boolean;
    };
}

export default function McpSettingsClient({ initialApiKey, initialTools }: McpSettingsClientProps) {
    const [isCopied, setIsCopied] = useState(false);

    // Backend-synced state
    const [apiKey, setApiKey] = useState(initialApiKey);
    const [tools, setTools] = useState(initialTools);

    // Loading states
    const [isRolling, setIsRolling] = useState(false);
    const [isSavingTools, setIsSavingTools] = useState(false);

    const handleCopyConfig = () => {
        const config = `{\n  "mcpServers": {\n    "agency-os": {\n      "command": "npx",\n      "args": [\n        "-y",\n        "@modelcontextprotocol/client-sse",\n        "--url",\n        "https://uprise-tools-production.up.railway.app/api/mcp",\n        "--header",\n        "Authorization: Bearer ${apiKey}"\n      ]\n    }\n  }\n}`;
        navigator.clipboard.writeText(config);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
    };

    const handleRollKey = async () => {
        if (!confirm("Are you sure? This will instantly disconnect any existing Claude integrations using the current key.")) return;

        setIsRolling(true);
        const res = await rollMcpApiKeyAction();
        if (res.success && res.apiKey) {
            setApiKey(res.apiKey);
        }
        setIsRolling(false);
    };

    const handleToggleTool = async (toolKey: keyof typeof tools, newValue: boolean) => {
        setIsSavingTools(true);
        const updatedTools = { ...tools, [toolKey]: newValue };

        // Optimistic UI update
        setTools(updatedTools);

        // Backend sync
        await updateMcpToolsAction(updatedTools);
        setIsSavingTools(false);
    };

    return (
        <div className="w-full h-full p-8 font-sans bg-slate-50/50">
            {/* HEADER */}
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
                    <Bot className="w-7 h-7 text-indigo-600"/>
                    Claude MCP Integration
                </h1>
                <p className="text-sm text-slate-500 mt-1">
                    Connect your live agency database directly to Claude Desktop using the Model Context Protocol.
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                {/* LEFT COLUMN: Configuration */}
                <div className="lg:col-span-2 space-y-6">
                    <Card className="py-0 border-slate-200 shadow-sm">
                        <CardHeader className="bg-slate-50 border-b border-slate-100 p-5">
                            <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-800">
                                <ShieldCheck className="w-4 h-4 text-emerald-500"/>
                                Connection Authentication
                            </CardTitle>
                            <CardDescription className="text-xs">
                                Generate a secure token to authenticate Claude requests.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="p-5 space-y-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                    MCP API Key
                                </label>
                                <div className="flex items-center gap-2">
                                    <Input
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
                                        {isRolling ? <Loader2 className="w-3 h-3 animate-spin" /> : "Roll Key"}
                                    </Button>
                                </div>
                                <p className="text-[10px] text-slate-400">
                                    This token grants read-only access to your permitted tools. Keep it secure.
                                </p>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="py-0 border-slate-200 shadow-sm overflow-hidden gap-0">
                        <CardHeader className="bg-slate-900 border-b border-slate-800 p-5">
                            <CardTitle className="text-sm text-slate-100 flex items-center gap-2">
                                <Terminal className="w-4 h-4 text-indigo-400"/>
                                Claude Desktop Configuration
                            </CardTitle>
                            <CardDescription className="text-slate-400 text-xs">
                                Paste this directly into your <code className="text-indigo-300">claude_desktop_config.json</code> file.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="py-0 bg-slate-950 p-0 relative">
                            <Button
                                size="sm"
                                variant="secondary"
                                className="absolute top-3 right-3 h-7 text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-200 border-0"
                                onClick={handleCopyConfig}
                            >
                                {isCopied ? <CheckCircle2 className="w-3 h-3 mr-1.5 text-emerald-400"/> : <Copy className="w-3 h-3 mr-1.5"/>}
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
        "Authorization: Bearer ${apiKey.substring(0, 12)}..."
      ]
    }
  }
}`}
                            </pre>
                        </CardContent>
                    </Card>
                </div>

                {/* RIGHT COLUMN: Tool Permissions */}
                <div className="lg:col-span-1">
                    <Card className="py-0 border-slate-200 shadow-sm">
                        <CardHeader className="bg-slate-50 border-b border-slate-100 p-5">
                            <CardTitle className="text-sm font-bold flex items-center justify-between text-slate-800">
                                <span className="flex items-center gap-2">
                                    <Database className="w-4 h-4 text-indigo-500"/>
                                    Enabled Tools
                                </span>
                                {isSavingTools && <Loader2 className="w-3 h-3 text-slate-400 animate-spin" />}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-5 space-y-6">
                            <div className="flex items-start justify-between gap-4">
                                <div className="space-y-0.5">
                                    <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                                        <ActivitySquare className="w-3.5 h-3.5 text-indigo-600"/> Agency God-View
                                    </div>
                                    <p className="text-[10px] text-slate-500 max-w-[180px]">
                                        Allows Claude to pull the macro portfolio metrics and triage critical fires.
                                    </p>
                                </div>
                                <Switch
                                    checked={tools.godView}
                                    disabled={isSavingTools}
                                    onCheckedChange={(c) => handleToggleTool('godView', c)}
                                />
                            </div>

                            <div className="h-px bg-slate-100 w-full"/>

                            <div className="flex items-start justify-between gap-4">
                                <div className="space-y-0.5">
                                    <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                                        <ActivitySquare className="w-3.5 h-3.5 text-blue-600"/> Campaign Diagnostics
                                    </div>
                                    <p className="text-[10px] text-slate-500 max-w-[180px]">
                                        Allows Claude to dive deep into a specific account's keyword and PMax performance.
                                    </p>
                                </div>
                                <Switch
                                    checked={tools.campaignDiagnostics}
                                    disabled={isSavingTools}
                                    onCheckedChange={(c) => handleToggleTool('campaignDiagnostics', c)}
                                />
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}