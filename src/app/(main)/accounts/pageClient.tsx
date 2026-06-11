// app/accounts/pageClient.tsx
"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { syncAdAccountsAction } from "@/actions/ads.actions";
import { SyncButton } from "@/components/sync-button";
import { ReportAutomationTrigger } from "@/components/reportAutomationTrigger";

// Define the type based on your Drizzle schema return type
type AccountWithSchedules = {
    id: number;
    googleAccountId: string;
    name: string;
    currencyCode: string | null;
    isActive: boolean;
    reportSchedules: any[];
};

interface AccountsClientPageProps {
    accounts: AccountWithSchedules[];
}

export default function AccountsClientPage({ accounts }: AccountsClientPageProps) {
    const router = useRouter();

    const handleRowClick = (accountId: number) => {
        router.push(`/accounts/${accountId}`);
    };

    return (
        <div className="space-y-6 p-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Ad Accounts</h1>
                    <p className="text-muted-foreground">Manage synced client accounts from Uprise MCC.</p>
                </div>
                <SyncButton action={syncAdAccountsAction} />
            </div>

            <Card className="border-slate-200 shadow-sm">
                <CardHeader>
                    <CardTitle>Connected Clients</CardTitle>
                    <CardDescription>Accounts currently being monitored for alerts and reports.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader className="bg-slate-50/50">
                            <TableRow>
                                <TableHead className="font-bold">Account Name</TableHead>
                                <TableHead className="font-bold">Google ID</TableHead>
                                <TableHead className="font-bold">Currency</TableHead>
                                <TableHead className="font-bold">Status</TableHead>
                                <TableHead className="text-right font-bold">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {accounts.map((acc) => (
                                <TableRow
                                    key={acc.id}
                                    className="hover:bg-slate-50/50 transition-colors cursor-pointer"
                                    onClick={() => handleRowClick(acc.id)}
                                >
                                    <TableCell className="font-semibold text-slate-900">{acc.name}</TableCell>
                                    <TableCell className="font-mono text-xs text-slate-500">{acc.googleAccountId}</TableCell>
                                    <TableCell className="text-slate-600">{acc.currencyCode}</TableCell>
                                    <TableCell>
                                        <Badge variant={acc.isActive ? "default" : "secondary"} className="rounded-md">
                                            {acc.isActive ? "Active" : "Inactive"}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {/* stopPropagation prevents the row click from firing when clicking buttons */}
                                        <div
                                            className="flex justify-end gap-2"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <ReportAutomationTrigger
                                                adAccount={{
                                                    id: acc.id,
                                                    googleAccountId: acc.googleAccountId,
                                                    name: acc.name
                                                }}
                                                initialRules={acc.reportSchedules || []}
                                            />
                                            <Button variant="ghost" size="sm" className="text-slate-500 hover:text-slate-900">
                                                Alerts
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}