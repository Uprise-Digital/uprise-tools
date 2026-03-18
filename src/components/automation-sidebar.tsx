"use client";

import { useState } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
    saveReportScheduleAction,
    deleteReportScheduleAction,
    triggerManualQueueTestAction
} from "@/actions/automation.actions";
import {
    Clock,
    Download,
    FileBarChart2,
    FileDown,
    Loader2,
    Mail,
    MessageSquareQuote,
    Plus,
    Sparkles,
    Trash2,
    User,
    Pencil,
    X,
    Play,
    CheckCircle2
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

interface AutomationRule {
    id: number;
    frequency: string;
    dayOfMonth?: number;
    dayOfWeek?: number;
    recipientEmail: string;
    ccEmails?: string;
    emailSubject: string;
    useAiSummary: boolean;
    customAiInstructions?: string;
    customMessage?: string;
}

interface SidebarProps {
    adAccount: {
        id: number;
        name: string;
        googleAccountId: string;
    };
    rules: AutomationRule[];
    onQuickDownload: () => void;
    isDownloading: boolean;
}

export function AutomationSidebar({
                                      adAccount,
                                      rules,
                                      onQuickDownload,
                                      isDownloading
                                  }: SidebarProps) {
    const [isSaving, setIsSaving] = useState(false);
    const [editingRuleId, setEditingRuleId] = useState<number | null>(null);
    const [testingRuleId, setTestingRuleId] = useState<number | null>(null);

    // Form State
    const [frequency, setFrequency] = useState("MONTHLY");
    const [dayOfMonth, setDayOfMonth] = useState(1);
    const [recipient, setRecipient] = useState("");
    const [cc, setCc] = useState("");
    const [useAi, setUseAi] = useState(true);
    const [customMessage, setCustomMessage] = useState("");
    const [aiInstructions, setAiInstructions] = useState("");

    const resetForm = () => {
        setEditingRuleId(null);
        setFrequency("MONTHLY");
        setDayOfMonth(1);
        setRecipient("");
        setCc("");
        setUseAi(true);
        setCustomMessage("");
        setAiInstructions("");
    };

    const handleEditInitiation = (rule: AutomationRule) => {
        setEditingRuleId(rule.id);
        setFrequency(rule.frequency);
        setDayOfMonth(rule.dayOfMonth || 1);
        setRecipient(rule.recipientEmail);
        setCc(rule.ccEmails || "");
        setUseAi(rule.useAiSummary);
        setAiInstructions(rule.customAiInstructions || "");
        setCustomMessage(rule.customMessage || "");

        // Scroll form into view
        document.getElementById("automation-form")?.scrollIntoView({ behavior: "smooth" });
    };

    const handleTestRule = async (rule: AutomationRule) => {
        setTestingRuleId(rule.id);
        const toastId = toast.loading(`Triggering test for ${rule.recipientEmail}...`);

        console.log("🚀 [Frontend] Starting manual test trigger...");
        console.table({
            scheduleId: rule.id,
            googleAccountId: adAccount.googleAccountId,
            clientName: adAccount.name,
            recipient: rule.recipientEmail
        });

        try {
            const result = await triggerManualQueueTestAction({
                scheduleId: rule.id,
                googleAccountId: adAccount.googleAccountId,
                clientName: adAccount.name,
                isTest: true
            });

            if (result.success) {
                console.log("✅ [Frontend] Server Action reported success. Message is now in the Cloudflare Queue.");

                toast.success("Test job enqueued! Check Cloudflare logs.", {
                    id: toastId,
                    icon: <CheckCircle2 className="h-4 w-4 text-green-500" />
                });
            } else {
                console.error("❌ [Frontend] Server Action returned a failure state:", result.error);
                throw new Error(result.error);
            }
        } catch (error: any) {
            console.error("💥 [Frontend] Critical error during manual trigger:", error);
            toast.error(error.message || "Failed to trigger test", { id: toastId });
        } finally {
            setTestingRuleId(null);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm("Are you sure you want to delete this schedule?")) return;

        const toastId = toast.loading("Deleting schedule...");
        try {
            const result = await deleteReportScheduleAction(id);
            if (result.success) {
                toast.success("Schedule deleted", { id: toastId });
                if (editingRuleId === id) resetForm();
            } else throw new Error();
        } catch (error) {
            toast.error("Failed to delete", { id: toastId });
        }
    };

    const handleSaveSchedule = async () => {
        if (!recipient) return toast.error("Primary recipient is required");

        setIsSaving(true);
        const toastId = toast.loading(editingRuleId ? "Updating schedule..." : "Saving automation rule...");

        try {
            const result = await saveReportScheduleAction({
                id: editingRuleId, // Pass ID if editing
                adAccountId: adAccount.id,
                clientName: adAccount.name,
                frequency,
                dayOfMonth: Number(dayOfMonth),
                recipientEmail: recipient,
                ccEmails: cc,
                useAiSummary: useAi,
                customAiInstructions: aiInstructions,
                customMessage: customMessage,
            });

            if (result.success) {
                toast.success(editingRuleId ? "Schedule updated" : "Schedule created", { id: toastId });
                resetForm();
            } else {
                throw new Error(result.error);
            }
        } catch (error: any) {
            toast.error(error.message || "Failed to save schedule", { id: toastId });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Sheet onOpenChange={(open) => !open && resetForm()}>
            <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9 hover:bg-slate-100 transition-colors">
                    <FileBarChart2 className="h-5 w-5 text-slate-600" />
                </Button>
            </SheetTrigger>

            <SheetContent className="sm:max-w-[600px] p-0 flex flex-col gap-0">
                <div className="p-6 pb-4">
                    <SheetHeader>
                        <div className="flex items-center gap-3 mb-1">
                            <div className="p-2 bg-blue-50 rounded-lg">
                                <FileBarChart2 className="h-5 w-5 text-blue-600" />
                            </div>
                            <div>
                                <SheetTitle className="text-xl">Automation: {adAccount.name}</SheetTitle>
                                <SheetDescription className="font-mono text-xs">
                                    ID: {adAccount.googleAccountId}
                                </SheetDescription>
                            </div>
                        </div>
                    </SheetHeader>
                </div>

                <Separator />

                <div className="flex-1 overflow-y-auto px-6 py-6 space-y-10">
                    {/* SECTION: QUICK EXPORT */}
                    <section>
                        <div className="flex items-center gap-2 mb-4">
                            <Download className="h-4 w-4 text-slate-900" />
                            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900">Quick Actions</h3>
                        </div>
                        <div className="p-5 bg-slate-50 rounded-xl border border-slate-200">
                            <p className="text-sm text-slate-500 mb-4 leading-relaxed">
                                Generate and download the performance report for the current month immediately.
                            </p>
                            <Button
                                className="w-full h-11 shadow-sm"
                                variant="secondary"
                                onClick={onQuickDownload}
                                disabled={isDownloading}
                            >
                                {isDownloading ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                    <FileDown className="mr-2 h-4 w-4" />
                                )}
                                Download {new Date().toLocaleString('default', { month: 'long' })} Report
                            </Button>
                        </div>
                    </section>

                    {/* SECTION: EXISTING RULES */}
                    <section>
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <Clock className="h-4 w-4 text-slate-900" />
                                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900">Active Schedules</h3>
                            </div>
                            <Badge variant="outline" className="font-mono">{rules.length} Rules</Badge>
                        </div>

                        <div className="space-y-3">
                            {rules.length > 0 ? (
                                rules.map((rule) => (
                                    <div key={rule.id} className={`p-4 border rounded-xl relative group transition-all ${editingRuleId === rule.id ? 'border-blue-500 bg-blue-50/30' : 'border-slate-200 hover:border-blue-200 hover:bg-blue-50/20'}`}>
                                        <div className="absolute top-3 right-3 flex gap-1">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                disabled={testingRuleId === rule.id}
                                                className="h-8 w-8 text-amber-600 hover:text-amber-700 hover:bg-amber-50 opacity-0 group-hover:opacity-100 transition-opacity"
                                                onClick={() => handleTestRule(rule)}
                                            >
                                                {testingRuleId === rule.id ? (
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                ) : (
                                                    <Play className="h-4 w-4 fill-current" />
                                                )}
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-slate-400 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity"
                                                onClick={() => handleEditInitiation(rule)}
                                            >
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-slate-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                                                onClick={() => handleDelete(rule.id)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>

                                        <div className="flex items-center gap-2 mb-3">
                                            <Badge className="bg-slate-900 text-white border-0">{rule.frequency}</Badge>
                                            <span className="text-xs font-medium text-slate-500 italic">
                                                {rule.frequency === 'MONTHLY' ? `On the ${rule.dayOfMonth}${rule.dayOfMonth === 1 ? 'st' : rule.dayOfMonth === 2 ? 'nd' : rule.dayOfMonth === 3 ? 'rd' : 'th'}` : `Every Monday`}
                                            </span>
                                        </div>

                                        <div className="space-y-1.5">
                                            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                                                <Mail className="h-3.5 w-3.5" />
                                                <p className="truncate max-w-[200px]">{rule.recipientEmail}</p>
                                            </div>
                                            <div className="flex items-center gap-2 text-xs text-slate-500">
                                                <Sparkles className="h-3.5 w-3.5 text-blue-500" />
                                                <p>AI Summary: {rule.useAiSummary ? 'Enabled' : 'Disabled'}</p>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-8 border-2 border-dashed rounded-xl">
                                    <p className="text-sm text-slate-400">No automation rules configured yet.</p>
                                </div>
                            )}
                        </div>
                    </section>

                    {/* SECTION: NEW/EDIT RULE FORM */}
                    <section id="automation-form" className="pb-10">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-2">
                                {editingRuleId ? <Pencil className="h-4 w-4 text-blue-600"/> : <Plus className="h-4 w-4 text-blue-600"/>}
                                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900">
                                    {editingRuleId ? "Edit Automation Rule" : "New Automation Rule"}
                                </h3>
                            </div>
                            {editingRuleId && (
                                <Button variant="ghost" size="sm" onClick={resetForm} className="h-7 text-xs">
                                    <X className="mr-1 h-3 w-3" /> Cancel Edit
                                </Button>
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-5 mb-5">
                            <div className="space-y-2">
                                <Label className="text-xs font-bold text-slate-700">FREQUENCY</Label>
                                <Select value={frequency} onValueChange={setFrequency}>
                                    <SelectTrigger className="h-10"><SelectValue/></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="WEEKLY">Weekly</SelectItem>
                                        <SelectItem value="MONTHLY">Monthly</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs font-bold text-slate-700">SEND DAY</Label>
                                <Input
                                    className="h-10"
                                    type="number"
                                    value={dayOfMonth}
                                    onChange={(e) => setDayOfMonth(parseInt(e.target.value))}
                                />
                            </div>
                        </div>

                        <div className="space-y-5">
                            <div className="space-y-2">
                                <Label className="text-xs font-bold text-slate-700">PRIMARY RECIPIENT</Label>
                                <div className="relative">
                                    <User className="absolute left-3 top-3 h-4 w-4 text-slate-400"/>
                                    <Input
                                        className="h-10 pl-10"
                                        placeholder="client@uprise.com.au"
                                        value={recipient}
                                        onChange={(e) => setRecipient(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-xs font-bold text-slate-700">CC / BCC</Label>
                                <Input
                                    className="h-10"
                                    placeholder="team@uprise.com.au"
                                    value={cc}
                                    onChange={(e) => setCc(e.target.value)}
                                />
                            </div>

                            {/* AI TOGGLE SECTION */}
                            <div className="p-4 rounded-xl bg-blue-50 border border-blue-100">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <Sparkles className="h-4 w-4 text-blue-600"/>
                                        <Label className="text-sm font-bold text-blue-900">AI Summary Engine</Label>
                                    </div>
                                    <Switch checked={useAi} onCheckedChange={setUseAi}/>
                                </div>
                                <p className="text-xs text-blue-700 leading-relaxed opacity-80 mb-3">
                                    Gemini will interpret performance shifts and draft a personalized intro.
                                </p>

                                {useAi && (
                                    <div className="space-y-2 mt-3 animate-in fade-in slide-in-from-top-2">
                                        <div className="flex items-center gap-2">
                                            <MessageSquareQuote className="h-3 w-3 text-blue-500"/>
                                            <Label className="text-[10px] font-bold text-blue-800 uppercase">Custom AI Instructions (Optional)</Label>
                                        </div>
                                        <textarea
                                            className="w-full min-h-[80px] rounded-lg border border-blue-200 bg-white p-2 text-xs text-blue-900 focus:ring-2 focus:ring-blue-500 outline-none"
                                            placeholder="e.g. Focus on high CPA in Plumbing, use a more casual tone, emphasize last week's growth..."
                                            value={aiInstructions}
                                            onChange={(e) => setAiInstructions(e.target.value)}
                                        />
                                    </div>
                                )}
                            </div>

                            {!useAi && (
                                <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                                    <Label className="text-xs font-bold text-slate-700">STATIC EMAIL MESSAGE</Label>
                                    <textarea
                                        className="w-full min-h-[100px] rounded-xl border border-slate-200 p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                        placeholder="Enter the message you want to send every time..."
                                        value={customMessage}
                                        onChange={(e) => setCustomMessage(e.target.value)}
                                    />
                                </div>
                            )}

                            <Button
                                className={`w-full h-11 transition-colors ${editingRuleId ? 'bg-blue-600 hover:bg-blue-700' : 'bg-slate-900 hover:bg-slate-800'} text-white`}
                                onClick={handleSaveSchedule}
                                disabled={isSaving}
                            >
                                {isSaving ? <Loader2 className="h-4 w-4 animate-spin"/> : (editingRuleId ? "Update Automation Schedule" : "Create Automation Schedule")}
                            </Button>
                        </div>
                    </section>
                </div>
            </SheetContent>
        </Sheet>
    );
}