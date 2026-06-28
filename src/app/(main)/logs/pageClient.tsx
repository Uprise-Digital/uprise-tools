"use client";

import {
  History,
  Mail,
  Search,
  Filter,
  Info,
  User as UserIcon,
  ChevronLeft,
  ChevronRight,
  Download,
  Copy,
  Check,
  XCircle,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface AuditLogData {
  id: number;
  actorId: string | null;
  action: string;
  targetTable: string;
  targetId: string;
  metadata: any;
  createdAt: string;
  actor: {
    name: string;
    email: string;
    image: string | null;
  } | null;
}

interface EmailLogData {
  id: number;
  adAccountId: number | null;
  recipient: string;
  subject: string;
  emailType: string;
  status: string;
  error: string | null;
  resendId: string | null;
  sentAt: string;
  accountName: string | null;
}

const formatEmailType = (type: string) => {
  if (type === "morning_briefing") return "Morning Briefing";
  if (type === "scheduled_report") return "Scheduled Report";
  if (type === "on_demand_report") return "On-Demand Report";
  return type;
};

interface LogsClientProps {
  tab: string;
  page: number;
  limit: number;
  totalCount: number;
  auditLogs: AuditLogData[];
  emailLogs: EmailLogData[];
}

export default function LogsClient({
  tab,
  page,
  limit,
  totalCount,
  auditLogs,
  emailLogs,
}: LogsClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Search input local state
  const [searchInput, setSearchInput] = useState(searchParams.get("search") || "");
  const [copiedText, setCopiedText] = useState("");
  const [selectedAuditLog, setSelectedAuditLog] = useState<AuditLogData | null>(null);
  const [selectedEmailLog, setSelectedEmailLog] = useState<EmailLogData | null>(null);

  // Debounce search update to URL search params
  useEffect(() => {
    const handler = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (searchInput) {
        params.set("search", searchInput);
      } else {
        params.delete("search");
      }
      params.set("page", "1"); // Reset to page 1 on search change
      router.push(`${pathname}?${params.toString()}`);
    }, 450);

    return () => clearTimeout(handler);
  }, [searchInput, pathname, router, searchParams]);

  // URL parameters modifier
  const updateQueryParam = (name: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== "all") {
      params.set(name, value);
    } else {
      params.delete(name);
    }
    params.set("page", "1"); // Reset page
    router.push(`${pathname}?${params.toString()}`);
  };

  const setPage = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", newPage.toString());
    router.push(`${pathname}?${params.toString()}`);
  };

  const setLimit = (newLimit: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("limit", newLimit.toString());
    params.set("page", "1");
    router.push(`${pathname}?${params.toString()}`);
  };

  const handleTabChange = (newTab: string) => {
    const params = new URLSearchParams();
    params.set("tab", newTab);
    params.set("page", "1");
    params.set("limit", "25");
    setSearchInput("");
    router.push(`${pathname}?${params.toString()}`);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopiedText(""), 2000);
  };

  // CSV Exporter Utility
  const exportToCsv = () => {
    const headers =
      tab === "audit"
        ? ["ID", "Timestamp", "Actor Name", "Actor Email", "Action", "Target Table", "Target ID", "Metadata"]
        : ["ID", "Timestamp", "Recipient", "Subject", "Email Type", "Status", "Resend ID", "Error"];

    const rows =
      tab === "audit"
        ? auditLogs.map((log) => [
            log.id,
            new Date(log.createdAt).toLocaleString("en-AU"),
            log.actor?.name || "System",
            log.actor?.email || "",
            log.action,
            log.targetTable,
            log.targetId,
            JSON.stringify(log.metadata || {}),
          ])
        : emailLogs.map((email) => [
            email.id,
            new Date(email.sentAt).toLocaleString("en-AU"),
            email.recipient,
            email.subject,
            email.emailType,
            email.status,
            email.resendId || "",
            email.error || "",
          ]);

    const csvContent =
      "data:text/csv;charset=utf-8,\uFEFF" +
      [
        headers.join(","),
        ...rows.map((e) =>
          e
            .map((val) => {
              const textStr = String(val === null || val === undefined ? "" : val);
              return `"${textStr.replace(/"/g, '""')}"`;
            })
            .join(","),
        ),
      ].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${tab}_logs_export_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Logs exported successfully.");
  };

  const getActionBadgeVariant = (action: string) => {
    if (action.includes("FAILED") || action.includes("DELETE")) return "destructive";
    if (action.includes("CREATE") || action.includes("ROLL") || action.includes("SENT")) return "default";
    if (action.includes("SAVE") || action.includes("UPDATE")) return "secondary";
    return "outline";
  };

  const totalPages = Math.ceil(totalCount / limit);
  const startRange = (page - 1) * limit + 1;
  const endRange = Math.min(page * limit, totalCount);

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto p-4 md:p-6 font-sans">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Platform Logs</h1>
          <p className="text-sm text-slate-500 mt-1">
            Command Center for compliance auditing, strategists actions, and Resend email dispatches.
          </p>
        </div>
        <Button
          onClick={exportToCsv}
          variant="outline"
          size="sm"
          className="text-xs flex items-center gap-2 border-slate-200"
        >
          <Download className="w-3.5 h-3.5" />
          Export page to CSV
        </Button>
      </div>

      {/* DASHBOARD TAB CONTROLS */}
      <div className="flex border-b border-slate-200 gap-6">
        <button
          className={`pb-3 text-sm font-semibold transition-all border-b-2 px-1 flex items-center gap-2 ${
            tab === "audit"
              ? "border-indigo-600 text-indigo-600 animate-fade-in"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
          onClick={() => handleTabChange("audit")}
        >
          <History className="w-4 h-4" />
          Audit Trail
        </button>
        <button
          className={`pb-3 text-sm font-semibold transition-all border-b-2 px-1 flex items-center gap-2 ${
            tab === "emails"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
          onClick={() => handleTabChange("emails")}
        >
          <Mail className="w-4 h-4" />
          Email Deliverability
        </button>
      </div>

      {/* FILTER PANEL */}
      <div className="bg-white border rounded-xl shadow-sm p-4 flex flex-col md:flex-row md:items-center gap-3 justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            placeholder={tab === "audit" ? "Search actor, action type, table..." : "Search recipient, subject, client..."}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9 h-9 text-xs"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {tab === "audit" ? (
            <div className="flex items-center gap-1.5 border rounded-lg px-2.5 py-1.5 text-xs text-slate-600 bg-slate-50/50">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={searchParams.get("action") || "all"}
                onChange={(e) => updateQueryParam("action", e.target.value)}
                className="bg-transparent border-none focus:outline-none text-xs font-semibold cursor-pointer"
              >
                <option value="all">All Action Categories</option>
                <option value="triage">Triage & Agreed Targets</option>
                <option value="rules">Alert Rules</option>
                <option value="user">User Management</option>
                <option value="security">Security & API Permissions</option>
                <option value="system">Briefings / System</option>
              </select>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-1.5 border rounded-lg px-2.5 py-1.5 text-xs text-slate-600 bg-slate-50/50">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                <select
                  value={searchParams.get("emailType") || "all"}
                  onChange={(e) => updateQueryParam("emailType", e.target.value)}
                  className="bg-transparent border-none focus:outline-none text-xs font-semibold cursor-pointer"
                >
                  <option value="all">All Email Types</option>
                  <option value="morning_briefing">Morning Briefings</option>
                  <option value="scheduled_report">Scheduled Reports</option>
                  <option value="on_demand_report">On-Demand Reports</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5 border rounded-lg px-2.5 py-1.5 text-xs text-slate-600 bg-slate-50/50">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                <select
                  value={searchParams.get("status") || "all"}
                  onChange={(e) => updateQueryParam("status", e.target.value)}
                  className="bg-transparent border-none focus:outline-none text-xs font-semibold cursor-pointer"
                >
                  <option value="all">All Statuses</option>
                  <option value="success">Success / Delivered</option>
                  <option value="failed">Failed / Bounced</option>
                </select>
              </div>
            </>
          )}

          {/* PAGE SIZE SELECTOR */}
          <div className="flex items-center gap-1.5 border rounded-lg px-2.5 py-1.5 text-xs text-slate-600 bg-slate-50/50">
            <span className="text-slate-400">Rows:</span>
            <select
              value={limit}
              onChange={(e) => setLimit(parseInt(e.target.value, 10))}
              className="bg-transparent border-none focus:outline-none text-xs font-semibold cursor-pointer"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>
      </div>

      {/* DATA TABLES */}
      {tab === "audit" ? (
        <Card className="border-slate-200 shadow-sm overflow-hidden">
          <Table>
            <TableHeader className="bg-slate-50/50">
              <TableRow>
                <TableHead className="w-[160px] pl-6 text-xs font-bold text-slate-600">Timestamp</TableHead>
                <TableHead className="text-xs font-bold text-slate-600">Actor</TableHead>
                <TableHead className="text-xs font-bold text-slate-600">Action Type</TableHead>
                <TableHead className="text-xs font-bold text-slate-600">Target Table</TableHead>
                <TableHead className="text-xs font-bold text-slate-600">Target ID</TableHead>
                <TableHead className="text-right pr-6 text-xs font-bold text-slate-600">Inspect</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {auditLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-xs text-slate-500 font-sans">
                    No matching audit logs found.
                  </TableCell>
                </TableRow>
              ) : (
                auditLogs.map((log) => {
                  const isMcp = log.actorId === "MCP_AGENT";
                  const isSystem = log.actorId === "SYSTEM_AUTOMATION";
                  const actorName = log.actor?.name || (isMcp ? "Claude MCP Agent" : isSystem ? "System Automation" : "System Agent");
                  const actorEmail = log.actor?.email || "";

                  return (
                    <TableRow key={log.id} className="hover:bg-slate-50/50 transition-colors">
                      <TableCell className="font-mono text-[10px] text-slate-500 pl-6">
                        {new Date(log.createdAt).toLocaleString("en-AU", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="w-6 h-6 border">
                            <AvatarImage src={log.actor?.image || ""} />
                            <AvatarFallback className="bg-slate-100 text-[10px]">
                              {isMcp ? "AI" : isSystem ? "SYS" : <UserIcon className="w-3 h-3 text-slate-500" />}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex flex-col">
                            <span className="text-xs font-semibold text-slate-800">{actorName}</span>
                            {actorEmail && <span className="text-[9px] text-slate-400 font-mono">{actorEmail}</span>}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getActionBadgeVariant(log.action) as any} className="text-[10px] py-0">
                          {log.action}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-slate-700">{log.targetTable}</TableCell>
                      <TableCell className="font-mono text-xs text-slate-500">ID: {log.targetId}</TableCell>
                      <TableCell className="text-right pr-6">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedAuditLog(log)}
                          className="h-8 w-8 p-0 rounded-full"
                        >
                          <Info className="w-4 h-4 text-slate-500" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </Card>
      ) : (
        <Card className="border-slate-200 shadow-sm overflow-hidden">
          <Table>
            <TableHeader className="bg-slate-50/50">
              <TableRow>
                <TableHead className="w-[160px] pl-6 text-xs font-bold text-slate-600">Sent At</TableHead>
                <TableHead className="text-xs font-bold text-slate-600">Type</TableHead>
                <TableHead className="text-xs font-bold text-slate-600">Recipient</TableHead>
                <TableHead className="text-xs font-bold text-slate-600">Subject / Client</TableHead>
                <TableHead className="text-xs font-bold text-slate-600">Status</TableHead>
                <TableHead className="text-right pr-6 text-xs font-bold text-slate-600">Inspect</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {emailLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-xs text-slate-500 font-sans">
                    No matching email delivery logs found.
                  </TableCell>
                </TableRow>
              ) : (
                emailLogs.map((email) => {
                  const isSuccess = email.status === "success";

                  return (
                    <TableRow key={email.id} className="hover:bg-slate-50/50 transition-colors">
                      <TableCell className="font-mono text-[10px] text-slate-500 pl-6">
                        {new Date(email.sentAt).toLocaleString("en-AU", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px] font-medium text-slate-700 bg-slate-50 py-0">
                          {formatEmailType(email.emailType)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs font-medium text-slate-800 max-w-[200px] truncate">
                        {email.recipient}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-xs font-semibold text-slate-700 truncate max-w-[280px]">{email.subject}</span>
                          {email.accountName && (
                            <span className="text-[9px] text-slate-400 font-medium">Account: {email.accountName}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {isSuccess ? (
                          <span className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded font-bold inline-flex items-center gap-1">
                            <CheckCircle2 className="w-2.5 h-2.5 text-emerald-500" />
                            Delivered
                          </span>
                        ) : (
                          <span className="text-[10px] text-rose-700 bg-rose-50 border border-rose-100 px-1.5 py-0.5 rounded font-bold inline-flex items-center gap-1">
                            <XCircle className="w-2.5 h-2.5 text-rose-500" />
                            Failed
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right pr-6">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedEmailLog(email)}
                          className="h-8 w-8 p-0 rounded-full"
                        >
                          <Info className="w-4 h-4 text-slate-500" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* PAGINATION TOOLBAR */}
      {totalPages > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white border rounded-xl p-4 shadow-sm text-xs text-slate-500">
          <div>
            Showing <strong className="text-slate-800">{startRange}</strong> to{" "}
            <strong className="text-slate-800">{endRange}</strong> of{" "}
            <strong className="text-slate-800">{totalCount}</strong> entries
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="icon"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="h-8 w-8 border-slate-200"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>

            {Array.from({ length: totalPages }).map((_, index) => {
              const pageNum = index + 1;
              if (pageNum === 1 || pageNum === totalPages || Math.abs(pageNum - page) <= 1) {
                return (
                  <Button
                    key={pageNum}
                    variant={page === pageNum ? "default" : "outline"}
                    size="sm"
                    onClick={() => setPage(pageNum)}
                    className="h-8 w-8 text-xs border-slate-200"
                  >
                    {pageNum}
                  </Button>
                );
              }
              if (pageNum === 2 || pageNum === totalPages - 1) {
                return <span key={pageNum} className="text-slate-300 px-1">...</span>;
              }
              return null;
            })}

            <Button
              variant="outline"
              size="icon"
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
              className="h-8 w-8 border-slate-200"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* AUDIT LOG DETAILED POPUP */}
      <Dialog open={selectedAuditLog !== null} onOpenChange={(open) => !open && setSelectedAuditLog(null)}>
        <DialogContent className="max-w-xl bg-white border border-slate-200">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <History className="w-4 h-4 text-indigo-500" />
              Audit Log Details
            </DialogTitle>
            <DialogDescription className="text-xs">
              Review full trace history metrics for security auditing.
            </DialogDescription>
          </DialogHeader>
          {selectedAuditLog && (
            <div className="space-y-4 pt-2 font-sans text-xs">
              <div className="grid grid-cols-2 gap-4 border-b pb-4">
                <div className="space-y-0.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Timestamp</span>
                  <span className="font-semibold text-slate-800">
                    {new Date(selectedAuditLog.createdAt).toLocaleString("en-AU", {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </span>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Action Badge</span>
                  <Badge variant={getActionBadgeVariant(selectedAuditLog.action) as any} className="text-[10px]">
                    {selectedAuditLog.action}
                  </Badge>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Target Table</span>
                  <span className="font-mono text-slate-700 font-semibold">{selectedAuditLog.targetTable}</span>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Target Item ID</span>
                  <span className="font-mono text-slate-700 font-semibold">{selectedAuditLog.targetId}</span>
                </div>
              </div>

              {/* ACTOR CARD */}
              <div className="p-3 bg-slate-50 border rounded-lg flex items-center gap-3">
                <Avatar className="w-8 h-8 border">
                  <AvatarFallback className="bg-slate-100 text-xs">
                    {selectedAuditLog.actorId === "MCP_AGENT" ? "AI" : selectedAuditLog.actorId === "SYSTEM_AUTOMATION" ? "SYS" : "U"}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="font-bold text-slate-800">
                    {selectedAuditLog.actor?.name || 
                      (selectedAuditLog.actorId === "MCP_AGENT" ? "Claude MCP Agent" : selectedAuditLog.actorId === "SYSTEM_AUTOMATION" ? "System Automation" : "System Agent")}
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono">
                    Actor ID: {selectedAuditLog.actorId || "unknown_system_id"}
                  </div>
                </div>
              </div>

              {/* STRUCTURED METADATA INSPECTION */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Change Details</span>
                {selectedAuditLog.metadata ? (
                  <div className="bg-slate-900 border text-slate-200 rounded-lg p-4 font-mono text-[10px] max-h-60 overflow-y-auto leading-relaxed shadow-inner">
                    <pre className="whitespace-pre-wrap">{JSON.stringify(selectedAuditLog.metadata, null, 2)}</pre>
                  </div>
                ) : (
                  <span className="text-slate-400 text-xs italic">No additional metadata registered for this action.</span>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* EMAIL LOG DETAILED POPUP */}
      <Dialog open={selectedEmailLog !== null} onOpenChange={(open) => !open && setSelectedEmailLog(null)}>
        <DialogContent className="max-w-xl bg-white border border-slate-200">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Mail className="w-4 h-4 text-indigo-500" />
              Email Log Details
            </DialogTitle>
            <DialogDescription className="text-xs">
              Review Resend API delivery metrics.
            </DialogDescription>
          </DialogHeader>
          {selectedEmailLog && (
            <div className="space-y-4 pt-2 font-sans text-xs">
              <div className="grid grid-cols-2 gap-4 border-b pb-4">
                <div className="space-y-0.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Sent Timestamp</span>
                  <span className="font-semibold text-slate-800">
                    {new Date(selectedEmailLog.sentAt).toLocaleString("en-AU", {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </span>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Email Type</span>
                  <Badge variant="outline" className="text-[10px] text-slate-700 bg-slate-50 py-0">
                    {formatEmailType(selectedEmailLog.emailType)}
                  </Badge>
                </div>
                <div className="space-y-0.5 col-span-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Recipients</span>
                  <span className="font-semibold text-slate-800 select-all font-mono break-all leading-normal">
                    {selectedEmailLog.recipient}
                  </span>
                </div>
                <div className="space-y-0.5 col-span-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Subject Line</span>
                  <span className="font-bold text-slate-800 text-sm leading-normal">
                    {selectedEmailLog.subject}
                  </span>
                </div>
              </div>

              {/* RESEND MESSAGE ID CARD */}
              {selectedEmailLog.resendId && (
                <div className="p-3 bg-slate-50 border rounded-lg flex items-center justify-between gap-3">
                  <div className="space-y-0.5 min-w-0">
                    <span className="text-[9px] font-bold text-indigo-500 uppercase tracking-wider block">Resend Message ID</span>
                    <span className="font-mono text-[10px] text-slate-700 truncate block font-bold">
                      {selectedEmailLog.resendId}
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(selectedEmailLog.resendId!)}
                    className="h-8 shrink-0 flex items-center gap-1.5 text-[10px]"
                  >
                    {copiedText === selectedEmailLog.resendId ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-slate-500" />
                        Copy
                      </>
                    )}
                  </Button>
                </div>
              )}

              {/* TROUBLESHOOTING ERROR PANEL */}
              {selectedEmailLog.error && (
                <div className="space-y-2">
                  <span className="text-[10px] font-bold text-rose-500 uppercase tracking-wider block">Error / Failure Log</span>
                  <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-lg p-4 font-mono text-[10px] leading-relaxed shadow-sm flex gap-2 items-start">
                    <XCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                    <pre className="whitespace-pre-wrap font-mono leading-relaxed">{selectedEmailLog.error}</pre>
                  </div>
                </div>
              )}

              {/* CLIENT ACCOUNT LINK */}
              {selectedEmailLog.accountName && (
                <div className="p-3 border rounded-lg bg-slate-50/50 flex items-center justify-between text-xs text-slate-600">
                  <span>Linked Client Account: <strong>{selectedEmailLog.accountName}</strong></span>
                  {selectedEmailLog.adAccountId && (
                    <a
                      href={`/accounts/${selectedEmailLog.adAccountId}`}
                      className="text-indigo-600 font-semibold hover:underline flex items-center gap-1 text-[10px]"
                    >
                      View Account
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
