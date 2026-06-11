"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getDashboardMetricsAction } from "@/actions/dashboard.actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
    ArrowLeft, DollarSign, MousePointerClick, Eye, Target,
    TrendingUp, Calendar, Percent, LineChart, Activity
} from "lucide-react";
import {
    Area, AreaChart, CartesianGrid, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer
} from "recharts";

interface ClientDashboardProps {
    account: {
        id: number;
        googleAccountId: string;
        name: string;
        currencyCode: string | null;
    };
}

export default function ClientDashboard({ account }: ClientDashboardProps) {
    const router = useRouter();

    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];

    const [startDate, setStartDate] = useState(firstDay);
    const [endDate, setEndDate] = useState(lastDay);

    const [isLoading, setIsLoading] = useState(true);
    const [data, setData] = useState<any>(null);

    useEffect(() => {
        let isMounted = true;
        setIsLoading(true);

        getDashboardMetricsAction(account.id, account.googleAccountId, startDate, endDate)
            .then((res) => {
                if (isMounted && res.success && res.data) {
                    setData(res.data);
                }
            })
            .catch(console.error)
            .finally(() => {
                if (isMounted) setIsLoading(false);
            });

        return () => { isMounted = false; };
    }, [account.id, account.googleAccountId, startDate, endDate]);

    const fCur = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: account.currencyCode || 'AUD', maximumFractionDigits: 2 }).format(isNaN(val) ? 0 : val);
    const fNum = (val: number) => new Intl.NumberFormat('en-US').format(isNaN(val) ? 0 : val);
    const fPct = (val: number) => `${(isNaN(val) ? 0 : val).toFixed(2)}%`;

    return (
        <div className="space-y-6 p-4 md:p-8 max-w-[1600px] mx-auto">
            {/* HEADER AREA */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <Button variant="outline" size="icon" onClick={() => router.push('/admin/accounts')}>
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{account.name}</h1>
                        <p className="text-xs font-mono text-slate-500">ID: {account.googleAccountId}</p>
                    </div>
                </div>

                <div className="flex items-center gap-2 bg-white p-2 rounded-xl border border-slate-200 shadow-sm">
                    <Calendar className="h-4 w-4 text-slate-400 ml-2" />
                    <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="border-0 h-8 w-[120px]" />
                    <span>—</span>
                    <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="border-0 h-8 w-[120px]" />
                </div>
            </div>

            {/* KPI GRID */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                {[
                    { label: "Cost", val: data ? fCur(data.totals.spend) : null, icon: DollarSign, color: "text-blue-600", bg: "bg-blue-50" },
                    { label: "Clicks", val: data ? fNum(data.totals.clicks) : null, icon: MousePointerClick, color: "text-purple-600", bg: "bg-purple-50" },
                    { label: "Impressions", val: data ? fNum(data.totals.impressions) : null, icon: Eye, color: "text-amber-600", bg: "bg-amber-50" },
                    { label: "CTR", val: data ? fPct(data.totals.ctr) : null, icon: Percent, color: "text-indigo-600", bg: "bg-indigo-50" },
                ].map((kpi, i) => (
                    <Card key={i} className="shadow-sm">
                        <CardContent className="p-4 flex items-center justify-between">
                            <div className="space-y-0.5">
                                <p className="text-[10px] font-bold uppercase text-slate-500">{kpi.label}</p>
                                <p className="text-xl font-bold">{isLoading ? <Skeleton className="h-6 w-16" /> : kpi.val}</p>
                            </div>
                            <div className={`p-2 rounded-lg ${kpi.bg}`}><kpi.icon className={`h-4 w-4 ${kpi.color}`} /></div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* TRIPLE GRAPH GRID */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {[
                    { title: "Cost", dataKey: "spend", color: "#3b82f6", format: fCur },
                    { title: "CPC", dataKey: "cpc", color: "#8b5cf6", format: fCur },
                    { title: "CTR", dataKey: "ctr", color: "#10b981", format: fPct }
                ].map((chart) => (
                    <Card key={chart.title} className="shadow-sm">
                        <CardHeader className="py-4"><CardTitle className="text-sm font-bold">{chart.title}</CardTitle></CardHeader>
                        <CardContent className="h-[200px]">
                            {isLoading ? <Skeleton className="h-full w-full" /> : (
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={data?.timeSeries}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                        <XAxis dataKey="date" hide />
                                        <YAxis hide domain={['auto', 'auto']} />
                                        <RechartsTooltip
                                            formatter={(v: any) => [chart.format(Number(v)), chart.title]}
                                            contentStyle={{ fontSize: '12px', borderRadius: '8px' }}
                                        />
                                        <Area type="monotone" dataKey={chart.dataKey} stroke={chart.color} fill={chart.color} fillOpacity={0.1} />
                                    </AreaChart>
                                </ResponsiveContainer>
                            )}
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* CAMPAIGN BREAKDOWN TABLE */}
            <Card className="shadow-sm overflow-hidden">
                <CardHeader className="py-4 border-b"><CardTitle className="text-base font-bold">Campaign Breakdown</CardTitle></CardHeader>
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow className="text-[10px] uppercase">
                                <TableHead>Campaign</TableHead>
                                <TableHead className="text-right">Cost</TableHead>
                                <TableHead className="text-right">Conv.</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {data?.campaigns.map((camp: any, i: number) => (
                                <TableRow key={i} className="text-xs">
                                    <TableCell className="font-medium truncate max-w-[150px]">{camp.campaignName}</TableCell>
                                    <TableCell className="text-right font-mono">{fCur(camp.spend)}</TableCell>
                                    <TableCell className="text-right font-mono font-bold text-emerald-600">{fNum(camp.conversions)}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </Card>
        </div>
    );
}