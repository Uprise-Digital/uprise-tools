"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  linkManagerAccountAction,
  fetchSubAccountsForPreviewAction,
} from "@/actions/onboarding.actions";
import { Button } from "@/components/ui/button";

interface SubAccount {
  id: string;
  name: string;
  currencyCode: string;
  timeZone: string;
  status: string;
  optimizationScore: number | null;
}

interface MccSelectClientProps {
  connectionId: number;
  orgId: string;
  connectedEmail: string;
  initialAccounts: { id: string; name: string; manager: boolean }[];
  fetchError: string | null;
}

function formatCustomerId(id: string) {
  const clean = id.replace(/[^0-9]/g, "");
  if (clean.length === 10) {
    return `${clean.slice(0, 3)}-${clean.slice(3, 6)}-${clean.slice(6)}`;
  }
  return id;
}

export default function MccSelectClient({
  connectionId,
  orgId,
  connectedEmail,
  initialAccounts,
  fetchError,
}: MccSelectClientProps) {
  const router = useRouter();
  const [selectedMccId, setSelectedMccId] = useState(
    initialAccounts.length > 0 ? initialAccounts[0].id : ""
  );
  const [customMccId, setCustomMccId] = useState("");
  const [useCustomInput, setUseCustomInput] = useState(initialAccounts.length === 0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(fetchError);

  // --- Step 2: Selective Import State ---
  const [subAccounts, setSubAccounts] = useState<SubAccount[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Step 1: Fetch sub-accounts from Google Ads
  const handleFetchSubAccounts = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalMccId = useCustomInput ? customMccId : selectedMccId;

    if (!finalMccId.trim()) {
      setError("Please select or enter a Google Ads Account ID");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetchSubAccountsForPreviewAction({
        connectionId,
        managerCustomerId: finalMccId.replace(/[^0-9]/g, ""),
      });

      if (res.success && res.accounts) {
        setSubAccounts(res.accounts);
        // By default, select all ENABLED accounts
        const activeIds = res.accounts
          .filter((acc: SubAccount) => acc.status === "ENABLED")
          .map((acc: SubAccount) => acc.id);
        setSelectedIds(new Set(activeIds));
      } else {
        setError(res.error || "Failed to fetch accounts from Google Ads.");
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Link selected accounts and complete onboarding
  const handleImportAccounts = async () => {
    const finalMccId = useCustomInput ? customMccId : selectedMccId;
    const cleanMccId = finalMccId.replace(/[^0-9]/g, "");

    if (selectedIds.size === 0) {
      setError("Please select at least one account to import");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await linkManagerAccountAction({
        connectionId,
        managerCustomerId: cleanMccId,
        selectedCustomerIds: Array.from(selectedIds),
      });

      if (res.success) {
        router.push(
          `/onboarding/confirm?orgId=${orgId}&email=${encodeURIComponent(connectedEmail)}`
        );
      } else {
        setError(res.error || "Failed to import selected accounts.");
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred during import.");
    } finally {
      setLoading(false);
    }
  };

  // Table selections helpers
  const handleToggleSelectAll = (filteredIds: string[]) => {
    const nextSet = new Set(selectedIds);
    const allFilteredSelected = filteredIds.every((id) => nextSet.has(id));

    if (allFilteredSelected) {
      // Uncheck all in current filter
      for (const id of filteredIds) {
        nextSet.delete(id);
      }
    } else {
      // Check all in current filter
      for (const id of filteredIds) {
        nextSet.add(id);
      }
    }
    setSelectedIds(nextSet);
  };

  const handleToggleRow = (id: string) => {
    const nextSet = new Set(selectedIds);
    if (nextSet.has(id)) {
      nextSet.delete(id);
    } else {
      nextSet.add(id);
    }
    setSelectedIds(nextSet);
  };

  // Filter accounts
  const filteredAccounts = subAccounts.filter((acc) => {
    const matchesSearch =
      acc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      acc.id.includes(searchQuery);
    const matchesStatus =
      statusFilter === "ALL" ||
      (statusFilter === "ACTIVE" && acc.status === "ENABLED") ||
      (statusFilter === "CANCELLED" && acc.status === "CANCELED");
    return matchesSearch && matchesStatus;
  });

  const filteredIds = filteredAccounts.map((acc) => acc.id);

  if (subAccounts.length > 0) {
    // --- Step 2: SELECTIVE IMPORT TABLE ---
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <h2 className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-slate-100 to-slate-300 bg-clip-text text-transparent">
              Select Client Accounts to Monitor
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Select which child accounts you want to sync and triage.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
              Selected: <span className="text-indigo-400">{selectedIds.size}</span> / {subAccounts.length}
            </span>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-900/30 border border-red-500/20 text-red-200 text-sm rounded-xl">
            {error}
          </div>
        )}

        {/* Filter controls */}
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            placeholder="Search by account name or 10-digit ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 px-3.5 py-2 bg-slate-950/80 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-white rounded-xl text-xs outline-none transition-all"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3.5 py-2 bg-slate-950/80 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-white rounded-xl text-xs outline-none transition-all cursor-pointer"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active Only</option>
            <option value="CANCELLED">Cancelled Only</option>
          </select>
        </div>

        {/* Sub-Accounts Table */}
        <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/40">
          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-950/80 text-slate-400 uppercase text-[10px] font-bold tracking-wider sticky top-0 border-b border-slate-800 z-10">
                <tr>
                  <th className="p-3.5 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={filteredIds.length > 0 && filteredIds.every((id) => selectedIds.has(id))}
                      onChange={() => handleToggleSelectAll(filteredIds)}
                      className="h-3.5 w-3.5 rounded border-slate-850 text-indigo-650 focus:ring-indigo-500 cursor-pointer"
                    />
                  </th>
                  <th className="p-3.5 w-28">Status</th>
                  <th className="p-3.5">Account</th>
                  <th className="p-3.5 w-28 text-right">Opt. Score</th>
                  <th className="p-3.5 w-44">TZ & Currency</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850">
                {filteredAccounts.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-505 font-medium">
                      No accounts match the filters.
                    </td>
                  </tr>
                ) : (
                  filteredAccounts.map((acc) => {
                    const isChecked = selectedIds.has(acc.id);
                    return (
                      <tr
                        key={acc.id}
                        className={`hover:bg-slate-900/30 transition-colors cursor-pointer ${
                          isChecked ? "bg-indigo-600/5" : ""
                        }`}
                        onClick={() => handleToggleRow(acc.id)}
                      >
                        <td className="p-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleRow(acc.id)}
                            className="h-3.5 w-3.5 rounded border-slate-800 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                          />
                        </td>
                        <td className="p-3.5">
                          <span className="flex items-center gap-1.5 font-bold">
                            <span
                              className={`h-2 w-2 rounded-full flex-shrink-0 ${
                                acc.status === "ENABLED"
                                  ? "bg-emerald-500"
                                  : acc.status === "CANCELED"
                                  ? "bg-slate-400"
                                  : acc.status === "SUSPENDED"
                                  ? "bg-rose-500"
                                  : "bg-amber-500"
                              }`}
                            />
                            <span
                              className={
                                acc.status === "ENABLED"
                                  ? "text-emerald-400"
                                  : acc.status === "CANCELED"
                                  ? "text-slate-400"
                                  : "text-amber-400"
                              }
                            >
                              {acc.status === "ENABLED"
                                ? "Active"
                                : acc.status === "CANCELED"
                                ? "Cancelled"
                                : acc.status}
                            </span>
                          </span>
                        </td>
                        <td className="p-3.5">
                          <div className="flex flex-col gap-0.5">
                            <span className="font-extrabold text-slate-205 text-xs truncate max-w-xs sm:max-w-md">
                              {acc.name}
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono">
                              {formatCustomerId(acc.id)}
                            </span>
                          </div>
                        </td>
                        <td className="p-3.5 text-right font-mono font-bold text-slate-300">
                          {acc.optimizationScore !== null
                            ? `${acc.optimizationScore.toFixed(0)}%`
                            : "—"}
                        </td>
                        <td className="p-3.5 text-slate-400 leading-normal">
                          <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-slate-500">{acc.currencyCode}</span>
                            <span className="text-[10px] truncate max-w-xs">{acc.timeZone}</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-3 justify-end pt-2 border-t border-slate-800">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setSubAccounts([])}
            className="w-full sm:w-auto text-slate-400 hover:text-white"
          >
            ← Back
          </Button>
          <Button
            type="button"
            disabled={loading}
            onClick={handleImportAccounts}
            className="w-full sm:w-auto px-6 py-3.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800/80 text-white font-bold rounded-xl shadow-lg transition-all text-sm flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Importing...
              </>
            ) : (
              `Import Checked Accounts (${selectedIds.size}) →`
            )}
          </Button>
        </div>
      </div>
    );
  }

  // --- Step 1: CONNECTION SELECTION VIEW ---
  return (
    <div className="max-w-md mx-auto space-y-6">
      <div className="text-center">
        <div className="inline-flex items-center justify-center p-2 bg-indigo-600/10 text-indigo-400 rounded-xl mb-4 border border-indigo-500/20">
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
            />
          </svg>
        </div>
        <h2 className="text-2xl font-extrabold tracking-tight bg-gradient-to-r from-slate-100 to-slate-300 bg-clip-text text-transparent">
          Select Google Ads Account
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          Connected as <span className="text-indigo-400 font-semibold">{connectedEmail}</span>
        </p>
      </div>

      {error && (
        <div className="p-3 bg-red-900/30 border border-red-500/20 text-red-200 text-sm rounded-xl">
          {error}
        </div>
      )}

      <form onSubmit={handleFetchSubAccounts} className="space-y-6">
        {!useCustomInput ? (
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Available Manager / Client Accounts
            </label>
            <select
              value={selectedMccId}
              onChange={(e) => setSelectedMccId(e.target.value)}
              className="block w-full px-3.5 py-3 bg-slate-950/80 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-white rounded-xl text-sm transition-all outline-none"
            >
              {initialAccounts.map((acc) => (
                <option key={acc.id} value={acc.id} className="bg-slate-950">
                  {acc.name} ({formatCustomerId(acc.id)}) {acc.manager ? "[Manager]" : ""}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => setUseCustomInput(true)}
              className="text-xs text-indigo-400 hover:underline mt-2.5 inline-block"
            >
              Or enter a Customer ID manually...
            </button>
          </div>
        ) : (
          <div>
            <label htmlFor="custom-mcc" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Enter Google Ads Customer ID (10-digit)
            </label>
            <input
              id="custom-mcc"
              type="text"
              required
              placeholder="e.g. 123-456-7890"
              value={customMccId}
              onChange={(e) => setCustomMccId(e.target.value)}
              className="block w-full px-3.5 py-2.5 bg-slate-950/80 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-white rounded-xl text-sm transition-all outline-none"
            />

            {initialAccounts.length > 0 && (
              <button
                type="button"
                onClick={() => setUseCustomInput(false)}
                className="text-xs text-indigo-400 hover:underline mt-2.5 inline-block"
              >
                ← Back to list
              </button>
            )}
          </div>
        )}

        <div>
          <Button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800/80 text-white font-bold rounded-xl shadow-lg transition-all text-sm flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Fetching sub-accounts...
              </>
            ) : (
              "Connect Selected Account →"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
