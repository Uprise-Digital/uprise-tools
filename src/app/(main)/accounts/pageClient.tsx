// app/accounts/pageClient.tsx
"use client";

import { ChevronLeft, ChevronRight, Download, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { syncAdAccountsAction } from "@/actions/ads.actions";
import { ReportAutomationTrigger } from "@/components/reportAutomationTrigger";
import { SyncButton } from "@/components/sync-button";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// Define the type based on your Drizzle schema return type
type AccountWithSchedules = {
  id: number;
  googleAccountId: string;
  name: string;
  currencyCode: string | null;
  isActive: boolean;
  googleStatus: string;
  reportSchedules: any[];
};

interface AccountsClientPageProps {
  accounts: AccountWithSchedules[];
}

export default function AccountsClientPage({
  accounts,
}: AccountsClientPageProps) {
  const router = useRouter();

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  const filteredAccounts = accounts.filter((acc) => {
    return (
      acc.name.toLowerCase().includes(search.toLowerCase()) ||
      acc.googleAccountId.includes(search)
    );
  });

  const totalPages = Math.ceil(filteredAccounts.length / limit);
  const paginatedAccounts = filteredAccounts.slice(
    (page - 1) * limit,
    page * limit,
  );

  useEffect(() => {
    setPage(1);
  }, []);

  const exportClientsToCsv = () => {
    const headers = ["Account Name", "Google ID", "Currency", "Status"];
    const rows = filteredAccounts.map((acc) => [
      acc.name,
      acc.googleAccountId,
      acc.currencyCode || "",
      acc.isActive ? "Active" : "Inactive",
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8,\uFEFF" +
      [
        headers.join(","),
        ...rows.map((e) =>
          e
            .map((val) => {
              const textStr = String(
                val === null || val === undefined ? "" : val,
              );
              return `"${textStr.replace(/"/g, '""')}"`;
            })
            .join(","),
        ),
      ].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `connected_clients_export_${new Date().toISOString().split("T")[0]}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Clients list exported successfully.");
  };

  const handleRowClick = (accountId: number) => {
    router.push(`/accounts/${accountId}`);
  };

  return (
    <div className="space-y-6 mt-0 pt-0">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Ad Accounts</h1>
          <p className="text-muted-foreground">
            Manage synced client accounts from Uprise MCC.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            onClick={exportClientsToCsv}
            variant="outline"
            size="sm"
            className="text-xs flex items-center gap-1.5 border-slate-200"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </Button>
          <SyncButton action={syncAdAccountsAction} />
        </div>
      </div>

      <Card className="border-slate-200 shadow-sm overflow-hidden">
        <CardHeader className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center border-b border-slate-100 bg-slate-50/50 py-4 gap-3">
          <div>
            <CardTitle className="text-base font-bold text-slate-800">
              Connected Clients
            </CardTitle>
            <CardDescription className="text-xs">
              Accounts currently being monitored for alerts and reports.
            </CardDescription>
          </div>
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <Input
              placeholder="Search clients or Google ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 text-xs h-8 bg-white"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50/50">
              <TableRow>
                <TableHead className="font-bold pl-6">Account Name</TableHead>
                <TableHead className="font-bold">Google ID</TableHead>
                <TableHead className="font-bold">Currency</TableHead>
                <TableHead className="font-bold">Status</TableHead>
                <TableHead className="text-right font-bold pr-6">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedAccounts.map((acc) => (
                <TableRow
                  key={acc.id}
                  className="hover:bg-slate-50/50 transition-colors cursor-pointer"
                  onClick={() => handleRowClick(acc.id)}
                >
                  <TableCell className="font-semibold text-slate-900 pl-6">
                    <div className="flex items-center gap-2">
                      <span
                        title={
                          acc.googleStatus === "ENABLED"
                            ? "Google Ads: Active"
                            : acc.googleStatus === "CANCELED"
                              ? "Google Ads: Cancelled"
                              : acc.googleStatus === "SUSPENDED"
                                ? "Google Ads: Suspended"
                                : acc.googleStatus === "DELINKED"
                                  ? "Google Ads: Delinked / Archived"
                                  : `Google Ads: ${acc.googleStatus}`
                        }
                        className={`h-2.5 w-2.5 rounded-full flex-shrink-0 cursor-help ${
                          acc.googleStatus === "ENABLED"
                            ? "bg-emerald-500 shadow-sm shadow-emerald-500/30"
                            : acc.googleStatus === "CANCELED" ||
                                acc.googleStatus === "DELINKED"
                              ? "bg-slate-400"
                              : acc.googleStatus === "SUSPENDED"
                                ? "bg-rose-500 shadow-sm shadow-rose-500/30"
                                : "bg-amber-500"
                        }`}
                      />
                      <span>{acc.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-slate-500">
                    {acc.googleAccountId}
                  </TableCell>
                  <TableCell className="text-slate-600">
                    {acc.currencyCode}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={acc.isActive ? "default" : "secondary"}
                      className="rounded-md"
                    >
                      {acc.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right pr-6">
                    {/* stopPropagation prevents the row click from firing when clicking buttons */}
                    <div
                      className="flex justify-end gap-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ReportAutomationTrigger
                        adAccount={{
                          id: acc.id,
                          googleAccountId: acc.googleAccountId,
                          name: acc.name,
                        }}
                        initialRules={acc.reportSchedules || []}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-slate-500 hover:text-slate-900"
                      >
                        Alerts
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {paginatedAccounts.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="h-24 text-center text-xs text-slate-500 font-sans"
                  >
                    No matching accounts found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>

        {/* PAGINATION CONTROLS */}
        <div className="border-t border-slate-100 p-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div>
            Showing{" "}
            <strong className="text-slate-800">
              {filteredAccounts.length > 0 ? (page - 1) * limit + 1 : 0}
            </strong>{" "}
            to{" "}
            <strong className="text-slate-800">
              {Math.min(page * limit, filteredAccounts.length)}
            </strong>{" "}
            of{" "}
            <strong className="text-slate-800">
              {filteredAccounts.length}
            </strong>{" "}
            accounts
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 border rounded px-2 py-1 bg-white">
              <span className="text-[10px] text-slate-400">Rows:</span>
              <select
                value={limit}
                onChange={(e) => setLimit(parseInt(e.target.value, 10))}
                className="bg-transparent border-none focus:outline-none text-[10px] font-semibold cursor-pointer"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                  className="h-7 w-7 border-slate-200"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </Button>
                {Array.from({ length: totalPages }).map((_, index) => {
                  const pNum = index + 1;
                  return (
                    <Button
                      key={pNum}
                      variant={page === pNum ? "default" : "outline"}
                      size="sm"
                      onClick={() => setPage(pNum)}
                      className="h-7 w-7 text-[10px] border-slate-200"
                    >
                      {pNum}
                    </Button>
                  );
                })}
                <Button
                  variant="outline"
                  size="icon"
                  disabled={page >= totalPages}
                  onClick={() => setPage(page + 1)}
                  className="h-7 w-7 border-slate-200"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
