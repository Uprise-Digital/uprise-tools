// app/admin/accounts/page.tsx
import { db } from "@/db";
import { adAccounts } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { syncAdAccountsAction } from "@/actions/ads.actions";
import { SyncButton } from "@/components/sync-button";
import {ReportAutomationTrigger} from "@/components/reportAutomationTrigger";

export default async function AdAccountsPage() {
    // Fetch accounts with their associated report schedules
    const accounts = await db.query.adAccounts.findMany({
        with: {
            // Ensure you have defined this relation in your schema.ts
            reportSchedules: true,
        },
        orderBy: (acc, { desc }) => [desc(acc.createdAt)],
    });

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
                                <TableRow key={acc.id} className="hover:bg-slate-50/50 transition-colors">
                                    <TableCell className="font-semibold text-slate-900">{acc.name}</TableCell>
                                    <TableCell className="font-mono text-xs text-slate-500">{acc.googleAccountId}</TableCell>
                                    <TableCell className="text-slate-600">{acc.currencyCode}</TableCell>
                                    <TableCell>
                                        <Badge variant={acc.isActive ? "default" : "secondary"} className="rounded-md">
                                            {acc.isActive ? "Active" : "Inactive"}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-2">
                                            {/* Passing the real rules from the DB */}
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