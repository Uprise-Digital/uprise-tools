"use client";

import {
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Filter,
  Info,
  Mail,
  Search,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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

interface EmailsTabProps {
  emailLogs: EmailLogData[];
}

const formatEmailType = (type: string) => {
  if (type === "morning_briefing") return "Morning Briefing";
  if (type === "scheduled_report") return "Scheduled Report";
  if (type === "on_demand_report") return "On-Demand Report";
  return type;
};

export function EmailsTab({ emailLogs }: EmailsTabProps) {
  const [emailSearch, setEmailSearch] = useState("");
  const [emailStatusFilter, setEmailStatusFilter] = useState("all");
  const [emailTypeFilter, setEmailTypeFilter] = useState("all");
  const [selectedEmailLog, setSelectedEmailLog] = useState<EmailLogData | null>(
    null,
  );
  const [copiedText, setCopiedText] = useState("");

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopiedText(""), 2000);
  };

  const filteredEmailLogs = emailLogs.filter((email) => {
    const accountName = email.accountName || "";
    const matchesSearch =
      email.recipient.toLowerCase().includes(emailSearch.toLowerCase()) ||
      email.subject.toLowerCase().includes(emailSearch.toLowerCase()) ||
      email.emailType.toLowerCase().includes(emailSearch.toLowerCase()) ||
      accountName.toLowerCase().includes(emailSearch.toLowerCase());

    if (!matchesSearch) return false;

    if (emailStatusFilter !== "all" && email.status !== emailStatusFilter) {
      return false;
    }

    if (emailTypeFilter !== "all" && email.emailType !== emailTypeFilter) {
      return false;
    }

    return true;
  });

  return (
    <>
      <Card className="border-slate-200 shadow-sm overflow-hidden animate-in fade-in duration-200">
        <CardHeader className="bg-slate-50 border-b border-slate-100 p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-800">
              <Mail className="w-4 h-4 text-indigo-500" />
              Email Delivery Statuses
            </CardTitle>
            <CardDescription className="text-xs">
              Log of outgoing Resend email dispatches for briefings, automated
              schedules, and on-demand campaigns.
            </CardDescription>
          </div>
          {/* SEARCH AND FILTERS */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search recipient, subject, client..."
                value={emailSearch}
                onChange={(e) => setEmailSearch(e.target.value)}
                className="pl-8 text-xs h-9 bg-white"
              />
            </div>
            <div className="flex items-center gap-1.5 bg-white border rounded-lg px-2 py-1 text-xs text-slate-600">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={emailTypeFilter}
                onChange={(e) => setEmailTypeFilter(e.target.value)}
                className="bg-transparent border-none focus:outline-none text-xs font-medium cursor-pointer"
              >
                <option value="all">All Types</option>
                <option value="morning_briefing">Morning Briefings</option>
                <option value="scheduled_report">Scheduled Reports</option>
                <option value="on_demand_report">On-Demand Reports</option>
              </select>
            </div>
            <div className="flex items-center gap-1.5 bg-white border rounded-lg px-2 py-1 text-xs text-slate-600">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={emailStatusFilter}
                onChange={(e) => setEmailStatusFilter(e.target.value)}
                className="bg-transparent border-none focus:outline-none text-xs font-medium cursor-pointer"
              >
                <option value="all">All Statuses</option>
                <option value="success">Success</option>
                <option value="failed">Failed</option>
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50/50">
              <TableRow>
                <TableHead className="w-[160px] pl-6 text-xs font-bold text-slate-600">
                  Sent At
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-600">
                  Type
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-600">
                  Recipient
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-600">
                  Subject / Client
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-600">
                  Status
                </TableHead>
                <TableHead className="text-right pr-6 text-xs font-bold text-slate-600">
                  Inspection
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEmailLogs.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="h-24 text-center text-xs text-slate-500 font-sans"
                  >
                    No email delivery logs match criteria.
                  </TableCell>
                </TableRow>
              ) : (
                filteredEmailLogs.map((email) => {
                  const isSuccess = email.status === "success";

                  return (
                    <TableRow
                      key={email.id}
                      className="hover:bg-slate-50/50 transition-colors"
                    >
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
                        <Badge
                          variant="outline"
                          className="text-[10px] font-medium text-slate-700 bg-slate-50"
                        >
                          {formatEmailType(email.emailType)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs font-medium text-slate-800 max-w-[200px] truncate">
                        {email.recipient}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-xs font-semibold text-slate-700 truncate max-w-[240px]">
                            {email.subject}
                          </span>
                          {email.accountName && (
                            <span className="text-[10px] text-slate-400 font-medium">
                              Account: {email.accountName}
                            </span>
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
                            Bounced / Failed
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
        </CardContent>
      </Card>

      {/* EMAIL LOG INSPECTOR DIALOG */}
      <Dialog
        open={selectedEmailLog !== null}
        onOpenChange={(open) => !open && setSelectedEmailLog(null)}
      >
        <DialogContent className="max-w-xl bg-white border border-slate-200">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Mail className="w-4 h-4 text-indigo-500" />
              Email Log Details
            </DialogTitle>
            <DialogDescription className="text-xs">
              Outbound Resend delivery statistics and tracing log.
            </DialogDescription>
          </DialogHeader>
          {selectedEmailLog && (
            <div className="space-y-4 pt-2 font-sans text-xs">
              <div className="grid grid-cols-2 gap-4 border-b pb-4">
                <div className="space-y-0.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Sent Timestamp
                  </span>
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
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Email Type
                  </span>
                  <Badge
                    variant="outline"
                    className="text-[10px] text-slate-700 bg-slate-50 py-0"
                  >
                    {formatEmailType(selectedEmailLog.emailType)}
                  </Badge>
                </div>
                <div className="space-y-0.5 col-span-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Recipients
                  </span>
                  <span className="font-semibold text-slate-800 select-all font-mono break-all leading-normal">
                    {selectedEmailLog.recipient}
                  </span>
                </div>
                <div className="space-y-0.5 col-span-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Subject Line
                  </span>
                  <span className="font-bold text-slate-800 text-sm leading-normal">
                    {selectedEmailLog.subject}
                  </span>
                </div>
              </div>

              {/* RESEND MESSAGE ID CARD */}
              {selectedEmailLog.resendId && (
                <div className="p-3 bg-slate-50 border rounded-lg flex items-center justify-between gap-3">
                  <div className="space-y-0.5 min-w-0">
                    <span className="text-[9px] font-bold text-indigo-500 uppercase tracking-wider block">
                      Resend Message ID
                    </span>
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
                  <span className="text-[10px] font-bold text-rose-500 uppercase tracking-wider block">
                    Error / Failure Log
                  </span>
                  <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-lg p-4 font-mono text-[10px] leading-relaxed shadow-sm flex gap-2 items-start">
                    <XCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                    <pre className="whitespace-pre-wrap font-mono leading-relaxed">
                      {selectedEmailLog.error}
                    </pre>
                  </div>
                </div>
              )}

              {/* CLIENT ACCOUNT LINK */}
              {selectedEmailLog.accountName && (
                <div className="p-3 border rounded-lg bg-slate-50/50 flex items-center justify-between text-xs text-slate-650 font-sans">
                  <span>
                    Linked Client Account:{" "}
                    <strong className="text-slate-800 font-bold">
                      {selectedEmailLog.accountName}
                    </strong>
                  </span>
                  {selectedEmailLog.adAccountId && (
                    <a
                      href={`/accounts/${selectedEmailLog.adAccountId}`}
                      className="text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 hover:underline"
                    >
                      View Client Account
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
