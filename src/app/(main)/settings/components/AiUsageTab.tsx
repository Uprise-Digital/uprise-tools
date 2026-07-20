"use client";

import {
  AlertTriangle,
  BrainCircuit,
  CheckCircle2,
  Landmark,
  RotateCw,
  Sparkles,
} from "lucide-react";
import { useState, useTransition } from "react";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import {
  getAiUsageStatsAction,
  syncGeminiPricingAction,
  updateAiUsageSettingsAction,
} from "@/actions/ai-usage.actions";
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
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface AiUsageTabProps {
  initialStats: any;
  orgId: string;
  userRole: string;
}

const COLORS = [
  "hsl(var(--primary))",
  "hsl(217, 91%, 60%)",
  "hsl(142, 71%, 45%)",
  "hsl(38, 92%, 50%)",
  "hsl(262, 83%, 58%)",
  "hsl(316, 70%, 50%)",
  "hsl(199, 89%, 48%)",
  "hsl(32, 95%, 44%)",
];

export function AiUsageTab({ initialStats, orgId, userRole }: AiUsageTabProps) {
  const [stats, setStats] = useState(initialStats);
  const [budgetInput, setBudgetInput] = useState(
    initialStats?.budgetLimit?.toString() || "50.00",
  );
  const [softLimitInput, setSoftLimitInput] = useState(
    initialStats?.softLimitPercentage || 80,
  );
  const [hardLimitInput, setHardLimitInput] = useState(
    initialStats?.hardLimitBlocked !== false,
  );
  const [isPending, startTransition] = useTransition();
  const [isSyncing, setIsSyncing] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const isAdmin = userRole === "admin" || userRole === "owner";

  // Re-fetch stats utility
  const refreshStats = async () => {
    setIsRefreshing(true);
    try {
      const res = await getAiUsageStatsAction();
      if (res.success && "data" in res) {
        setStats(res.data);
        setBudgetInput(res.data.budgetLimit.toString());
        setSoftLimitInput(res.data.softLimitPercentage);
        setHardLimitInput(res.data.hardLimitBlocked);
      }
    } catch (err: any) {
      toast.error("Failed to refresh usage statistics.");
    } finally {
      setIsRefreshing(false);
    }
  };

  // Submit budget config
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;

    startTransition(async () => {
      try {
        const res = await updateAiUsageSettingsAction({
          monthlyBudgetLimit: parseFloat(budgetInput).toFixed(2),
          softLimitPercentage: Number(softLimitInput),
          hardLimitBlocked: hardLimitInput,
        });

        if (res.success) {
          toast.success("AI usage settings updated successfully.");
          await refreshStats();
        } else {
          toast.error(res.error || "Failed to update settings.");
        }
      } catch (err: any) {
        toast.error(err.message || "An error occurred while saving.");
      }
    });
  };

  // Run Manual Pricing Sync
  const handlePricingSync = async () => {
    if (!isAdmin) return;
    setIsSyncing(true);
    try {
      const res = await syncGeminiPricingAction();
      if (res.success) {
        toast.success(
          `Pricing synchronized successfully. Updated ${res.data.count} models.`,
        );
        await refreshStats();
      } else {
        toast.error(res.error || "Failed to synchronize pricing.");
      }
    } catch (err: any) {
      toast.error("Error synchronizing pricing details.");
    } finally {
      setIsSyncing(false);
    }
  };

  if (!stats) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-slate-400 font-medium">
        <AlertTriangle className="w-8 h-8 text-amber-500 mb-2" />
        No AI usage logs or settings configured for this organization.
      </div>
    );
  }

  // Calculate SVG progress ring values
  const radius = 60;
  const stroke = 12;
  const circumference = 2 * Math.PI * radius;
  const percentage = Math.min(Math.max(stats.percentUsed || 0, 0), 100);
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  // Determine meter color state
  const isHardLimitReached =
    (stats.totalSpend || 0) >= (stats.budgetLimit || 0);
  const isSoftLimitReached =
    (stats.totalSpend || 0) >=
    (stats.budgetLimit || 0) * (stats.softLimitPercentage / 100);

  let ringColor = "stroke-indigo-600";
  let textColor = "text-indigo-600 font-bold";
  if (isHardLimitReached) {
    ringColor = "stroke-rose-600";
    textColor = "text-rose-600 font-bold animate-pulse";
  } else if (isSoftLimitReached) {
    ringColor = "stroke-amber-500";
    textColor = "text-amber-500 font-bold";
  }

  return (
    <div className="space-y-6">
      {/* METER & CONFIG GROUP */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* RADIAL PROGRESS SPEND METER */}
        <Card className="py-6 shadow-sm border-slate-200">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm font-bold text-slate-800">
                Monthly AI Spend
              </CardTitle>
              <CardDescription className="text-[11px]">
                Usage limit progress ring
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="icon"
              className="w-7 h-7"
              onClick={refreshStats}
              disabled={isRefreshing}
            >
              <RotateCw
                className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`}
              />
            </Button>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center py-4">
            <div className="relative flex items-center justify-center w-36 h-36">
              {/* Backing Circle */}
              <svg className="w-full h-full transform -rotate-90">
                <circle
                  cx="72"
                  cy="72"
                  r={radius}
                  className="stroke-slate-100 fill-none"
                  strokeWidth={stroke}
                />
                {/* Progress Circle */}
                <circle
                  cx="72"
                  cy="72"
                  r={radius}
                  className={`fill-none transition-all duration-500 ease-out ${ringColor}`}
                  strokeWidth={stroke}
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                />
              </svg>
              {/* Inner text */}
              <div className="absolute flex flex-col items-center justify-center text-center">
                <span className={`text-base ${textColor}`}>
                  {stats.percentUsed}%
                </span>
                <span className="text-[10px] text-slate-400 font-medium">
                  of monthly cap
                </span>
              </div>
            </div>
            <div className="mt-4 text-center">
              <p className="text-xl font-extrabold text-slate-800">
                ${stats.totalSpend.toFixed(2)}{" "}
                <span className="text-xs text-slate-400 font-normal">
                  / ${stats.budgetLimit.toFixed(2)} USD
                </span>
              </p>
              <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1.5 justify-center">
                {isHardLimitReached ? (
                  <>
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                    <span className="text-rose-600 font-bold">
                      Hard Limit Exceeded.
                    </span>
                  </>
                ) : isSoftLimitReached ? (
                  <>
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    <span className="text-amber-600 font-semibold">
                      Soft Limit Exceeded.
                    </span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span className="text-emerald-600 font-medium">
                      System normal (within limits).
                    </span>
                  </>
                )}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* METRICS CARDS */}
        <Card className="py-6 shadow-sm border-slate-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold text-slate-800">
              Activity Overview
            </CardTitle>
            <CardDescription className="text-[11px]">
              Usage quantities for current period
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-1">
            <div className="flex items-center gap-3.5 p-3 rounded-xl bg-slate-50 border border-slate-100">
              <BrainCircuit className="w-7 h-7 text-indigo-600 shrink-0" />
              <div>
                <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                  AI API Queries
                </p>
                <p className="text-lg font-bold text-slate-800">
                  {stats.totalQueries} calls
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3.5 p-3 rounded-xl bg-slate-50 border border-slate-100">
              <Sparkles className="w-7 h-7 text-purple-600 shrink-0" />
              <div>
                <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                  Tokens Processed
                </p>
                <p className="text-lg font-bold text-slate-800">
                  {(stats.totalTokens / 1000).toFixed(1)}k tokens
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3.5 p-3 rounded-xl bg-slate-50 border border-slate-100">
              <Landmark className="w-7 h-7 text-emerald-600 shrink-0" />
              <div>
                <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                  Average Call Cost
                </p>
                <p className="text-lg font-bold text-slate-800">
                  $
                  {stats.totalQueries > 0
                    ? (stats.totalSpend / stats.totalQueries).toFixed(4)
                    : "0.00"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* AI BILLING CONFIGURATION */}
        <Card className="py-6 shadow-sm border-slate-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold text-slate-800">
              Usage & Limits Config
            </CardTitle>
            <CardDescription className="text-[11px]">
              Set monthly AI budget limits
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <form onSubmit={handleSaveSettings} className="space-y-3.5">
              <div>
                <Label
                  htmlFor="monthlyBudgetLimit"
                  className="text-xs font-bold text-slate-600"
                >
                  Monthly Budget Cap (USD)
                </Label>
                <div className="relative mt-1">
                  <span className="absolute left-3 top-2 text-slate-400 text-sm font-medium">
                    $
                  </span>
                  <Input
                    id="monthlyBudgetLimit"
                    type="number"
                    step="0.01"
                    min="1.00"
                    className="pl-7 text-sm"
                    value={budgetInput}
                    onChange={(e) => setBudgetInput(e.target.value)}
                    disabled={!isAdmin || isPending}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <Label
                    htmlFor="softLimitPercentage"
                    className="text-xs font-bold text-slate-600"
                  >
                    Soft Cap Alert (%)
                  </Label>
                  <Input
                    id="softLimitPercentage"
                    type="number"
                    min="50"
                    max="99"
                    className="text-sm mt-1"
                    value={softLimitInput}
                    onChange={(e) => setSoftLimitInput(e.target.value)}
                    disabled={!isAdmin || isPending}
                  />
                </div>
                <div className="flex flex-col justify-end pb-1">
                  <div className="flex items-center gap-2 mt-1">
                    <Switch
                      id="hardLimitBlocked"
                      checked={hardLimitInput}
                      onCheckedChange={setHardLimitInput}
                      disabled={!isAdmin || isPending}
                    />
                    <Label
                      htmlFor="hardLimitBlocked"
                      className="text-xs font-bold text-slate-600 cursor-pointer"
                    >
                      Hard Cap Block
                    </Label>
                  </div>
                </div>
              </div>
              {isAdmin ? (
                <div className="flex gap-2 pt-1">
                  <Button
                    type="submit"
                    size="sm"
                    className="flex-1 text-xs"
                    disabled={isPending}
                  >
                    {isPending ? "Saving..." : "Save Config"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs flex items-center gap-1.5"
                    onClick={handlePricingSync}
                    disabled={isSyncing}
                  >
                    <RotateCw
                      className={`w-3 h-3 ${isSyncing ? "animate-spin" : ""}`}
                    />
                    Sync Rates
                  </Button>
                </div>
              ) : (
                <p className="text-[10px] text-slate-400 text-center font-medium italic mt-2">
                  Only agency administrators can adjust AI limit parameters.
                </p>
              )}
            </form>
          </CardContent>
        </Card>
      </div>

      {/* ATTRIBUTION BREAKDOWN CHARTS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* ATTRIBUTION BY FEATURE */}
        <Card className="py-6 shadow-sm border-slate-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold text-slate-800">
              Feature Cost Attribution
            </CardTitle>
            <CardDescription className="text-[11px]">
              AI cost parsed by invoked function/feature
            </CardDescription>
          </CardHeader>
          <CardContent className="h-[250px] flex items-center justify-center">
            {stats.featureBreakdown.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.featureBreakdown}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) =>
                      `${name} (${((percent || 0) * 100).toFixed(0)}%)`
                    }
                    outerRadius={75}
                    fill="#8884d8"
                    dataKey="spend"
                  >
                    {stats.featureBreakdown.map((entry: any, index: number) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => [
                      `$${parseFloat(value as string).toFixed(3)} USD`,
                      "Spend",
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-xs text-slate-400 italic">
                No feature attribution data recorded.
              </p>
            )}
          </CardContent>
        </Card>

        {/* ATTRIBUTION BY USER */}
        <Card className="py-6 shadow-sm border-slate-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold text-slate-800">
              User Usage Attribution
            </CardTitle>
            <CardDescription className="text-[11px]">
              Cost and call volumes generated per user
            </CardDescription>
          </CardHeader>
          <CardContent className="h-[250px] flex items-center justify-center">
            {stats.userBreakdown.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={stats.userBreakdown}
                  margin={{ top: 10, right: 10, left: -25, bottom: 5 }}
                >
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip
                    formatter={(value) => [
                      `$${parseFloat(value as string).toFixed(3)} USD`,
                      "Spend",
                    ]}
                  />
                  <Bar
                    dataKey="spend"
                    fill="hsl(var(--primary))"
                    radius={[4, 4, 0, 0]}
                  >
                    {stats.userBreakdown.map((entry: any, index: number) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-xs text-slate-400 italic">
                No user attribution data recorded.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* LEDGER GRID LOG */}
      <Card className="py-6 shadow-sm border-slate-200">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm font-bold text-slate-800">
              Query Transaction Ledger
            </CardTitle>
            <CardDescription className="text-[11px]">
              Audit list of recent AI requests and costs
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {stats.ledger.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50 hover:bg-slate-50/50 border-slate-200">
                    <TableHead className="text-xs font-bold text-slate-600 pl-4 py-2.5">
                      Time
                    </TableHead>
                    <TableHead className="text-xs font-bold text-slate-600 py-2.5">
                      User
                    </TableHead>
                    <TableHead className="text-xs font-bold text-slate-600 py-2.5">
                      Feature
                    </TableHead>
                    <TableHead className="text-xs font-bold text-slate-600 py-2.5">
                      Model
                    </TableHead>
                    <TableHead className="text-xs font-bold text-slate-600 py-2.5">
                      Tokens
                    </TableHead>
                    <TableHead className="text-xs font-bold text-slate-600 text-right pr-4 py-2.5">
                      Est. Cost
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.ledger.map((item: any) => (
                    <TableRow
                      key={item.id}
                      className="hover:bg-slate-50/50 border-slate-100"
                    >
                      <TableCell className="text-xs text-slate-500 pl-4 py-2">
                        {new Date(item.timestamp).toLocaleString("en-AU", {
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                          day: "numeric",
                          month: "short",
                        })}
                      </TableCell>
                      <TableCell className="text-xs font-semibold text-slate-700 py-2">
                        {item.userName}
                        <span className="block text-[9px] text-slate-400 font-normal">
                          {item.userEmail}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-slate-700 py-2">
                        <Badge
                          variant="outline"
                          className="text-[10px] font-medium px-2 py-0.5 border-slate-200"
                        >
                          {item.feature}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-slate-600 font-mono py-2">
                        {item.model}
                      </TableCell>
                      <TableCell className="text-xs text-slate-500 py-2">
                        {item.tokens.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-xs font-mono font-bold text-slate-800 text-right pr-4 py-2">
                        ${item.cost.toFixed(5)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="p-8 text-center text-xs text-slate-400 italic border-t border-slate-100">
              No transactions recorded in the current period.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
