// app/admin/accounts/[id]/client-page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getDashboardMetricsAction } from "@/actions/dashboard.actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, DollarSign, MousePointerClick, Eye, Target, TrendingUp, Calendar } from "lucide-react";
import {
    Area,
    AreaChart,
    CartesianGrid,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer
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

    // Default to current month
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];

    const [startDate, setStartDate] = useState(firstDay);
    const [endDate, setEndDate] = useState(lastDay);

    const [isLoading, setIsLoading] = useState(true);
    const [data, setData] = useState<{ totals: any, timeSeries: any[] } | null>(null);

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

    // Format currency based on account settings
    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: account.currencyCode || 'AUD',
            maximumFractionDigits: 0
        }).format(val);
    };

    return (
        <div className="space-y-8 p-8 max-w-[1600px] mx-auto">
            {/* HEADER AREA */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={() => router.push('/admin/accounts')}
                    >
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-slate-900">{account.name}</h1>
                        <p className="text-sm font-mono text-slate-500 mt-1">ID: {account.googleAccountId}</p>
                    </div>
                </div>

                {/* DATE CONTROLS */}
                <div className="flex items-center gap-3 bg-white p-2 rounded-xl border border-slate-200 shadow-sm">
                    <Calendar className="h-4 w-4 text-slate-400 ml-2" />
                    <Input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="border-0 bg-transparent shadow-none h-8 w-[140px] focus-visible:ring-0"
                    />
                    <span className="text-slate-300">—</span>
                    <Input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="border-0 bg-transparent shadow-none h-8 w-[140px] focus-visible:ring-0"
                    />
                </div>
            </div>

            {/* KPI OVERVIEW CARDS */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="border-slate-200 shadow-sm">
                    <CardContent className="p-6">
                        <div className="flex justify-between items-start">
                            <div className="space-y-2">
                                <p className="text-sm font-medium text-slate-500">Total Spend</p>
                                {isLoading ? <Skeleton className="h-8 w-24" /> : (
                                    <p className="text-3xl font-bold text-slate-900">
                                        {formatCurrency(data?.totals.totalSpend || 0)}
                                    </p>
                                )}
                            </div>
                            <div className="p-2 bg-blue-50 rounded-lg">
                                <DollarSign className="h-5 w-5 text-blue-600" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-slate-200 shadow-sm">
                    <CardContent className="p-6">
                        <div className="flex justify-between items-start">
                            <div className="space-y-2">
                                <p className="text-sm font-medium text-slate-500">Conversions</p>
                                {isLoading ? <Skeleton className="h-8 w-24" /> : (
                                    <p className="text-3xl font-bold text-slate-900">
                                        {Number(data?.totals.totalConversions || 0).toLocaleString(undefined, { maximumFractionDigits: 1 })}
                                    </p>
                                )}
                            </div>
                            <div className="p-2 bg-emerald-50 rounded-lg">
                                <Target className="h-5 w-5 text-emerald-600" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-slate-200 shadow-sm">
                    <CardContent className="p-6">
                        <div className="flex justify-between items-start">
                            <div className="space-y-2">
                                <p className="text-sm font-medium text-slate-500">Total Clicks</p>
                                {isLoading ? <Skeleton className="h-8 w-24" /> : (
                                    <p className="text-3xl font-bold text-slate-900">
                                        {Number(data?.totals.totalClicks || 0).toLocaleString()}
                                    </p>
                                )}
                            </div>
                            <div className="p-2 bg-purple-50 rounded-lg">
                                <MousePointerClick className="h-5 w-5 text-purple-600" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-slate-200 shadow-sm">
                    <CardContent className="p-6">
                        <div className="flex justify-between items-start">
                            <div className="space-y-2">
                                <p className="text-sm font-medium text-slate-500">Impressions</p>
                                {isLoading ? <Skeleton className="h-8 w-24" /> : (
                                    <p className="text-3xl font-bold text-slate-900">
                                        {Number(data?.totals.totalImpressions || 0).toLocaleString()}
                                    </p>
                                )}
                            </div>
                            <div className="p-2 bg-amber-50 rounded-lg">
                                <Eye className="h-5 w-5 text-amber-600" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* MAIN CHART AREA */}
            <Card className="border-slate-200 shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <div className="space-y-1">
                        <CardTitle className="text-lg font-bold">Spend vs Conversions Trend</CardTitle>
                        <p className="text-sm text-slate-500">Daily performance metrics for the selected period.</p>
                    </div>
                    <div className="flex items-center gap-4 text-sm font-medium">
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-blue-500" />
                            <span className="text-slate-600">Spend</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-emerald-500" />
                            <span className="text-slate-600">Conversions</span>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="h-[400px] w-full flex items-center justify-center">
                            <Skeleton className="h-full w-full rounded-xl" />
                        </div>
                    ) : !data?.timeSeries || data.timeSeries.length === 0 ? (
                        <div className="h-[400px] w-full flex flex-col items-center justify-center text-slate-400 border-2 border-dashed rounded-xl border-slate-100">
                            <TrendingUp className="h-8 w-8 mb-2 opacity-20" />
                            <p>No data available for this date range.</p>
                        </div>
                    ) : (
                        <div className="h-[400px] w-full mt-4">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={data.timeSeries} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorSpend" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                        </linearGradient>
                                        <linearGradient id="colorConv" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                                            <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                    <XAxis
                                        dataKey="date"
                                        tickFormatter={(val: any) => {
                                            const d = new Date(val);
                                            return `${d.getDate()} ${d.toLocaleString('default', { month: 'short' })}`;
                                        }}
                                        stroke="#94a3b8"
                                        fontSize={12}
                                        tickLine={false}
                                        axisLine={false}
                                        dy={10}
                                    />
                                    <YAxis
                                        yAxisId="left"
                                        stroke="#94a3b8"
                                        fontSize={12}
                                        tickLine={false}
                                        axisLine={false}
                                        tickFormatter={(val: any) => `$${val}`}
                                    />
                                    <YAxis
                                        yAxisId="right"
                                        orientation="right"
                                        stroke="#94a3b8"
                                        fontSize={12}
                                        tickLine={false}
                                        axisLine={false}
                                    />
                                    <Tooltip
                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                        labelStyle={{ color: '#64748b', marginBottom: '4px' }}
                                    />
                                    <Area
                                        yAxisId="left"
                                        type="monotone"
                                        dataKey="spend"
                                        stroke="#3b82f6"
                                        strokeWidth={3}
                                        fillOpacity={1}
                                        fill="url(#colorSpend)"
                                    />
                                    <Area
                                        yAxisId="right"
                                        type="monotone"
                                        dataKey="conversions"
                                        stroke="#10b981"
                                        strokeWidth={3}
                                        fillOpacity={1}
                                        fill="url(#colorConv)"
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}