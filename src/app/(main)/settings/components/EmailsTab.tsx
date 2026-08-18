"use client";

import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Code,
  Copy,
  ExternalLink,
  Eye,
  FileText,
  Filter,
  Info,
  Layers,
  Mail,
  RotateCcw,
  Save,
  Search,
  Sparkles,
  XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  getEmailTemplatesAction,
  resetEmailTemplateAction,
  saveEmailTemplateAction,
} from "@/actions/email-templates.actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface EmailLogData {
  id: number;
  adAccountId: number | null;
  recipient: string;
  subject: string;
  emailType: string;
  status: string;
  error: string | null;
  resendId: string | null;
  sentAt: string;
  accountName: string | null;
}

interface EmailsTabProps {
  emailLogs: EmailLogData[];
}

interface TemplateItem {
  key: string;
  name: string;
  category: "client" | "team" | "auth";
  defaultSubject: string;
  defaultHtml: string;
  subject: string;
  bodyHtml: string;
  bodyText: string;
  isCustomized: boolean;
  variables: Array<{ name: string; description: string }>;
}

const formatEmailType = (type: string) => {
  if (type === "morning_briefing" || type === "daily_briefing") return "Morning Briefing";
  if (type === "scheduled_report" || type === "client_report") return "Scheduled Report";
  if (type === "onboarding_welcome") return "Onboarding Welcome";
  if (type === "pipeline_digest") return "Pipeline Digest";
  if (type === "team_invite") return "Team Invite";
  return type;
};

export function EmailsTab({ emailLogs }: EmailsTabProps) {
  const [activeSubTab, setActiveSubTab] = useState<"logs" | "templates">("templates");

  // Email Logs State
  const [emailSearch, setEmailSearch] = useState("");
  const [emailStatusFilter, setEmailStatusFilter] = useState("all");
  const [emailTypeFilter, setEmailTypeFilter] = useState("all");
  const [selectedEmailLog, setSelectedEmailLog] = useState<EmailLogData | null>(null);
  const [copiedText, setCopiedText] = useState("");

  // Email Templates State
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [selectedTemplateKey, setSelectedTemplateKey] = useState("onboarding_welcome");
  const [subjectInput, setSubjectInput] = useState("");
  const [bodyHtmlInput, setBodyHtmlInput] = useState("");
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [resettingTemplate, setResettingTemplate] = useState(false);
  const [previewMode, setPreviewMode] = useState<"editor" | "preview">("editor");

  const loadTemplates = async () => {
    const res = await getEmailTemplatesAction();
    if (res.success && res.templates) {
      setTemplates(res.templates);
      const current = res.templates.find((t) => t.key === selectedTemplateKey) || res.templates[0];
      if (current) {
        setSelectedTemplateKey(current.key);
        setSubjectInput(current.subject);
        setBodyHtmlInput(current.bodyHtml);
      }
    }
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  const currentTemplate = templates.find((t) => t.key === selectedTemplateKey);

  const handleSelectTemplate = (key: string) => {
    setSelectedTemplateKey(key);
    const target = templates.find((t) => t.key === key);
    if (target) {
      setSubjectInput(target.subject);
      setBodyHtmlInput(target.bodyHtml);
    }
  };

  const handleInsertVariable = (varName: string) => {
    const chip = `{{${varName}}}`;
    setBodyHtmlInput((prev) => `${prev} ${chip}`);
  };

  const handleSaveTemplate = async () => {
    if (!selectedTemplateKey) return;
    setSavingTemplate(true);
    const toastId = toast.loading("Saving customized email template...");
    try {
      const res = await saveEmailTemplateAction({
        templateKey: selectedTemplateKey,
        subject: subjectInput,
        bodyHtml: bodyHtmlInput,
      });
      if (res.success) {
        toast.success("Email template saved successfully!", { id: toastId });
        await loadTemplates();
      } else {
        toast.error(res.error || "Failed to save template.", { id: toastId });
      }
    } catch (err: any) {
      toast.error(err.message || "An unexpected error occurred.", { id: toastId });
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleResetTemplate = async () => {
    if (!selectedTemplateKey) return;
    setResettingTemplate(true);
    const toastId = toast.loading("Resetting template to system default...");
    try {
      const res = await resetEmailTemplateAction(selectedTemplateKey);
      if (res.success) {
        toast.success("Template reset to system default!", { id: toastId });
        await loadTemplates();
      } else {
        toast.error(res.error || "Failed to reset template.", { id: toastId });
      }
    } catch (err: any) {
      toast.error(err.message || "An error occurred.", { id: toastId });
    } finally {
      setResettingTemplate(false);
    }
  };

  const renderPreviewHtml = () => {
    if (!currentTemplate) return "";
    let html = bodyHtmlInput;
    const sampleVars: Record<string, string> = {
      primary_contact_name: "Alex Smith",
      client_name: "Acme Growth Inc",
      drive_link: "https://drive.google.com/drive/folders/demo",
      notion_link: "https://notion.so/acme-demo",
      signal_link: "https://signal.group/#demo",
      agency_name: "Your Agency Name",
      date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      briefing_content: "• <strong>Google Ads:</strong> ROAS is up +18% this week.<br/>• <strong>Meta Ads:</strong> CPL reduced to $14.20.",
      report_url: "#",
      stalled_count: "3",
      pipeline_content: "• Acme Corp ($12,000) - Stalled 8 days<br/>• Beta LLC ($5,500) - Stalled 12 days",
      pipeline_url: "#",
      role: "Admin",
      invite_url: "#",
    };

    for (const [k, v] of Object.entries(sampleVars)) {
      const regex = new RegExp(`{{\\s*${k}\\s*}}`, "g");
      html = html.replace(regex, v);
    }

    return html;
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopiedText(""), 2000);
  };

  const filteredEmailLogs = emailLogs.filter((email) => {
    const accountName = email.accountName || "";
    const matchesSearch =
      email.recipient.toLowerCase().includes(emailSearch.toLowerCase()) ||
      email.subject.toLowerCase().includes(emailSearch.toLowerCase()) ||
      email.emailType.toLowerCase().includes(emailSearch.toLowerCase()) ||
      accountName.toLowerCase().includes(emailSearch.toLowerCase());

    if (!matchesSearch) return false;

    if (emailStatusFilter !== "all" && email.status !== emailStatusFilter) {
      return false;
    }

    if (emailTypeFilter !== "all" && email.emailType !== emailTypeFilter) {
      return false;
    }

    return true;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* SUB-NAVIGATION TABS */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
        <button
          type="button"
          onClick={() => setActiveSubTab("templates")}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
            activeSubTab === "templates"
              ? "bg-indigo-600 text-white shadow-xs"
              : "bg-slate-100 text-slate-650 hover:bg-slate-200"
          }`}
        >
          <FileText className="w-4 h-4" />
          Email Template Manager
        </button>
        <button
          type="button"
          onClick={() => setActiveSubTab("logs")}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
            activeSubTab === "logs"
              ? "bg-indigo-600 text-white shadow-xs"
              : "bg-slate-100 text-slate-650 hover:bg-slate-200"
          }`}
        >
          <Mail className="w-4 h-4" />
          Email Delivery Status Logs
        </button>
      </div>

      {activeSubTab === "templates" ? (
        /* TEMPLATE MANAGER VIEW */
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
          {/* LEFT SIDEBAR: TEMPLATE SELECTOR */}
          <Card className="py-0 border-slate-200 shadow-sm overflow-hidden lg:col-span-1">
            <CardHeader className="bg-slate-50 border-b border-slate-100 p-4">
              <CardTitle className="text-xs font-bold text-slate-800 flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-500" />
                System Email Templates
              </CardTitle>
              <CardDescription className="text-[11px]">
                Select a template to customize for your organization.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-2 space-y-1">
              {templates.map((tmpl) => {
                const isSelected = tmpl.key === selectedTemplateKey;
                return (
                  <button
                    key={tmpl.key}
                    type="button"
                    onClick={() => handleSelectTemplate(tmpl.key)}
                    className={`w-full text-left p-3 rounded-xl border text-xs font-sans transition-all cursor-pointer ${
                      isSelected
                        ? "bg-indigo-50/80 border-indigo-200 text-indigo-950 font-bold shadow-2xs"
                        : "bg-white border-transparent hover:bg-slate-50 text-slate-700 font-medium"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="truncate">{tmpl.name}</span>
                      {tmpl.isCustomized && (
                        <Badge
                          variant="outline"
                          className="text-[9px] px-1.5 py-0.2 border-emerald-300 bg-emerald-50 text-emerald-700 font-bold shrink-0"
                        >
                          Customized
                        </Badge>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400 block mt-0.5 capitalize">
                      Category: {tmpl.category}
                    </span>
                  </button>
                );
              })}
            </CardContent>
          </Card>

          {/* RIGHT MAIN EDITOR & PREVIEW */}
          <Card className="py-0 border-slate-200 shadow-sm overflow-hidden lg:col-span-3">
            <CardHeader className="bg-slate-50 border-b border-slate-100 p-4 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-800">
                  <Sparkles className="w-4 h-4 text-indigo-500" />
                  {currentTemplate?.name || "Email Template Editor"}
                </CardTitle>
                <CardDescription className="text-xs">
                  Customize the subject line and HTML email body. Dynamic placeholder variables are replaced automatically at dispatch time.
                </CardDescription>
              </div>

              {/* EDITOR / PREVIEW TOGGLE */}
              <div className="flex items-center gap-1 bg-slate-200/70 p-1 rounded-lg">
                <button
                  type="button"
                  onClick={() => setPreviewMode("editor")}
                  className={`px-3 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                    previewMode === "editor"
                      ? "bg-white text-slate-800 shadow-2xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <Code className="w-3.5 h-3.5 inline mr-1" />
                  HTML Editor
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewMode("preview")}
                  className={`px-3 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                    previewMode === "preview"
                      ? "bg-white text-slate-800 shadow-2xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <Eye className="w-3.5 h-3.5 inline mr-1" />
                  Live Preview
                </button>
              </div>
            </CardHeader>

            <CardContent className="p-6 space-y-4">
              {/* VARIABLE CHIP LEGEND */}
              <div className="p-3.5 bg-indigo-50/50 border border-indigo-100 rounded-xl space-y-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-900 block">
                  Available Template Variables (Click to Insert)
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {currentTemplate?.variables.map((v) => (
                    <button
                      key={v.name}
                      type="button"
                      onClick={() => handleInsertVariable(v.name)}
                      className="px-2 py-1 text-[11px] font-mono bg-white hover:bg-indigo-100 border border-indigo-200 text-indigo-700 rounded-md font-semibold transition-colors cursor-pointer"
                      title={v.description}
                    >
                      {`{{${v.name}}}`}
                    </button>
                  ))}
                </div>
              </div>

              {/* SUBJECT LINE INPUT */}
              <div className="space-y-1.5">
                <Label htmlFor="template-subject" className="text-xs font-bold text-slate-700">
                  Email Subject Line
                </Label>
                <Input
                  id="template-subject"
                  value={subjectInput}
                  onChange={(e) => setSubjectInput(e.target.value)}
                  className="text-xs bg-white font-sans"
                  placeholder="Enter subject line..."
                />
              </div>

              {/* BODY EDITOR / PREVIEW */}
              {previewMode === "editor" ? (
                <div className="space-y-1.5">
                  <Label htmlFor="template-body" className="text-xs font-bold text-slate-700">
                    HTML Template Body
                  </Label>
                  <textarea
                    id="template-body"
                    rows={12}
                    value={bodyHtmlInput}
                    onChange={(e) => setBodyHtmlInput(e.target.value)}
                    className="w-full text-xs font-mono p-3 bg-slate-900 text-slate-100 rounded-xl focus:ring-1 focus:ring-indigo-500 outline-none leading-relaxed"
                  />
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700 block">
                    Rendered Live Email Preview
                  </Label>
                  <div className="p-6 bg-white border border-slate-200 rounded-xl shadow-inner min-h-[300px] overflow-y-auto">
                    <div
                      className="prose prose-xs max-w-none font-sans text-slate-800"
                      dangerouslySetInnerHTML={{ __html: renderPreviewHtml() }}
                    />
                  </div>
                </div>
              )}

              {/* ACTIONS */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                {currentTemplate?.isCustomized ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleResetTemplate}
                    disabled={resettingTemplate}
                    className="border-slate-200 text-slate-700 hover:bg-slate-100 font-bold text-xs h-9 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
                    {resettingTemplate ? "Resetting..." : "Reset to Default"}
                  </Button>
                ) : (
                  <span className="text-[11px] text-slate-400 font-medium">
                    Using default system template.
                  </span>
                )}

                <Button
                  type="button"
                  onClick={handleSaveTemplate}
                  disabled={savingTemplate}
                  className="bg-indigo-600 hover:bg-indigo-500 font-bold text-xs h-9 px-5 cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5 mr-1.5" />
                  {savingTemplate ? "Saving..." : "Save Template"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        /* EMAIL DELIVERY LOGS VIEW */
        <Card className="border-slate-200 shadow-sm overflow-hidden">
          <CardHeader className="bg-slate-50 border-b border-slate-100 p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-800">
                <Mail className="w-4 h-4 text-indigo-500" />
                Email Delivery Statuses
              </CardTitle>
              <CardDescription className="text-xs">
                Log of outgoing Resend email dispatches for briefings, automated schedules, and on-demand campaigns.
              </CardDescription>
            </div>
            {/* SEARCH AND FILTERS */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search recipient, subject, client..."
                  value={emailSearch}
                  onChange={(e) => setEmailSearch(e.target.value)}
                  className="pl-8 text-xs h-9 bg-white"
                />
              </div>
              <div className="flex items-center gap-1.5 bg-white border rounded-lg px-2 py-1 text-xs text-slate-600">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                <select
                  value={emailTypeFilter}
                  onChange={(e) => setEmailTypeFilter(e.target.value)}
                  className="bg-transparent border-none focus:outline-none text-xs font-medium cursor-pointer"
                >
                  <option value="all">All Types</option>
                  <option value="morning_briefing">Morning Briefings</option>
                  <option value="scheduled_report">Scheduled Reports</option>
                  <option value="onboarding_welcome">Onboarding Welcome</option>
                </select>
              </div>
              <div className="flex items-center gap-1.5 bg-white border rounded-lg px-2 py-1 text-xs text-slate-600">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                <select
                  value={emailStatusFilter}
                  onChange={(e) => setEmailStatusFilter(e.target.value)}
                  className="bg-transparent border-none focus:outline-none text-xs font-medium cursor-pointer"
                >
                  <option value="all">All Statuses</option>
                  <option value="success">Success</option>
                  <option value="failed">Failed</option>
                </select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-slate-50/50">
                <TableRow>
                  <TableHead className="w-[160px] pl-6 text-xs font-bold text-slate-600">
                    Sent At
                  </TableHead>
                  <TableHead className="text-xs font-bold text-slate-600">
                    Type
                  </TableHead>
                  <TableHead className="text-xs font-bold text-slate-600">
                    Recipient
                  </TableHead>
                  <TableHead className="text-xs font-bold text-slate-600">
                    Subject / Client
                  </TableHead>
                  <TableHead className="text-xs font-bold text-slate-600">
                    Status
                  </TableHead>
                  <TableHead className="text-right pr-6 text-xs font-bold text-slate-600">
                    Inspection
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEmailLogs.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="h-24 text-center text-xs text-slate-500 font-sans"
                    >
                      No email delivery logs match criteria.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredEmailLogs.map((email) => {
                    const isSuccess = email.status === "success" || email.status === "sent";

                    return (
                      <TableRow
                        key={email.id}
                        className="hover:bg-slate-50/50 transition-colors"
                      >
                        <TableCell className="font-mono text-[10px] text-slate-500 pl-6">
                          {new Date(email.sentAt).toLocaleString("en-AU", {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                          })}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className="text-[10px] font-medium text-slate-700 bg-slate-50"
                          >
                            {formatEmailType(email.emailType)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs font-medium text-slate-800 max-w-[200px] truncate">
                          {email.recipient}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="text-xs font-semibold text-slate-700 truncate max-w-[240px]">
                              {email.subject}
                            </span>
                            {email.accountName && (
                              <span className="text-[10px] text-slate-400">
                                {email.accountName}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {isSuccess ? (
                            <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                              Delivered
                            </Badge>
                          ) : (
                            <Badge className="bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold">
                              <XCircle className="w-3 h-3 mr-1" />
                              Failed
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right pr-6">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedEmailLog(email)}
                            className="h-7 text-xs font-semibold text-indigo-650 hover:text-indigo-800 hover:bg-indigo-50"
                          >
                            Inspect
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* INSPECT LOG DIALOG */}
      <Dialog
        open={Boolean(selectedEmailLog)}
        onOpenChange={(open) => !open && setSelectedEmailLog(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Mail className="w-4 h-4 text-indigo-500" />
              Email Dispatch Inspection
            </DialogTitle>
            <DialogDescription className="text-xs">
              Detailed technical diagnostic logs for outgoing dispatch.
            </DialogDescription>
          </DialogHeader>
          {selectedEmailLog && (
            <div className="space-y-3 text-xs pt-2 font-sans">
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">
                    Status
                  </span>
                  <span
                    className={`font-extrabold capitalize ${
                      selectedEmailLog.status === "success" || selectedEmailLog.status === "sent"
                        ? "text-emerald-600"
                        : "text-rose-600"
                    }`}
                  >
                    {selectedEmailLog.status}
                  </span>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">
                    Email Type
                  </span>
                  <span className="font-semibold text-slate-700 capitalize">
                    {formatEmailType(selectedEmailLog.emailType)}
                  </span>
                </div>
              </div>

              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100 space-y-1">
                <span className="text-[10px] font-bold text-slate-400 block uppercase">
                  Recipient
                </span>
                <span className="font-mono text-slate-800 block truncate select-all">
                  {selectedEmailLog.recipient}
                </span>
              </div>

              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100 space-y-1">
                <span className="text-[10px] font-bold text-slate-400 block uppercase">
                  Subject Line
                </span>
                <span className="font-medium text-slate-800 block leading-relaxed">
                  {selectedEmailLog.subject}
                </span>
              </div>

              {selectedEmailLog.resendId && (
                <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100 space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">
                    Resend Message ID
                  </span>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[11px] text-slate-700">
                      {selectedEmailLog.resendId}
                    </span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(selectedEmailLog.resendId!)}
                      className="text-slate-400 hover:text-slate-700 cursor-pointer"
                    >
                      {copiedText === selectedEmailLog.resendId ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              )}

              {selectedEmailLog.error && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl space-y-1">
                  <span className="text-[10px] font-bold text-rose-600 uppercase block">
                    Diagnostic Failure Error
                  </span>
                  <p className="font-mono text-[11px] leading-relaxed break-words">
                    {selectedEmailLog.error}
                  </p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
