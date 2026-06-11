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

    // Formatters
    const fCur = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: account.currencyCode || 'AUD' }).format(val);
    const fNum = (val: number) => new Intl.NumberFormat('en-US').format(val);
    const fPct = (val: number) => `${val.toFixed(2)}%`;

    return (
        <div className="space-y-8 p-8 max-w-[1600px] mx-auto">
            {/* HEADER AREA */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <Button variant="outline" size="icon" onClick={() => router.push('/admin/accounts')}>
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-slate-900">{account.name}</h1>
                        <p className="text-sm font-mono text-slate-500 mt-1">ID: {account.googleAccountId}</p>
                    </div>
                </div>

                <div className="flex items-center gap-3 bg-white p-2 rounded-xl border border-slate-200 shadow-sm">
                    <Calendar className="h-4 w-4 text-slate-400 ml-2" />
                    <Input
                        type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                        className="border-0 bg-transparent shadow-none h-8 w-[140px] focus-visible:ring-0"
                    />
                    <span className="text-slate-300">—</span>
                    <Input
                        type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                        className="border-0 bg-transparent shadow-none h-8 w-[140px] focus-visible:ring-0"
                    />
                </div>
            </div>

            {/* FUNNEL KPI GRID (8 Metrics) */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: "Cost", val: data ? fCur(data.totals.spend) : null, icon: DollarSign, color: "text-blue-600", bg: "bg-blue-50" },
                    { label: "Clicks", val: data ? fNum(data.totals.clicks) : null, icon: MousePointerClick, color: "text-purple-600", bg: "bg-purple-50" },
                    { label: "Impressions", val: data ? fNum(data.totals.impressions) : null, icon: Eye, color: "text-amber-600", bg: "bg-amber-50" },
                    { label: "CTR", val: data ? fPct(data.totals.ctr) : null, icon: Percent, color: "text-indigo-600", bg: "bg-indigo-50" },
                    { label: "Conversions", val: data ? fNum(data.totals.conversions) : null, icon: Target, color: "text-emerald-600", bg: "bg-emerald-50" },
                    { label: "Cost / Conv.", val: data ? fCur(data.totals.cpa) : null, icon: Activity, color: "text-rose-600", bg: "bg-rose-50" },
                    { label: "Conv. Rate", val: data ? fPct(data.totals.convRate) : null, icon: LineChart, color: "text-teal-600", bg: "bg-teal-50" },
                    { label: "Avg. CPC", val: data ? fCur(data.totals.cpc) : null, icon: DollarSign, color: "text-slate-600", bg: "bg-slate-100" },
                ].map((kpi, i) => (
                    <Card key={i} className="border-slate-200 shadow-sm">
                        <CardContent className="p-5">
                            <div className="flex justify-between items-start">
                                <div className="space-y-1">
                                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{kpi.label}</p>
                                    {isLoading ? <Skeleton className="h-7 w-20" /> : <p className="text-2xl font-bold text-slate-900">{kpi.val}</p>}
                                </div>
                                <div className={`p-2 rounded-lg ${kpi.bg}`}>
                                    <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* MAIN CHART AREA */}
            <Card className="border-slate-200 shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-lg font-bold">Performance Over Time</CardTitle>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="h-[350px] w-full flex items-center justify-center"><Skeleton className="h-full w-full rounded-xl" /></div>
                    ) : !data?.timeSeries?.length ? (
                        <div className="h-[350px] w-full flex flex-col items-center justify-center text-slate-400 border-2 border-dashed rounded-xl border-slate-100">
                            <TrendingUp className="h-8 w-8 mb-2 opacity-20" />
                            <p>No data available for this date range.</p>
                        </div>
                    ) : (
                        <div className="h-[350px] w-full mt-4">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={data.timeSeries} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorSpend" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis
                                        dataKey="date"
                                        tickFormatter={(val) => new Date(val).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                        stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} dy={10}
                                    />
                                    <YAxis yAxisId="left" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(val) => `$${val}`} />
                                    <YAxis yAxisId="right" orientation="right" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                                    <RechartsTooltip
                                        contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                        formatter={(value: any, name: any) => [
                                            name === 'spend' ? fCur(Number(value || 0)) : fNum(Number(value || 0)),
                                            String(name).charAt(0).toUpperCase() + String(name).slice(1)
                                        ]}
                                    />
                                    <Area yAxisId="left" type="monotone" dataKey="spend" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorSpend)" />
                                    <Area yAxisId="right" type="monotone" dataKey="conversions" stroke="#10b981" strokeWidth={2} fillOpacity={0} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* CAMPAIGN BREAKDOWN TABLE */}
            <Card className="border-slate-200 shadow-sm overflow-hidden">
                <CardHeader className="bg-slate-50/50 border-b border-slate-100">
                    <CardTitle className="text-lg font-bold">Campaign Breakdown</CardTitle>
                </CardHeader>
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow className="hover:bg-transparent">
                                <TableHead className="w-[300px] font-bold text-slate-700">Campaign Name</TableHead>
                                <TableHead className="text-right font-bold text-slate-700">Cost</TableHead>
                                <TableHead className="text-right font-bold text-slate-700">Clicks</TableHead>
                                <TableHead className="text-right font-bold text-slate-700">Impr.</TableHead>
                                <TableHead className="text-right font-bold text-slate-700">CTR</TableHead>
                                <TableHead className="text-right font-bold text-slate-700">Avg. CPC</TableHead>
                                <TableHead className="text-right font-bold text-slate-700">Conv.</TableHead>
                                <TableHead className="text-right font-bold text-slate-700">Cost / Conv.</TableHead>
                                <TableHead className="text-right font-bold text-slate-700">Conv. Rate</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                Array.from({ length: 3 }).map((_, i) => (
                                    <TableRow key={i}><TableCell colSpan={9}><Skeleton className="h-8 w-full" /></TableCell></TableRow>
                                ))
                            ) : data?.campaigns?.length === 0 ? (
                                <TableRow><TableCell colSpan={9} className="text-center py-8 text-slate-500">No campaign data found.</TableCell></TableRow>
                            ) : (
                                data?.campaigns.map((camp: any, i: number) => (
                                    <TableRow key={i} className="hover:bg-slate-50 transition-colors">
                                        <TableCell className="font-medium text-slate-900 truncate max-w-[300px]">{camp.campaignName}</TableCell>
                                        <TableCell className="text-right font-mono text-xs">{fCur(camp.spend)}</TableCell>
                                        <TableCell className="text-right font-mono text-xs">{fNum(camp.clicks)}</TableCell>
                                        <TableCell className="text-right font-mono text-xs text-slate-500">{fNum(camp.impressions)}</TableCell>
                                        <TableCell className="text-right font-mono text-xs text-slate-500">{fPct(camp.ctr)}</TableCell>
                                        <TableCell className="text-right font-mono text-xs text-slate-500">{fCur(camp.cpc)}</TableCell>
                                        <TableCell className="text-right font-mono text-xs font-semibold text-emerald-600">{fNum(camp.conversions)}</TableCell>
                                        <TableCell className="text-right font-mono text-xs">{fCur(camp.cpa)}</TableCell>
                                        <TableCell className="text-right font-mono text-xs">{fPct(camp.convRate)}</TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </Card>
        </div>
    );
}