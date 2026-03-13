// app/admin/accounts/page.tsx
import { db } from "@/db";
import { adAccounts } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { syncAdAccountsAction } from "@/actions/ads.actions";
import { SyncButton } from "@/components/sync-button";
import { GenerateReportButton } from "@/components/generate-report-button"; // New component

export default async function AdAccountsPage() {
    const accounts = await db.query.adAccounts.findMany({
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

            <Card>
                <CardHeader>
                    <CardTitle>Connected Clients</CardTitle>
                    <CardDescription>Accounts currently being monitored for alerts and reports.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Account Name</TableHead>
                                <TableHead>Google ID</TableHead>
                                <TableHead>Currency</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {accounts.map((acc) => (
                                <TableRow key={acc.id}>
                                    <TableCell className="font-medium">{acc.name}</TableCell>
                                    <TableCell className="font-mono text-xs">{acc.googleAccountId}</TableCell>
                                    <TableCell>{acc.currencyCode}</TableCell>
                                    <TableCell>
                                        <Badge variant={acc.isActive ? "default" : "secondary"}>
                                            {acc.isActive ? "Active" : "Inactive"}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right flex justify-end gap-2">
                                        <GenerateReportButton
                                            googleAccountId={acc.googleAccountId}
                                            clientName={acc.name}
                                        />
                                        <Button variant="ghost" size="sm">
                                            Alerts
                                        </Button>
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