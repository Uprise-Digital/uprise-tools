"use client";

import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Copy,
  ExternalLink,
  History,
  Mail,
  RefreshCw,
  Search,
  ShieldCheck,
  User,
  XCircle,
} from "lucide-react";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { getClientReportSendingHistoryAction } from "@/actions/client-report-draft.actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface LogEntry {
  id: number;
  adAccountId: number | null;
  accountName: string | null;
  recipient: string;
  subject: string;
  emailType: string;
  status: string;
  error: string | null;
  resendId: string | null;
  sentAt: string;
}

export function AgencyReportHistoryView() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "success" | "failed">(
    "all",
  );

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const res = await getClientReportSendingHistoryAction({ limit: 100 });
      if (res.success) {
        setLogs(res.logs);
      } else {
        toast.error(res.error || "Failed to load sending history");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to fetch logs");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const filteredLogs = logs.filter((log) => {
    if (statusFilter !== "all" && log.status !== statusFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchClient = log.accountName?.toLowerCase().includes(q);
      const matchRecipient = log.recipient.toLowerCase().includes(q);
      const matchSubject = log.subject.toLowerCase().includes(q);
      return matchClient || matchRecipient || matchSubject;
    }
    return true;
  });

  const totalSuccess = logs.filter((l) => l.status === "success").length;
  const totalFailed = logs.filter((l) => l.status === "failed").length;

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      {/* Top Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="py-4 shadow-xs border-slate-200 bg-white">
          <CardHeader className="pb-1.5">
            <CardDescription className="text-xs uppercase font-bold tracking-wider text-slate-400">
              Total Dispatches
            </CardDescription>
            <CardTitle className="text-2xl font-bold text-slate-900">
              {logs.length}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-slate-500">
              Across all client report automations &amp; drafts
            </p>
          </CardContent>
        </Card>

        <Card className="py-4 shadow-xs border-slate-200 bg-white">
          <CardHeader className="pb-1.5">
            <CardDescription className="text-xs uppercase font-bold tracking-wider text-slate-400">
              Successful Deliveries
            </CardDescription>
            <CardTitle className="text-2xl font-bold text-emerald-600">
              {totalSuccess}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-slate-500">
              Delivered via Resend safely
            </p>
          </CardContent>
        </Card>

        <Card className="py-4 shadow-xs border-slate-200 bg-white">
          <CardHeader className="pb-1.5">
            <CardDescription className="text-xs uppercase font-bold tracking-wider text-slate-400">
              Failed Attempts
            </CardDescription>
            <CardTitle className="text-2xl font-bold text-slate-900">
              {totalFailed === 0 ? (
                <span className="text-slate-400">0</span>
              ) : (
                <span className="text-rose-600">{totalFailed}</span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-slate-500">
              Zero delivery errors in standard runs
            </p>
          </CardContent>
        </Card>

        <Card className="py-4 shadow-xs border-slate-200 bg-white">
          <CardHeader className="pb-1.5">
            <CardDescription className="text-xs uppercase font-bold tracking-wider text-slate-400">
              Agency Safeguard
            </CardDescription>
            <CardTitle className="text-sm font-bold text-emerald-700 flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4" />
              Active (Diverted to Seyone)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-slate-500">
              External client addresses blocked
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Table Card */}
      <Card className="gap-0 shadow-xs border-slate-200 overflow-hidden bg-white py-0">
        <CardHeader className="p-6 border-b border-slate-100 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <History className="h-4 w-4 text-slate-500" />
              Agency-Wide Email Dispatch Log
            </CardTitle>
            <CardDescription className="text-xs text-slate-500 mt-1">
              Live audit trail of all executive briefings, scheduled reports, and manual test emails sent across all clients.
            </CardDescription>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={fetchLogs}
            disabled={isLoading}
            className="h-8 text-xs font-semibold gap-1.5 cursor-pointer"
          >
            <RefreshCw
              className={cn("h-3.5 w-3.5", isLoading && "animate-spin")}
            />
            Refresh Log
          </Button>
        </CardHeader>

        {/* Filter & Search Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/40 px-6 py-3">
          <div className="relative flex-1 min-w-[240px] max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <Input
              placeholder="Search by client, recipient, or subject..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 text-xs h-9 bg-white border-slate-200 shadow-none"
            />
          </div>

          <div className="flex items-center bg-slate-100/80 p-1 rounded-xl text-xs font-medium text-slate-600 border border-slate-200/60">
            <button
              type="button"
              onClick={() => setStatusFilter("all")}
              className={cn(
                "px-3 py-1 rounded-lg transition-all cursor-pointer",
                statusFilter === "all"
                  ? "bg-white text-slate-900 shadow-2xs font-bold"
                  : "hover:text-slate-900",
              )}
            >
              All ({logs.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("success")}
              className={cn(
                "px-3 py-1 rounded-lg transition-all cursor-pointer",
                statusFilter === "success"
                  ? "bg-white text-emerald-700 shadow-2xs font-bold"
                  : "hover:text-slate-900",
              )}
            >
              Delivered ({totalSuccess})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("failed")}
              className={cn(
                "px-3 py-1 rounded-lg transition-all cursor-pointer",
                statusFilter === "failed"
                  ? "bg-white text-rose-700 shadow-2xs font-bold"
                  : "hover:text-slate-900",
              )}
            >
              Failed ({totalFailed})
            </button>
          </div>
        </div>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/75 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Date / Time</th>
                  <th className="py-3 px-4">Client Account</th>
                  <th className="py-3 px-4">Dispatched To</th>
                  <th className="py-3 px-4">Subject</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Resend ID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      Loading agency dispatch history...
                    </td>
                  </tr>
                ) : filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      No email dispatches match your filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log) => (
                    <tr
                      key={log.id}
                      className="hover:bg-slate-50/50 transition-colors"
                    >
                      <td className="py-3 px-4 whitespace-nowrap text-slate-600 font-mono text-[11px]">
                        {new Date(log.sentAt).toLocaleString(undefined, {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>

                      <td className="py-3 px-4 font-bold text-slate-900">
                        {log.accountName || "All Clients / Agency"}
                      </td>

                      <td className="py-3 px-4 text-slate-700 max-w-[200px] truncate">
                        <span className="font-medium text-slate-800">
                          {log.recipient}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-slate-700 max-w-[260px] truncate font-medium">
                        {log.subject}
                      </td>

                      <td className="py-3 px-4">
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px] font-medium capitalize",
                            log.emailType === "client_executive_report"
                              ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                              : "bg-slate-50 text-slate-600 border-slate-200",
                          )}
                        >
                          {log.emailType.replace(/_/g, " ")}
                        </Badge>
                      </td>

                      <td className="py-3 px-4 text-center">
                        {log.status === "success" ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            <CheckCircle2 className="h-3 w-3" />
                            Delivered
                          </span>
                        ) : (
                          <span
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200"
                            title={log.error || "Delivery failed"}
                          >
                            <XCircle className="h-3 w-3" />
                            Failed
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right font-mono text-[10px] text-slate-400 max-w-[140px] truncate">
                        {log.resendId ? (
                          <span
                            className="cursor-pointer hover:text-slate-600"
                            onClick={() => {
                              navigator.clipboard.writeText(log.resendId!);
                              toast.success("Resend ID copied!");
                            }}
                            title="Click to copy Resend ID"
                          >
                            {log.resendId}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
