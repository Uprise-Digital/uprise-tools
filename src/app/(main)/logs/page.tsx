import { db } from "@/db";
import { format } from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { User } from "lucide-react";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

// 1. THIS IS THE ACTUAL PAGE
// It fetches the data securely on the server and passes it down
export default async function LogsPage() {
    // Fetch logs from Postgres and join the actor (user) data
    const logsData = await db.query.auditLogs.findMany({
        with: {
            actor: true, // This uses the Drizzle relation we set up earlier!
        },
        orderBy: (logs, { desc }) => [desc(logs.createdAt)],
        limit: 100, // Good practice to limit so we don't crash the browser
    });

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Audit Logs</h1>
                <p className="text-muted-foreground">A complete history of administrative actions taken within the system.</p>
            </div>

            {/* Render your table with the live database data */}
            <LogsTable data={logsData} />
        </div>
    );
}

// 2. THIS IS YOUR TABLE COMPONENT
// It takes the fetched data and renders the shadcn UI
function LogsTable({ data }: { data: any[] }) {
    const getActionColor = (action: string) => {
        if (action.includes('DELETE') || action.includes('BAN') || action.includes('REMOVE')) return "destructive";
        if (action.includes('CREATE') || action.includes('ADD')) return "default";
        if (action.includes('UPDATE') || action.includes('EDIT')) return "secondary";
        return "outline";
    };

    return (
        <div className="rounded-md border bg-white shadow-sm">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-[180px]">Timestamp</TableHead>
                        <TableHead>Actor</TableHead>
                        <TableHead>Action</TableHead>
                        <TableHead>Target</TableHead>
                        <TableHead className="text-right">Details</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {data.map((log) => (
                        <TableRow key={log.id}>
                            <TableCell className="font-mono text-xs text-muted-foreground">
                                {format(new Date(log.createdAt), "MMM d, HH:mm:ss")}
                            </TableCell>
                            <TableCell>
                                <div className="flex items-center gap-2">
                                    <Avatar className="size-6">
                                        <AvatarImage src={log.actor?.image} />
                                        <AvatarFallback><User className="size-3" /></AvatarFallback>
                                    </Avatar>
                                    <span className="text-sm font-medium">{log.actor?.name || "System"}</span>
                                </div>
                            </TableCell>
                            <TableCell>
                                <Badge variant={getActionColor(log.action) as any}>
                                    {log.action}
                                </Badge>
                            </TableCell>
                            <TableCell className="text-sm">
                                <div className="flex flex-col">
                                    <span className="font-medium">{log.targetTable}</span>
                                    <span className="text-[10px] text-muted-foreground font-mono truncate w-24">
                                        {log.targetId}
                                    </span>
                                </div>
                            </TableCell>
                            <TableCell className="text-right max-w-[200px]">
                                {log.metadata ? (
                                    <pre className="text-[10px] text-left bg-slate-50 p-2 rounded overflow-x-auto whitespace-pre-wrap border">
                                        {JSON.stringify(log.metadata, null, 1)}
                                    </pre>
                                ) : (
                                    <span className="text-muted-foreground text-xs">-</span>
                                )}
                            </TableCell>
                        </TableRow>
                    ))}
                    {data.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                                No logs found.
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </div>
    );
}