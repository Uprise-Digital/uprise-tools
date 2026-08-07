"use client";

import { ArrowRight, Link2, Plus, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";

interface ConnectionsTabProps {
  connection: {
    id: number;
    connectedEmail: string;
    managerCustomerId: string | null;
    status: string;
    autoAddAccounts: boolean;
    autoSyncScope: "ALL" | "ACTIVE_ONLY";
    createdAt: string;
  } | null;
  orgId: string;
}

export function ConnectionsTab({ connection, orgId }: ConnectionsTabProps) {
  const [loading, setLoading] = useState(false);

  const handleConnectOAuth = () => {
    window.location.href = `/api/auth/google-ads/connect?orgId=${orgId}`;
  };

  return (
    <div className="space-y-6 max-w-4xl text-left">
      <div>
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Link2 className="h-5 w-5 text-indigo-400" />
          Google Ads & Data Connections
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Manage your Google Ads OAuth credentials and connected MCC manager
          accounts.
        </p>
      </div>

      {connection ? (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-6 backdrop-blur-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center font-bold text-sm">
                MCC
              </div>
              <div>
                <div className="text-sm font-bold text-white flex items-center gap-2">
                  {connection.connectedEmail}
                  <span
                    className={`px-2 py-0.5 text-[10px] font-bold rounded-full border uppercase ${
                      connection.status === "active"
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                        : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                    }`}
                  >
                    {connection.status}
                  </span>
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  Manager ID:{" "}
                  <span className="font-mono text-slate-300">
                    {connection.managerCustomerId || "Not selected"}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button
                onClick={handleConnectOAuth}
                variant="outline"
                className="bg-slate-950 border-slate-800 hover:bg-slate-800 text-slate-200 text-xs font-semibold rounded-xl flex items-center gap-1.5"
              >
                <RefreshCw className="h-3.5 w-3.5 text-indigo-400" />
                Refresh OAuth Token
              </Button>

              <Button
                asChild
                className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl flex items-center gap-1.5"
              >
                <Link
                  href={`/onboarding/mcc-select?connectionId=${connection.id}&orgId=${orgId}`}
                >
                  Import Accounts
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-slate-300">
            <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800/80">
              <div className="font-bold text-white mb-1">Auto-Add Accounts</div>
              <p className="text-slate-400">
                {connection.autoAddAccounts
                  ? "Automatically imports new child accounts created in this MCC."
                  : "Manual approval required before adding new MCC sub-accounts."}
              </p>
            </div>
            <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800/80">
              <div className="font-bold text-white mb-1">Sync Scope</div>
              <p className="text-slate-400">
                Currently syncing{" "}
                <strong className="text-indigo-400">
                  {connection.autoSyncScope === "ALL"
                    ? "All Accounts"
                    : "Active Accounts Only"}
                </strong>
                .
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-8 text-center space-y-4">
          <div className="h-12 w-12 rounded-full bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center mx-auto">
            <Plus className="h-6 w-6" />
          </div>
          <h3 className="text-lg font-bold text-white">
            No Google Ads Connection Found
          </h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Connect your Google Ads Manager (MCC) account to start pulling
            client metrics, threat audits, and negative keyword suggestions.
          </p>
          <Button
            onClick={handleConnectOAuth}
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm px-6 py-3 rounded-xl shadow-lg shadow-indigo-600/20"
          >
            Connect Google Ads OAuth →
          </Button>
        </div>
      )}
    </div>
  );
}
