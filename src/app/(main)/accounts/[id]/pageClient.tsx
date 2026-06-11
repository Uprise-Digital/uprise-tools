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
    ArrowLeft, Calendar, DollarSign, MousePointerClick, Eye,
    Target, Percent, LineChart, Activity
} from "lucide-react";
import {
    Area, AreaChart, CartesianGrid, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer
} from "recharts";

interface ClientDashboardProps {
    account: { id: number; googleAccountId: string; name: string; currencyCode: string | null; };
}

export default function ClientDashboard({ account }: ClientDashboardProps) {
    const router = useRouter();
    const today = new Date();
    const [startDate, setStartDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0]);
    const [isLoading, setIsLoading] = useState(true);
    const [data, setData] = useState<any>(null);

    useEffect(() => {
        setIsLoading(true);
        getDashboardMetricsAction(account.id, account.googleAccountId, startDate, endDate)
            .then((res) => { if (res.success && res.data) setData(res.data); })
            .catch(console.error)
            .finally(() => setIsLoading(false));
    }, [account.id, account.googleAccountId, startDate, endDate]);

    const fCur = (v: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: account.currencyCode || 'AUD' }).format(isNaN(v) ? 0 : v);
    const fNum = (v: number) => new Intl.NumberFormat('en-US').format(isNaN(v) ? 0 : v);
    const fPct = (v: number) => `${(isNaN(v) ? 0 : v).toFixed(2)}%`;

    return (
        <div className="space-y-6 p-4 mt-0 pt-0 max-w-400 mx-auto">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <Button variant="outline" size="icon" onClick={() => router.push('/accounts')}><ArrowLeft className="h-4 w-4" /></Button>
                    <div>
                        <h1 className="text-2xl font-bold">{account.name}</h1>
                        <p className="text-xs font-mono text-slate-500">ID: {account.googleAccountId}</p>
                    </div>
                </div>

                {/* REFACTORED DATE CONTAINER */}
                <div className="flex items-center bg-white rounded-xl border border-slate-200 shadow-sm px-4 py-1.5 gap-2 w-full md:w-auto">
                    <Calendar className="h-4 w-4 text-slate-400 shrink-0" />

                    <Input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="border-none h-8 w-[110px] p-0 text-sm focus-visible:ring-0 shadow-none [color-scheme:light]"
                    />

                    <span className="text-slate-300 font-light">—</span>

                    <Input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="border-none h-8 w-[110px] p-0 text-sm focus-visible:ring-0 shadow-none [color-scheme:light]"
                    />
                </div>
            </div>

            {/* KPI GRID */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: "Cost", val: data?.totals.spend, icon: DollarSign, color: "text-blue-600", bg: "bg-blue-50", f: fCur },
                    { label: "Clicks", val: data?.totals.clicks, icon: MousePointerClick, color: "text-purple-600", bg: "bg-purple-50", f: fNum },
                    { label: "Impressions", val: data?.totals.impressions, icon: Eye, color: "text-amber-600", bg: "bg-amber-50", f: fNum },
                    { label: "CTR", val: data?.totals.ctr, icon: Percent, color: "text-indigo-600", bg: "bg-indigo-50", f: fPct },
                    { label: "Conversions", val: data?.totals.conversions, icon: Target, color: "text-emerald-600", bg: "bg-emerald-50", f: fNum },
                    { label: "Cost / Conv.", val: data?.totals.cpa, icon: Activity, color: "text-rose-600", bg: "bg-rose-50", f: fCur },
                    { label: "Conv. Rate", val: data?.totals.convRate, icon: LineChart, color: "text-teal-600", bg: "bg-teal-50", f: fPct },
                    { label: "Avg. CPC", val: data?.totals.cpc, icon: DollarSign, color: "text-slate-600", bg: "bg-slate-100", f: fCur },
                ].map((kpi, i) => (
                    <Card key={i} className="mt-0 pt-0 shadow-sm">
                        <CardContent className="p-4 flex items-center justify-between">
                            <div className="space-y-0.5">
                                <p className="text-[10px] font-bold uppercase text-slate-500">{kpi.label}</p>
                                <p className="text-xl font-bold">{isLoading ? <Skeleton className="h-6 w-16" /> : kpi.f(kpi.val)}</p>
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
                    <Card key={chart.title} className="mt-0 pt-0 shadow-sm">
                        <CardHeader className="py-4"><CardTitle className="text-sm font-bold">{chart.title}</CardTitle></CardHeader>
                        <CardContent className="h-50">
                            {isLoading ? <Skeleton className="h-full w-full" /> : (
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart margin={{ top: 10, right: 10, left: -40, bottom: 0 }} data={data?.timeSeries}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                        <XAxis
                                            dataKey="date"
                                            stroke="#94a3b8"
                                            fontSize={10}
                                            tickLine={false}
                                            padding={{ left: 0, right: 0 }}
                                            axisLine={false}
                                            dy={10} // Adds space between the axis and the text
                                            minTickGap={20} // Prevents labels from overlapping
                                            tickFormatter={(value) => {
                                                const date = new Date(value);
                                                return date.toLocaleDateString('en-US', {
                                                    month: 'short',
                                                    day: 'numeric'
                                                });
                                            }}
                                        />
                                        <YAxis
                                            fontSize={10}
                                            tickLine={false}
                                            axisLine={false}
                                            dy={10} // Adds space between the axis and the text
                                            minTickGap={20} // Prevents labels from overlapping
                                            domain={['auto', 'auto']} />
                                        <RechartsTooltip formatter={(v: any) => [chart.format(Number(v)), chart.title]} />
                                        <Area type="monotone" dataKey={chart.dataKey} stroke={chart.color} fill={chart.color} fillOpacity={0.1} />
                                    </AreaChart>
                                </ResponsiveContainer>
                            )}
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* FULL CAMPAIGN TABLE */}
            <Card className="shadow-sm overflow-hidden mt-0 pt-0">
                <Table>
                    <TableHeader className="bg-slate-50">
                        <TableRow>
                            <TableHead>Campaign</TableHead>
                            <TableHead className="text-right">Cost</TableHead>
                            <TableHead className="text-right">Clicks</TableHead>
                            <TableHead className="text-right">Impr.</TableHead>
                            <TableHead className="text-right">CTR</TableHead>
                            <TableHead className="text-right">CPC</TableHead>
                            <TableHead className="text-right">Conv.</TableHead>
                            <TableHead className="text-right">CPA</TableHead>
                            <TableHead className="text-right">Conv. Rate</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {data?.campaigns.map((c: any, i: number) => (
                            <TableRow key={i} className="text-xs">
                                <TableCell className="font-medium max-w-[200px] truncate">{c.campaignName}</TableCell>
                                <TableCell className="text-right font-mono">{fCur(c.spend)}</TableCell>
                                <TableCell className="text-right font-mono">{fNum(c.clicks)}</TableCell>
                                <TableCell className="text-right font-mono">{fNum(c.impressions)}</TableCell>
                                <TableCell className="text-right font-mono">{fPct(c.ctr)}</TableCell>
                                <TableCell className="text-right font-mono">{fCur(c.cpc)}</TableCell>
                                <TableCell className="text-right font-mono font-bold">{fNum(c.conversions)}</TableCell>
                                <TableCell className="text-right font-mono">{fCur(c.cpa)}</TableCell>
                                <TableCell className="text-right font-mono">{fPct(c.convRate)}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </Card>
        </div>
    );
}