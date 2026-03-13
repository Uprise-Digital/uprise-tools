"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {createAlertRule} from "@/actions/rules.actions";

type Props = {
    accounts: { id: number; name: string }[];
    team: { id: string; name: string; email: string }[];
};

export function RuleForm({ accounts, team }: Props) {
    const [loading, setLoading] = useState(false);

    // Form State
    const [adAccountId, setAdAccountId] = useState("");
    const [metric, setMetric] = useState("");
    const [timeWindow, setTimeWindow] = useState("");
    const [operator, setOperator] = useState("");
    const [threshold, setThreshold] = useState("");
    const [frequency, setFrequency] = useState("");
    const [notifyUserIds, setNotifyUserIds] = useState<string[]>([]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        await createAlertRule({
            adAccountId: Number(adAccountId),
            metric, timeWindow, operator, threshold, frequency, notifyUserIds
        });
        // The server action handles the redirect on success
    };

    // UX helper: Determine symbol based on metric
    const symbol = metric === "cost_per_conversion" || metric === "cost" ? "$" : metric.includes("ctr") ? "%" : "";

    return (
        <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">

            {/* Target Account */}
            <Card>
                <CardHeader>
                    <CardTitle>1. Target Account</CardTitle>
                    <CardDescription>Select the Google Ads client account to monitor.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Select onValueChange={setAdAccountId} required>
                        <SelectTrigger><SelectValue placeholder="Select an account..." /></SelectTrigger>
                        <SelectContent>
                            {accounts.map(acc => (
                                <SelectItem key={acc.id} value={acc.id.toString()}>{acc.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </CardContent>
            </Card>

            {/* Condition Logic */}
            <Card>
                <CardHeader>
                    <CardTitle>2. Alert Condition</CardTitle>
                    <CardDescription>Define the exact threshold that will trigger the alarm.</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                        <Label>Metric</Label>
                        <Select onValueChange={setMetric} required>
                            <SelectTrigger><SelectValue placeholder="Select metric" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="cost">Total Spend</SelectItem>
                                <SelectItem value="conversions">Total Conversions</SelectItem>
                                <SelectItem value="cost_per_conversion">CPA (Cost per Conv.)</SelectItem>
                                <SelectItem value="ctr">Click-Through Rate</SelectItem>
                                <SelectItem value="roas">ROAS</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label>Operator</Label>
                        <Select onValueChange={setOperator} required>
                            <SelectTrigger><SelectValue placeholder="Condition" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="GREATER_THAN">Is Greater Than (&gt;)</SelectItem>
                                <SelectItem value="LESS_THAN">Is Less Than (&lt;)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label>Threshold</Label>
                        <div className="relative">
                            {symbol && <span className="absolute left-3 top-2.5 text-muted-foreground">{symbol}</span>}
                            <Input
                                type="number"
                                step="0.01"
                                required
                                value={threshold}
                                onChange={(e) => setThreshold(e.target.value)}
                                className={symbol ? "pl-7" : ""}
                                placeholder="e.g. 50.00"
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Evaluation Schedule */}
            <Card>
                <CardHeader>
                    <CardTitle>3. Evaluation Schedule</CardTitle>
                    <CardDescription>When should we run this check, and over what historical data?</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>Time Window (Lookback)</Label>
                        <Select onValueChange={setTimeWindow} required>
                            <SelectTrigger><SelectValue placeholder="Select window" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="YESTERDAY">Yesterday</SelectItem>
                                <SelectItem value="LAST_7_DAYS">Last 7 Days</SelectItem>
                                <SelectItem value="LAST_30_DAYS">Last 30 Days</SelectItem>
                                <SelectItem value="THIS_MONTH">Month to Date</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label>Worker Frequency</Label>
                        <Select onValueChange={setFrequency} required>
                            <SelectTrigger><SelectValue placeholder="Select frequency" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="DAILY">Daily (Morning Check)</SelectItem>
                                <SelectItem value="WEEKLY">Weekly (Monday Morning)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            {/* Notification Routing */}
            <Card>
                <CardHeader>
                    <CardTitle>4. Notification Routing</CardTitle>
                    <CardDescription>Who should receive the Resend email when this rule trips?</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {team.map(member => (
                        <div key={member.id} className="flex items-center space-x-3">
                            <Checkbox
                                id={`user-${member.id}`}
                                checked={notifyUserIds.includes(member.id)}
                                onCheckedChange={(checked) => {
                                    if (checked) setNotifyUserIds([...notifyUserIds, member.id]);
                                    else setNotifyUserIds(notifyUserIds.filter(id => id !== member.id));
                                }}
                            />
                            <Label htmlFor={`user-${member.id}`} className="font-normal cursor-pointer">
                                {member.name} <span className="text-muted-foreground">({member.email})</span>
                            </Label>
                        </div>
                    ))}
                </CardContent>
            </Card>

            <div className="flex justify-end gap-4">
                <Button type="button" variant="outline" onClick={() => window.history.back()}>Cancel</Button>
                <Button type="submit" disabled={loading}>{loading ? "Saving..." : "Create Alert Rule"}</Button>
            </div>
        </form>
    );
}