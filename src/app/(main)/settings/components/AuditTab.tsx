"use client";

import { Filter, History, Info, Search, User as UserIcon } from "lucide-react";
import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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

interface AuditLogData {
  id: number;
  actorId: string | null;
  action: string;
  targetTable: string;
  targetId: string;
  metadata: any;
  createdAt: string;
  actor: {
    id: string;
    name: string;
    email: string;
    image: string | null;
  } | null;
}

interface AuditTabProps {
  auditLogs: AuditLogData[];
}

const getActionBadgeVariant = (action: string) => {
  if (action.includes("FAILED") || action.includes("DELETE")) {
    return "destructive";
  }
  if (
    action.includes("CREATE") ||
    action.includes("ROLL") ||
    action.includes("SENT")
  ) {
    return "default";
  }
  if (action.includes("SAVE") || action.includes("UPDATE")) {
    return "secondary";
  }
  return "outline";
};

export function AuditTab({ auditLogs }: AuditTabProps) {
  const [auditSearch, setAuditSearch] = useState("");
  const [auditFilter, setAuditFilter] = useState("all");
  const [selectedAuditLog, setSelectedAuditLog] = useState<AuditLogData | null>(
    null,
  );

  const filteredAuditLogs = auditLogs.filter((log) => {
    const actorName = log.actor?.name || "System";
    const actorEmail = log.actor?.email || "";
    const matchesSearch =
      actorName.toLowerCase().includes(auditSearch.toLowerCase()) ||
      actorEmail.toLowerCase().includes(auditSearch.toLowerCase()) ||
      log.action.toLowerCase().includes(auditSearch.toLowerCase()) ||
      log.targetTable.toLowerCase().includes(auditSearch.toLowerCase());

    if (!matchesSearch) return false;

    if (auditFilter !== "all") {
      const lowerAction = log.action.toLowerCase();
      const lowerTable = log.targetTable.toLowerCase();

      if (auditFilter === "triage") {
        return (
          lowerAction.includes("triage") ||
          lowerAction.includes("target") ||
          lowerTable.includes("triage")
        );
      }
      if (auditFilter === "rules") {
        return (
          lowerAction.includes("rule") ||
          lowerAction.includes("threshold") ||
          lowerTable.includes("rule")
        );
      }
      if (auditFilter === "user") {
        return (
          lowerAction.includes("member") ||
          lowerAction.includes("invite") ||
          lowerTable.includes("member") ||
          lowerTable.includes("invite")
        );
      }
      if (auditFilter === "security") {
        return (
          lowerAction.includes("key") ||
          lowerAction.includes("token") ||
          lowerAction.includes("auth") ||
          lowerTable.includes("connection")
        );
      }
      if (auditFilter === "system") {
        return (
          lowerAction.includes("sync") ||
          lowerAction.includes("briefing") ||
          lowerAction.includes("cron")
        );
      }
    }

    return true;
  });

  return (
    <>
      <Card className="border-slate-200 shadow-sm overflow-hidden animate-in fade-in duration-200">
        <CardHeader className="bg-slate-50 border-b border-slate-100 p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-800">
              <History className="w-4 h-4 text-indigo-500" />
              Administrative Audit Logs
            </CardTitle>
            <CardDescription className="text-xs">
              History of configurations changed by digital strategists or
              external Claude MCP actions.
            </CardDescription>
          </div>
          {/* SEARCH AND FILTERS */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search actor, action, table..."
                value={auditSearch}
                onChange={(e) => setAuditSearch(e.target.value)}
                className="pl-8 text-xs h-9 bg-white"
              />
            </div>
            <div className="flex items-center gap-1.5 bg-white border rounded-lg px-2 py-1 text-xs text-slate-600">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={auditFilter}
                onChange={(e) => setAuditFilter(e.target.value)}
                className="bg-transparent border-none focus:outline-none text-xs font-medium cursor-pointer"
              >
                <option value="all">All Actions</option>
                <option value="triage">Triage & Targets</option>
                <option value="rules">Alert Rules</option>
                <option value="user">User Management</option>
                <option value="security">Security & API</option>
                <option value="system">Briefings / System</option>
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50/50">
              <TableRow>
                <TableHead className="w-[160px] pl-6 text-xs font-bold text-slate-600">
                  Timestamp
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-600">
                  Actor
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-600">
                  Action
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-600">
                  Target
                </TableHead>
                <TableHead className="text-right pr-6 text-xs font-bold text-slate-600">
                  Inspection
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAuditLogs.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="h-24 text-center text-xs text-slate-500 font-sans"
                  >
                    No audit logs match criteria.
                  </TableCell>
                </TableRow>
              ) : (
                filteredAuditLogs.map((log) => {
                  const isSystem = log.actorId === "SYSTEM_AUTOMATION";
                  const isMcp = log.actorId === "MCP_AGENT";
                  const actorName =
                    log.actor?.name ||
                    (isMcp
                      ? "Claude MCP Agent"
                      : isSystem
                        ? "System Automation"
                        : "System");
                  const actorEmail =
                    log.actor?.email ||
                    (isMcp
                      ? "mcp-agent@uprisedigital.com"
                      : isSystem
                        ? "system@uprisedigital.com"
                        : "");

                  return (
                    <TableRow
                      key={log.id}
                      className="hover:bg-slate-50/50 transition-colors"
                    >
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
                              {isMcp ? (
                                "AI"
                              ) : isSystem ? (
                                "SYS"
                              ) : (
                                <UserIcon className="w-3 h-3 text-slate-500" />
                              )}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex flex-col">
                            <span className="text-xs font-semibold text-slate-800">
                              {actorName}
                            </span>
                            {actorEmail && (
                              <span className="text-[10px] text-slate-400 font-mono">
                                {actorEmail}
                              </span>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={getActionBadgeVariant(log.action) as any}
                          className="text-[10px] py-0"
                        >
                          {log.action}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-xs font-medium text-slate-700 font-mono">
                            {log.targetTable}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            ID: {log.targetId}
                          </span>
                        </div>
                      </TableCell>
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
        </CardContent>
      </Card>

      {/* AUDIT LOG INSPECTOR DIALOG */}
      <Dialog
        open={selectedAuditLog !== null}
        onOpenChange={(open) => !open && setSelectedAuditLog(null)}
      >
        <DialogContent className="max-w-xl bg-white border border-slate-200">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <History className="w-4 h-4 text-indigo-500" />
              Audit Log Details
            </DialogTitle>
            <DialogDescription className="text-xs">
              Full structured metadata audit trail details.
            </DialogDescription>
          </DialogHeader>
          {selectedAuditLog && (
            <div className="space-y-4 pt-2 font-sans text-xs">
              <div className="grid grid-cols-2 gap-4 border-b pb-4">
                <div className="space-y-0.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Timestamp
                  </span>
                  <span className="font-semibold text-slate-800">
                    {new Date(selectedAuditLog.createdAt).toLocaleString(
                      "en-AU",
                      {
                        weekday: "long",
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      },
                    )}
                  </span>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Action Badge
                  </span>
                  <Badge
                    variant={
                      getActionBadgeVariant(selectedAuditLog.action) as any
                    }
                    className="text-[10px]"
                  >
                    {selectedAuditLog.action}
                  </Badge>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Target Table
                  </span>
                  <span className="font-mono text-slate-700 font-semibold">
                    {selectedAuditLog.targetTable}
                  </span>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Target Item ID
                  </span>
                  <span className="font-mono text-slate-700 font-semibold">
                    {selectedAuditLog.targetId}
                  </span>
                </div>
              </div>

              {/* ACTOR CARD */}
              <div className="p-3 bg-slate-50 border rounded-lg flex items-center gap-3">
                <Avatar className="w-8 h-8 border">
                  <AvatarImage src={selectedAuditLog.actor?.image || ""} />
                  <AvatarFallback className="bg-slate-100 text-xs">
                    {selectedAuditLog.actorId === "MCP_AGENT"
                      ? "AI"
                      : selectedAuditLog.actorId === "SYSTEM_AUTOMATION"
                        ? "SYS"
                        : "U"}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="font-bold text-slate-800">
                    {selectedAuditLog.actor?.name ||
                      (selectedAuditLog.actorId === "MCP_AGENT"
                        ? "Claude MCP Agent"
                        : selectedAuditLog.actorId === "SYSTEM_AUTOMATION"
                          ? "System Automation"
                          : "System Agent")}
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono">
                    Actor ID: {selectedAuditLog.actorId || "unknown_system_id"}
                  </div>
                </div>
              </div>

              {/* STRUCTURED METADATA INSPECTION */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Change Details
                </span>
                {selectedAuditLog.metadata ? (
                  <div className="bg-slate-900 border text-slate-200 rounded-lg p-4 font-mono text-[10px] max-h-60 overflow-y-auto leading-relaxed shadow-inner">
                    <pre className="whitespace-pre-wrap">
                      {JSON.stringify(selectedAuditLog.metadata, null, 2)}
                    </pre>
                  </div>
                ) : (
                  <span className="text-slate-400 text-xs italic">
                    No additional metadata registered for this action.
                  </span>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
