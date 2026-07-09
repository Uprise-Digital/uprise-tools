"use client";

import {
  Activity,
  AlertTriangle,
  Building,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Database,
  ExternalLink,
  Filter,
  History,
  Info,
  Loader2,
  Mail,
  Plus,
  Save,
  Search,
  RefreshCw,
  Settings as SettingsIcon,
  SlidersHorizontal,
  User as UserIcon,
  XCircle,
  Trash,
} from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";
import { saveOrgTriageDefaultsAction } from "@/actions/triage-settings.actions";
import { syncAgencyPortfolioAction } from "@/actions/agency.actions";
import {
  disconnectGoogleAdsAction,
  updateLinkedAccountsAction,
  updateOrganizationNameAction,
  refreshAdAccountsMetadataAction,
} from "@/actions/settings.actions";
import { fetchSubAccountsForPreviewAction } from "@/actions/onboarding.actions";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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

interface TriageDefaultsData {
  id: number | null;
  criticalSpendThreshold: number;
  criticalConversionsThreshold: number;
  ctrHighThreshold: number;
  ctrHighSpendThreshold: number;
  cpcHighThreshold: number;
  anomalySpendChangeThreshold: number;
  anomalyConversionsChangeThreshold: number;
}

interface AccountSyncData {
  id: number;
  googleAccountId: string;
  name: string;
  isActive: boolean;
  lastSyncedAt: string | null;
  syncStatus: string | null;
  syncError: string | null;
  includeInBriefing: boolean;
}

interface AuditLogData {
  id: number;
  actorId: string | null;
  action: string;
  targetTable: string;
  targetId: string;
  metadata: any;
  createdAt: string;
  actor: {
    id: string;
    name: string;
    email: string;
    image: string | null;
  } | null;
}

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

interface SubAccount {
  id: string;
  name: string;
  currencyCode: string;
  timeZone: string;
  status: string;
  optimizationScore: number | null;
}

interface SettingsClientProps {
  initialDefaults: TriageDefaultsData;
  accounts: AccountSyncData[];
  auditLogs: AuditLogData[];
  emailLogs: EmailLogData[];
  connection: {
    id: number;
    connectedEmail: string;
    managerCustomerId: string | null;
    status: string;
    errorMessage: string | null;
    createdAt: string;
  } | null;
  orgName: string;
  userEmail: string;
  userRole: string;
  initialAutoJoinDomainEnabled: boolean;
}

function formatCustomerId(id: any) {
  if (!id) return "";
  const str = String(id);
  const clean = str.replace(/[^0-9]/g, "");
  if (clean.length === 10) {
    return `${clean.slice(0, 3)}-${clean.slice(3, 6)}-${clean.slice(6)}`;
  }
  return str;
}

function getPrettySyncError(rawError: string) {
  const err = rawError.toLowerCase();
  if (err.includes("reading '0'") || err.includes("reading '0'")) {
    return "No campaign data or metrics found in the sync period. The Google Ads account might be inactive, paused, or deactivated.";
  }
  if (err.includes("caller does not have permission") || err.includes("permission_denied") || err.includes("customer_not_enabled")) {
    return "Access denied: The connected manager account doesn't have permission to fetch data for this client account.";
  }
  if (err.includes("invalid argument") || err.includes("request contains an invalid argument")) {
    return "Invalid request argument sent to Google Ads API. Please check account configurations.";
  }
  return "Data synchronization failed. This is usually due to temporary API rate limits or missing metrics in the search range.";
}

// React Error Boundary to catch hydration and client-side crashes
class SettingsErrorBoundary extends React.Component<
  { children?: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children?: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("SettingsClient Render Error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 bg-rose-50 border border-rose-200 rounded-xl m-6 text-rose-900 font-sans">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <XCircle className="w-5 h-5 text-rose-600 shrink-0" />
            Client-Side Settings Page Crash
          </h2>
          <p className="text-sm mt-2 font-semibold text-rose-800">
            {this.state.error?.message}
          </p>
          {this.state.error?.stack && (
            <pre className="mt-4 p-4 bg-slate-900 text-slate-200 rounded-lg text-xs font-mono overflow-auto max-h-96 whitespace-pre-wrap">
              {this.state.error.stack}
            </pre>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}

export default function SettingsClient({
  initialDefaults,
  accounts,
  auditLogs,
  emailLogs,
  connection,
  orgName,
  userEmail,
  userRole,
  initialAutoJoinDomainEnabled,
}: SettingsClientProps) {
  const [activeTab, setActiveTab] = useState<"general" | "triage" | "audit" | "emails">(
    "general",
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [allowDomainAutoJoin, setAllowDomainAutoJoin] = useState(initialAutoJoinDomainEnabled);

  const handleManualSync = async () => {
    setIsSyncing(true);
    const toastId = toast.loading("Triggering portfolio synchronization...");
    try {
      const today = new Date();
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const startDateStr = thirtyDaysAgo.toISOString().split("T")[0];
      const endDateStr = today.toISOString().split("T")[0];

      const res = await syncAgencyPortfolioAction(startDateStr, endDateStr);
      if (res.success) {
        toast.success("Portfolio sync triggered successfully! Running in the background.", { id: toastId });
        window.location.reload();
      } else {
        toast.error(res.error || "Failed to trigger portfolio sync", { id: toastId });
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to trigger sync", { id: toastId });
    } finally {
      setIsSyncing(false);
    }
  };

  // General Settings Form State
  const [formState, setFormState] = useState({
    criticalSpendThreshold: initialDefaults.criticalSpendThreshold.toString(),
    criticalConversionsThreshold:
      initialDefaults.criticalConversionsThreshold.toString(),
    ctrHighThreshold: initialDefaults.ctrHighThreshold.toString(),
    ctrHighSpendThreshold: initialDefaults.ctrHighSpendThreshold.toString(),
    cpcHighThreshold: initialDefaults.cpcHighThreshold.toString(),
    anomalySpendChangeThreshold:
      initialDefaults.anomalySpendChangeThreshold.toString(),
    anomalyConversionsChangeThreshold:
      initialDefaults.anomalyConversionsChangeThreshold.toString(),
  });

  // Search & Filter States
  const [auditSearch, setAuditSearch] = useState("");
  const [auditFilter, setAuditFilter] = useState("all");
  const [emailSearch, setEmailSearch] = useState("");
  const [emailStatusFilter, setEmailStatusFilter] = useState("all");
  const [emailTypeFilter, setEmailTypeFilter] = useState("all");

  // Details Inspector Modal State
  const [selectedAuditLog, setSelectedAuditLog] = useState<AuditLogData | null>(
    null,
  );
  const [selectedEmailLog, setSelectedEmailLog] = useState<EmailLogData | null>(
    null,
  );
  const [copiedText, setCopiedText] = useState("");

  // New General Tab States & Handlers
  const [orgNameInput, setOrgNameInput] = useState(orgName);
  const [savingOrgName, setSavingOrgName] = useState(false);

  const [disconnectDialogOpen, setDisconnectDialogOpen] = useState(false);
  const [deleteSyncedData, setDeleteSyncedData] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const [accountsDialogOpen, setAccountsDialogOpen] = useState(false);
  const [fetchingAccounts, setFetchingAccounts] = useState(false);
  const [previewAccounts, setPreviewAccounts] = useState<SubAccount[]>([]);
  const [selectedAccountIds, setSelectedAccountIds] = useState<Set<string>>(new Set());
  const [modalSearch, setModalSearch] = useState("");
  const [modalStatusFilter, setModalStatusFilter] = useState("ALL");
  const [savingLinkedAccounts, setSavingLinkedAccounts] = useState(false);
  const [refreshingAccounts, setRefreshingAccounts] = useState(false);

  const handleSaveOrgName = async () => {
    if (!orgNameInput.trim()) {
      toast.error("Agency name cannot be empty.");
      return;
    }
    setSavingOrgName(true);
    try {
      const res = await updateOrganizationNameAction({
        name: orgNameInput,
        allowDomainAutoJoin,
      });
      if (res.success) {
        toast.success("Agency settings updated successfully.");
      } else {
        toast.error(res.error || "Failed to update agency settings.");
      }
    } catch (err: any) {
      toast.error(err.message || "An unexpected error occurred.");
    } finally {
      setSavingOrgName(false);
    }
  };

  const handleDisconnectConnection = async () => {
    if (!connection) return;
    setDisconnecting(true);
    try {
      const res = await disconnectGoogleAdsAction({
        connectionId: connection.id,
        deleteSyncedData,
      });
      if (res.success) {
        toast.success("Google Ads disconnected successfully.");
        setDisconnectDialogOpen(false);
        window.location.reload();
      } else {
        toast.error(res.error || "Failed to disconnect Google Ads.");
      }
    } catch (err: any) {
      toast.error(err.message || "An unexpected error occurred.");
    } finally {
      setDisconnecting(false);
    }
  };

  const handleRefreshAdAccountsMetadata = async () => {
    setRefreshingAccounts(true);
    const toastId = toast.loading("Refreshing Google Ads accounts status...");
    try {
      const res = await refreshAdAccountsMetadataAction();
      if (res.success) {
        toast.success("Google Ads accounts metadata refreshed successfully!", { id: toastId });
        window.location.reload();
      } else {
        toast.error(res.error || "Failed to refresh metadata.", { id: toastId });
      }
    } catch (err: any) {
      toast.error(err.message || "An unexpected error occurred.", { id: toastId });
    } finally {
      setRefreshingAccounts(false);
    }
  };

  const handleOpenAccountsDialog = async () => {
    if (!connection) return;
    setAccountsDialogOpen(true);
    setFetchingAccounts(true);
    try {
      const res = await fetchSubAccountsForPreviewAction({
        connectionId: connection.id,
        managerCustomerId: connection.managerCustomerId || "",
      });
      if (res.success && res.accounts) {
        setPreviewAccounts(res.accounts);
        // Pre-check the currently active ad accounts in our database
        const activeIds = accounts.filter((a) => a.isActive).map((a) => a.googleAccountId);
        setSelectedAccountIds(new Set(activeIds));
      } else {
        toast.error(res.error || "Failed to load sub-accounts.");
        setAccountsDialogOpen(false);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to fetch sub-accounts.");
      setAccountsDialogOpen(false);
    } finally {
      setFetchingAccounts(false);
    }
  };

  const handleSaveLinkedAccounts = async () => {
    if (!connection) return;
    setSavingLinkedAccounts(true);
    try {
      const res = await updateLinkedAccountsAction({
        connectionId: connection.id,
        managerCustomerId: connection.managerCustomerId || "",
        selectedCustomerIds: Array.from(selectedAccountIds),
      });
      if (res.success) {
        toast.success("Accounts selection updated. Background database sync triggered.");
        setAccountsDialogOpen(false);
        window.location.reload();
      } else {
        toast.error(res.error || "Failed to save selected accounts.");
      }
    } catch (err: any) {
      toast.error(err.message || "An error occurred.");
    } finally {
      setSavingLinkedAccounts(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormState((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleReset = () => {
    setFormState({
      criticalSpendThreshold: initialDefaults.criticalSpendThreshold.toString(),
      criticalConversionsThreshold:
        initialDefaults.criticalConversionsThreshold.toString(),
      ctrHighThreshold: initialDefaults.ctrHighThreshold.toString(),
      ctrHighSpendThreshold: initialDefaults.ctrHighSpendThreshold.toString(),
      cpcHighThreshold: initialDefaults.cpcHighThreshold.toString(),
      anomalySpendChangeThreshold:
        initialDefaults.anomalySpendChangeThreshold.toString(),
      anomalyConversionsChangeThreshold:
        initialDefaults.anomalyConversionsChangeThreshold.toString(),
    });
    toast.success("Settings reset to last saved defaults.");
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    const toastId = toast.loading(
      "Saving organizational default thresholds...",
    );

    try {
      const payload = {
        id: initialDefaults.id,
        criticalSpendThreshold:
          parseFloat(formState.criticalSpendThreshold) || 0,
        criticalConversionsThreshold:
          parseInt(formState.criticalConversionsThreshold, 10) || 0,
        ctrHighThreshold: parseFloat(formState.ctrHighThreshold) || 0,
        ctrHighSpendThreshold: parseFloat(formState.ctrHighSpendThreshold) || 0,
        cpcHighThreshold: parseFloat(formState.cpcHighThreshold) || 0,
        anomalySpendChangeThreshold:
          parseFloat(formState.anomalySpendChangeThreshold) || 0,
        anomalyConversionsChangeThreshold:
          parseFloat(formState.anomalyConversionsChangeThreshold) || 0,
      };

      const res = await saveOrgTriageDefaultsAction(payload);
      if (res.success) {
        toast.success("Organizational defaults saved successfully!", {
          id: toastId,
        });
      } else {
        throw new Error(res.error || "Failed to save settings");
      }
    } catch (error) {
      const errMsg =
        error instanceof Error
          ? error.message
          : "An error occurred while saving.";
      toast.error(errMsg, { id: toastId });
    } finally {
      setIsSaving(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopiedText(""), 2000);
  };

  const hasChanges =
    formState.criticalSpendThreshold !==
      initialDefaults.criticalSpendThreshold.toString() ||
    formState.criticalConversionsThreshold !==
      initialDefaults.criticalConversionsThreshold.toString() ||
    formState.ctrHighThreshold !==
      initialDefaults.ctrHighThreshold.toString() ||
    formState.ctrHighSpendThreshold !==
      initialDefaults.ctrHighSpendThreshold.toString() ||
    formState.cpcHighThreshold !==
      initialDefaults.cpcHighThreshold.toString() ||
    formState.anomalySpendChangeThreshold !==
      initialDefaults.anomalySpendChangeThreshold.toString() ||
    formState.anomalyConversionsChangeThreshold !==
      initialDefaults.anomalyConversionsChangeThreshold.toString();

  // Audit Logs Filtering
  const filteredAuditLogs = auditLogs.filter((log) => {
    const actorName = log.actor?.name || "System";
    const actorEmail = log.actor?.email || "";
    const matchesSearch =
      actorName.toLowerCase().includes(auditSearch.toLowerCase()) ||
      actorEmail.toLowerCase().includes(auditSearch.toLowerCase()) ||
      log.action.toLowerCase().includes(auditSearch.toLowerCase()) ||
      log.targetTable.toLowerCase().includes(auditSearch.toLowerCase());

    if (!matchesSearch) return false;

    if (auditFilter === "triage") {
      return log.action.includes("TRIAGE") || log.action.includes("TARGETS");
    }
    if (auditFilter === "user") {
      return log.action.includes("USER");
    }
    if (auditFilter === "rules") {
      return log.action.includes("RULE");
    }
    if (auditFilter === "security") {
      return (
        log.action.includes("MCP_TOOLS") || log.action.includes("ROLL_MCP")
      );
    }
    if (auditFilter === "system") {
      return log.action.includes("DAILY_BRIEFING");
    }

    return true;
  });

  // Email Logs Filtering
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

  const getActionBadgeVariant = (action: string) => {
    if (action.includes("FAILED") || action.includes("DELETE")) {
      return "destructive";
    }
    if (
      action.includes("CREATE") ||
      action.includes("ROLL") ||
      action.includes("SENT")
    ) {
      return "default";
    }
    if (action.includes("SAVE") || action.includes("UPDATE")) {
      return "secondary";
    }
    return "outline";
  };

  const formatEmailType = (type: string) => {
    if (type === "morning_briefing") return "Morning Briefing";
    if (type === "scheduled_report") return "Scheduled Report";
    if (type === "on_demand_report") return "On-Demand Report";
    return type;
  };

  return (
    <SettingsErrorBoundary>
      <TooltipProvider>
        <div className="w-full h-full p-8 font-sans bg-slate-50/50">
      {/* HEADER */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
            <SettingsIcon className="w-7 h-7 text-indigo-600 animate-spin-slow" />
            Agency Settings
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Configure default thresholds, check live sync health, and review
            audit/delivery logs.
          </p>
        </div>
      </div>

      {/* NAVIGATION TABS */}
      <div className="flex border-b border-slate-200 mb-6 gap-6">
        <button
          className={`pb-3 text-sm font-semibold transition-all border-b-2 px-1 flex items-center gap-2 ${
            activeTab === "general"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
          onClick={() => setActiveTab("general")}
        >
          <Building className="w-4 h-4" />
          General Settings
        </button>
        <button
          className={`pb-3 text-sm font-semibold transition-all border-b-2 px-1 flex items-center gap-2 ${
            activeTab === "triage"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
          onClick={() => setActiveTab("triage")}
        >
          <SlidersHorizontal className="w-4 h-4" />
          Triage Defaults
        </button>
        <button
          className={`pb-3 text-sm font-semibold transition-all border-b-2 px-1 flex items-center gap-2 ${
            activeTab === "audit"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
          onClick={() => setActiveTab("audit")}
        >
          <History className="w-4 h-4" />
          Audit Logs
        </button>
        <button
          className={`pb-3 text-sm font-semibold transition-all border-b-2 px-1 flex items-center gap-2 ${
            activeTab === "emails"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
          onClick={() => setActiveTab("emails")}
        >
          <Mail className="w-4 h-4" />
          Email Delivery Logs
        </button>
      </div>

      {/* TAB CONTENTS */}
      {activeTab === "general" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start animate-in fade-in duration-200">
          <div className="lg:col-span-2 space-y-6">
            {/* GOOGLE ADS CONNECTION CARD */}
            <Card className="py-0 border-slate-200 shadow-sm overflow-hidden">
              <CardHeader className="bg-slate-50 border-b border-slate-100 p-5">
                <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-800">
                  <Database className="w-4 h-4 text-indigo-500" />
                  Google Ads API Connection
                </CardTitle>
                <CardDescription className="text-xs">
                  Link and manage your top-level Google Ads Manager (MCC) connection.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                {connection ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 p-4 bg-emerald-55 border border-emerald-200 text-emerald-900 rounded-xl">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                      <div className="text-xs leading-relaxed">
                        <p className="font-extrabold">✅ Connected Successfully</p>
                        <p className="text-emerald-700 mt-0.5">
                          Uprise Digital is synchronized with Google Ads.
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                      <div className="p-3 bg-slate-50 border border-slate-100 rounded-lg">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                          Connected Email
                        </span>
                        <span className="font-semibold text-slate-800 block mt-1">
                          {connection.connectedEmail}
                        </span>
                      </div>
                      <div className="p-3 bg-slate-50 border border-slate-100 rounded-lg">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                          Manager ID (MCC)
                        </span>
                        <span className="font-semibold text-slate-800 font-mono block mt-1">
                          {connection.managerCustomerId ? formatCustomerId(connection.managerCustomerId) : "Direct Client Account"}
                        </span>
                      </div>
                    </div>

                    <div className="p-3 bg-slate-50 border border-slate-100 rounded-lg text-xs">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                        Linked Client Accounts
                      </span>
                      <span className="font-semibold text-slate-800 block mt-1">
                        {accounts.filter(a => a.isActive).length} active ad accounts synced under this connection.
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-3 pt-2">
                      {connection.managerCustomerId && (
                        <>
                          <Button
                            onClick={handleOpenAccountsDialog}
                            className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-4 py-2 flex items-center gap-1.5 cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            Add or Remove Accounts
                          </Button>
                          <Button
                            onClick={handleRefreshAdAccountsMetadata}
                            disabled={refreshingAccounts}
                            variant="outline"
                            className="border-slate-200 text-slate-700 hover:bg-slate-50 font-bold text-xs px-4 py-2 flex items-center gap-1.5 cursor-pointer"
                          >
                            <RefreshCw className={cn("w-3.5 h-3.5", refreshingAccounts && "animate-spin text-indigo-600")} />
                            {refreshingAccounts ? "Refreshing..." : "Refresh Data"}
                          </Button>
                        </>
                      )}
                      <Button
                        onClick={() => setDisconnectDialogOpen(true)}
                        variant="outline"
                        className="border-red-200 text-red-650 hover:bg-red-50 hover:text-red-700 font-bold text-xs px-4 py-2 flex items-center gap-1.5 cursor-pointer"
                      >
                        <Trash className="w-3.5 h-3.5" />
                        Disconnect Google Ads
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4 text-center py-6">
                    <div className="inline-flex p-3 bg-slate-100 border rounded-full text-slate-400">
                      <AlertTriangle className="w-6 h-6" />
                    </div>
                    <div className="max-w-sm mx-auto space-y-1">
                      <p className="font-bold text-slate-800 text-sm">No Connected Google Ads Account</p>
                      <p className="text-xs text-slate-500">
                        Please link a Google Ads account to start monitoring and triaging campaign portfolios.
                      </p>
                    </div>
                    <Button
                      asChild
                      className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-5 py-2.5 inline-flex items-center gap-1.5 shadow-sm cursor-pointer"
                    >
                      <a href="/api/auth/google-ads/connect">
                        <Database className="w-3.5 h-3.5" />
                        Link Google Ads Account
                      </a>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* PROFILE SETTINGS CARD */}
            <Card className="py-0 border-slate-200 shadow-sm overflow-hidden">
              <CardHeader className="bg-slate-50 border-b border-slate-100 p-5">
                <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-800">
                  <UserIcon className="w-4 h-4 text-indigo-500" />
                  Agency and User Profile
                </CardTitle>
                <CardDescription className="text-xs">
                  Manage agency profile name and view membership details.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="org-name" className="text-xs font-bold text-slate-700">
                    Agency Name
                  </Label>
                  <div className="flex gap-3">
                    <Input
                      id="org-name"
                      value={orgNameInput}
                      onChange={(e) => setOrgNameInput(e.target.value)}
                      className="flex-1 text-xs text-slate-800 h-9"
                    />
                    <Button
                      onClick={handleSaveOrgName}
                      disabled={savingOrgName}
                      className="bg-indigo-600 hover:bg-indigo-500 font-bold text-xs h-9 px-4 shrink-0"
                    >
                      {savingOrgName ? "Saving..." : "Save Settings"}
                    </Button>
                  </div>
                </div>

                {/* Auto-join domain checkbox */}
                <div className="flex items-start gap-2.5 p-3 bg-slate-50 border border-slate-100 rounded-xl mt-3 select-none">
                  <input
                    id="auto-join-domain"
                    type="checkbox"
                    checked={allowDomainAutoJoin}
                    onChange={(e) => setAllowDomainAutoJoin(e.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                  <div className="text-xs">
                    <label htmlFor="auto-join-domain" className="font-semibold text-slate-800 cursor-pointer">
                      Auto-add team members
                    </label>
                    <p className="text-slate-500 mt-0.5 leading-relaxed">
                      Allow anyone with a <strong className="text-indigo-600">@{userEmail.split("@")[1] || "domain"}</strong> email address to automatically join this organization.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-2">
                  <div className="space-y-1.5">
                    <Label className="text-slate-500 font-bold">Your Email Address</Label>
                    <Input
                      value={userEmail}
                      disabled
                      className="bg-slate-50 text-slate-500 text-xs h-9 cursor-not-allowed select-none border-slate-100"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-slate-500 font-bold">Membership Role</Label>
                    <div className="h-9 px-3 border border-slate-100 bg-slate-50 rounded-lg flex items-center">
                      <Badge variant="secondary" className="capitalize text-[10px] rounded-md font-bold px-2 py-0.5">
                        {userRole}
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="py-0 border-slate-200 shadow-sm overflow-hidden">
              <CardHeader className="bg-slate-50 border-b border-slate-100 p-5">
                <CardTitle className="text-sm font-bold text-slate-800">
                  Settings Help
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 text-xs text-slate-500 leading-relaxed space-y-3">
                <p>
                  <strong>Disconnecting Google Ads</strong> will stop all background triages and landing page audits. You can choose to retain imported accounts and histories or erase them entirely.
                </p>
                <p>
                  Use <strong>Add or Remove Accounts</strong> to link new client accounts under your connected manager account or hide accounts you no longer want to analyze.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* DISCONNECT CONFIRMATION DIALOG */}
      <Dialog open={disconnectDialogOpen} onOpenChange={setDisconnectDialogOpen}>
        <DialogContent className="max-w-md bg-white border rounded-xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
              Disconnect Google Ads Connection?
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 mt-2">
              This will remove Uprise Digital's credentials access to Google Ads. All background campaign syncing will stop immediately.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <label className="flex items-start gap-3 p-3 bg-slate-50 border rounded-lg cursor-pointer hover:bg-slate-100/50 transition-colors">
              <input
                type="checkbox"
                checked={deleteSyncedData}
                onChange={(e) => setDeleteSyncedData(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-650 focus:ring-indigo-500 cursor-pointer"
              />
              <div className="text-xs">
                <span className="font-bold text-slate-800 block">Delete all synced ad accounts and histories</span>
                <span className="text-slate-500 mt-0.5 block">
                  Erases all metric breakdowns, campaign landing pages, audit logs, and keywords permanently.
                </span>
              </div>
            </label>
          </div>

          <DialogFooter className="flex justify-end gap-3 border-t pt-4">
            <Button
              variant="outline"
              onClick={() => setDisconnectDialogOpen(false)}
              className="text-xs font-semibold"
            >
              Cancel
            </Button>
            <Button
              disabled={disconnecting}
              onClick={handleDisconnectConnection}
              className="bg-red-655 hover:bg-red-500 text-white font-bold text-xs"
            >
              {disconnecting ? "Disconnecting..." : "Confirm Disconnect"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ADD/REMOVE ACCOUNTS DIALOG */}
      <Dialog open={accountsDialogOpen} onOpenChange={setAccountsDialogOpen}>
        <DialogContent className="max-w-4xl bg-slate-950 text-white border border-slate-800 rounded-xl p-6 overflow-hidden flex flex-col max-h-[85vh]">
          <DialogHeader className="border-b border-slate-800 pb-4">
            <DialogTitle className="text-base font-extrabold flex items-center gap-2">
              <Plus className="w-5 h-5 text-indigo-400" />
              Add or Remove Client Accounts
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              Select which sub-accounts to track in Uprise Digital. Unchecked accounts will be set to inactive and hidden.
            </DialogDescription>
          </DialogHeader>

          {fetchingAccounts ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
              <span className="text-xs">Loading sub-accounts from Google Ads...</span>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto py-4 space-y-4">
              {/* Filters */}
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  placeholder="Search by account name or 10-digit ID..."
                  value={modalSearch}
                  onChange={(e) => setModalSearch(e.target.value)}
                  className="flex-1 px-3.5 py-2 bg-slate-900 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-white rounded-xl text-xs outline-none transition-all"
                />
                <select
                  value={modalStatusFilter}
                  onChange={(e) => setModalStatusFilter(e.target.value)}
                  className="px-3.5 py-2 bg-slate-900 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-white rounded-xl text-xs outline-none transition-all cursor-pointer"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="ACTIVE">Active Only</option>
                  <option value="CANCELLED">Cancelled Only</option>
                </select>
              </div>

              {/* Sub-Accounts Table */}
              <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950">
                <div className="overflow-x-auto max-h-96">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-900 text-slate-450 uppercase text-[10px] font-bold tracking-wider sticky top-0 border-b border-slate-800 z-10">
                      <tr>
                        <th className="p-3 w-10 text-center">
                          <input
                            type="checkbox"
                            checked={
                              previewAccounts.filter(acc => {
                                const matchName = acc.name.toLowerCase().includes(modalSearch.toLowerCase()) || acc.id.includes(modalSearch);
                                const matchStatus = modalStatusFilter === "ALL" || (modalStatusFilter === "ACTIVE" && acc.status === "ENABLED") || (modalStatusFilter === "CANCELLED" && acc.status === "CANCELED");
                                return matchName && matchStatus;
                              }).length > 0 &&
                              previewAccounts.filter(acc => {
                                const matchName = acc.name.toLowerCase().includes(modalSearch.toLowerCase()) || acc.id.includes(modalSearch);
                                const matchStatus = modalStatusFilter === "ALL" || (modalStatusFilter === "ACTIVE" && acc.status === "ENABLED") || (modalStatusFilter === "CANCELLED" && acc.status === "CANCELED");
                                return matchName && matchStatus;
                              }).every((acc) => selectedAccountIds.has(acc.id))
                            }
                            onChange={() => {
                              const filtered = previewAccounts.filter(acc => {
                                const matchName = acc.name.toLowerCase().includes(modalSearch.toLowerCase()) || acc.id.includes(modalSearch);
                                const matchStatus = modalStatusFilter === "ALL" || (modalStatusFilter === "ACTIVE" && acc.status === "ENABLED") || (modalStatusFilter === "CANCELLED" && acc.status === "CANCELED");
                                return matchName && matchStatus;
                              }).map(acc => acc.id);
                              const nextSet = new Set(selectedAccountIds);
                              const allSelected = filtered.every(id => nextSet.has(id));
                              if (allSelected) {
                                filtered.forEach(id => nextSet.delete(id));
                              } else {
                                filtered.forEach(id => nextSet.add(id));
                              }
                              setSelectedAccountIds(nextSet);
                            }}
                            className="h-3.5 w-3.5 rounded border-slate-800 text-indigo-650 focus:ring-indigo-500 cursor-pointer"
                          />
                        </th>
                        <th className="p-3 w-28">Status</th>
                        <th className="p-3">Account</th>
                        <th className="p-3 w-44">TZ & Currency</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850">
                      {previewAccounts.filter(acc => {
                        const matchName = acc.name.toLowerCase().includes(modalSearch.toLowerCase()) || acc.id.includes(modalSearch);
                        const matchStatus = modalStatusFilter === "ALL" || (modalStatusFilter === "ACTIVE" && acc.status === "ENABLED") || (modalStatusFilter === "CANCELLED" && acc.status === "CANCELED");
                        return matchName && matchStatus;
                      }).length === 0 ? (
                        <tr>
                          <td colSpan={4} className="p-8 text-center text-slate-500 font-medium">
                            No sub-accounts found.
                          </td>
                        </tr>
                      ) : (
                        previewAccounts.filter(acc => {
                          const matchName = acc.name.toLowerCase().includes(modalSearch.toLowerCase()) || acc.id.includes(modalSearch);
                          const matchStatus = modalStatusFilter === "ALL" || (modalStatusFilter === "ACTIVE" && acc.status === "ENABLED") || (modalStatusFilter === "CANCELLED" && acc.status === "CANCELED");
                          return matchName && matchStatus;
                        }).map((acc) => {
                          const isChecked = selectedAccountIds.has(acc.id);
                          return (
                            <tr
                              key={acc.id}
                              className={`hover:bg-slate-900/30 transition-colors cursor-pointer ${
                                isChecked ? "bg-indigo-600/5" : ""
                              }`}
                              onClick={() => {
                                const nextSet = new Set(selectedAccountIds);
                                if (nextSet.has(acc.id)) {
                                  nextSet.delete(acc.id);
                                } else {
                                  nextSet.add(acc.id);
                                }
                                setSelectedAccountIds(nextSet);
                              }}
                            >
                              <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => {
                                    const nextSet = new Set(selectedAccountIds);
                                    if (nextSet.has(acc.id)) {
                                      nextSet.delete(acc.id);
                                    } else {
                                      nextSet.add(acc.id);
                                    }
                                    setSelectedAccountIds(nextSet);
                                  }}
                                  className="h-3.5 w-3.5 rounded border-slate-800 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                />
                              </td>
                              <td className="p-3">
                                <span className="flex items-center gap-1.5 font-bold">
                                  <span
                                    className={`h-2 w-2 rounded-full flex-shrink-0 ${
                                      acc.status === "ENABLED"
                                        ? "bg-emerald-500"
                                        : acc.status === "CANCELED"
                                        ? "bg-slate-400"
                                        : acc.status === "SUSPENDED"
                                        ? "bg-rose-500"
                                        : "bg-amber-500"
                                    }`}
                                  />
                                  <span
                                    className={
                                      acc.status === "ENABLED"
                                        ? "text-emerald-450"
                                        : acc.status === "CANCELED"
                                        ? "text-slate-400"
                                        : "text-amber-400"
                                    }
                                  >
                                    {acc.status === "ENABLED"
                                      ? "Active"
                                      : acc.status === "CANCELED"
                                      ? "Cancelled"
                                      : acc.status}
                                  </span>
                                </span>
                              </td>
                              <td className="p-3">
                                <div className="flex flex-col gap-0.5">
                                  <span className="font-extrabold text-slate-200 text-xs truncate max-w-xs sm:max-w-md">
                                    {acc.name}
                                  </span>
                                  <span className="text-[10px] text-slate-500 font-mono">
                                    {formatCustomerId(acc.id)}
                                  </span>
                                </div>
                              </td>
                              <td className="p-3 text-slate-400 leading-normal">
                                <div className="flex flex-col">
                                  <span className="text-[10px] font-bold text-slate-500">{acc.currencyCode}</span>
                                  <span className="text-[10px] truncate max-w-xs">{acc.timeZone}</span>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="border-t border-slate-800 pt-4 flex items-center justify-between gap-3 bg-slate-950 shrink-0">
            <span className="text-xs text-slate-400">
              Selected: <strong className="text-indigo-400">{selectedAccountIds.size}</strong> accounts
            </span>
            <div className="flex gap-3">
              <Button
                variant="ghost"
                onClick={() => setAccountsDialogOpen(false)}
                className="text-slate-400 hover:text-white text-xs"
              >
                Cancel
              </Button>
              <Button
                disabled={savingLinkedAccounts || fetchingAccounts}
                onClick={handleSaveLinkedAccounts}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-4"
              >
                {savingLinkedAccounts ? "Saving Changes..." : "Save Changes"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {activeTab === "triage" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start animate-in fade-in duration-200">
          <div className="lg:col-span-2 space-y-6">
            <Card className="py-0 border-slate-200 shadow-sm overflow-hidden">
              <CardHeader className="bg-slate-50 border-b border-slate-100 p-5">
                <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-800">
                  <SlidersHorizontal className="w-4 h-4 text-indigo-500" />
                  Triage and Anomaly Defaults
                </CardTitle>
                <CardDescription className="text-xs">
                  Manage global alert logic thresholds. These values serve as
                  agency-wide defaults unless overridden at the individual
                  client account level.
                </CardDescription>
              </CardHeader>
              <form onSubmit={handleSave}>
                <CardContent className="p-6 space-y-6">
                  {/* SECTION 1: CRITICAL FIRE TRIGGERS */}
                  <div className="space-y-4">
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5 border-b pb-2">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                      Critical Fire Triggers
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="criticalSpend" className="text-xs">
                          Critical Spend Limit (AUD $)
                        </Label>
                        <Input
                          id="criticalSpend"
                          type="number"
                          step="0.01"
                          value={formState.criticalSpendThreshold}
                          onChange={(e) =>
                            handleInputChange(
                              "criticalSpendThreshold",
                              e.target.value,
                            )
                          }
                          className="text-xs bg-white"
                          required
                        />
                        <p className="text-[10px] text-slate-400">
                          Trigger alert if an account spends more than this with
                          low conversions.
                        </p>
                      </div>
                      <div className="space-y-1.5">
                        <Label
                          htmlFor="criticalConversions"
                          className="text-xs"
                        >
                          Maximum Conversions Target
                        </Label>
                        <Input
                          id="criticalConversions"
                          type="number"
                          step="1"
                          value={formState.criticalConversionsThreshold}
                          onChange={(e) =>
                            handleInputChange(
                              "criticalConversionsThreshold",
                              e.target.value,
                            )
                          }
                          className="text-xs bg-white"
                          required
                        />
                        <p className="text-[10px] text-slate-400">
                          The upper limit of conversions to classify as a
                          critical conversion leak.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* SECTION 2: PERFORMANCE ANOMALIES */}
                  <div className="space-y-4 pt-2">
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5 border-b pb-2">
                      <Activity className="w-3.5 h-3.5 text-amber-500" />
                      Performance Anomalies
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="ctrHigh" className="text-xs">
                          CTR Anomaly Limit (%)
                        </Label>
                        <Input
                          id="ctrHigh"
                          type="number"
                          step="0.1"
                          value={formState.ctrHighThreshold}
                          onChange={(e) =>
                            handleInputChange(
                              "ctrHighThreshold",
                              e.target.value,
                            )
                          }
                          className="text-xs bg-white"
                          required
                        />
                        <p className="text-[10px] text-slate-400">
                          Flags campaigns exceeding this CTR with zero
                          conversions.
                        </p>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="ctrHighSpend" className="text-xs">
                          Min Spend for CTR Anomaly (AUD $)
                        </Label>
                        <Input
                          id="ctrHighSpend"
                          type="number"
                          step="0.01"
                          value={formState.ctrHighSpendThreshold}
                          onChange={(e) =>
                            handleInputChange(
                              "ctrHighSpendThreshold",
                              e.target.value,
                            )
                          }
                          className="text-xs bg-white"
                          required
                        />
                        <p className="text-[10px] text-slate-400">
                          Minimum spend required to trigger the CTR anomaly
                          check.
                        </p>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="cpcHigh" className="text-xs">
                          Single Click High CPC (AUD $)
                        </Label>
                        <Input
                          id="cpcHigh"
                          type="number"
                          step="0.01"
                          value={formState.cpcHighThreshold}
                          onChange={(e) =>
                            handleInputChange(
                              "cpcHighThreshold",
                              e.target.value,
                            )
                          }
                          className="text-xs bg-white"
                          required
                        />
                        <p className="text-[10px] text-slate-400">
                          Flags single clicks exceeding this CPC as a budget
                          leak.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* SECTION 3: BASELINE DEVIATIONS */}
                  <div className="space-y-4 pt-2">
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5 border-b pb-2">
                      Baseline Variance Deviation (%)
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="anomalySpend" className="text-xs">
                          Spend Drop Threshold (%)
                        </Label>
                        <Input
                          id="anomalySpend"
                          type="number"
                          step="0.1"
                          value={formState.anomalySpendChangeThreshold}
                          onChange={(e) =>
                            handleInputChange(
                              "anomalySpendChangeThreshold",
                              e.target.value,
                            )
                          }
                          className="text-xs bg-white"
                          required
                        />
                        <p className="text-[10px] text-slate-400">
                          Trigger warning if spend drops by more than this
                          percent (e.g. -30.0).
                        </p>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="anomalyConversions" className="text-xs">
                          Conversions Drop Threshold (%)
                        </Label>
                        <Input
                          id="anomalyConversions"
                          type="number"
                          step="0.1"
                          value={formState.anomalyConversionsChangeThreshold}
                          onChange={(e) =>
                            handleInputChange(
                              "anomalyConversionsChangeThreshold",
                              e.target.value,
                            )
                          }
                          className="text-xs bg-white"
                          required
                        />
                        <p className="text-[10px] text-slate-400">
                          Trigger warning if conversions drop by more than this
                          percent (e.g. -25.0).
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>

                <CardFooter className="border-t border-slate-100 p-5 bg-slate-50 flex items-center justify-between">
                  <div className="text-xs text-slate-500">
                    {hasChanges ? (
                      <span className="text-amber-600 font-medium flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse inline-block" />
                        You have unsaved changes
                      </span>
                    ) : (
                      <span>Settings are up to date</span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleReset}
                      disabled={!hasChanges || isSaving}
                      className="text-xs"
                    >
                      Discard Changes
                    </Button>
                    <Button
                      type="submit"
                      size="sm"
                      disabled={!hasChanges || isSaving}
                      className="text-xs flex items-center gap-1.5"
                    >
                      {isSaving ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Save className="w-3.5 h-3.5" />
                      )}
                      Save Defaults
                    </Button>
                  </div>
                </CardFooter>
              </form>
            </Card>
          </div>

          <div className="lg:col-span-1 space-y-6">
            <Card className="border-slate-200 shadow-sm overflow-hidden">
              <CardHeader className="bg-slate-50 border-b border-slate-100 p-5 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-800">
                    <Database className="w-4 h-4 text-indigo-500" />
                    Portfolio Sync Status
                  </CardTitle>
                  <CardDescription className="text-xs mt-0.5">
                    Real-time connection and sync health of your portfolio.
                  </CardDescription>
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={handleManualSync}
                      disabled={isSyncing}
                      className="h-8 w-8 rounded-lg border-slate-200 text-slate-600 hover:bg-slate-100/80 transition-all shrink-0 cursor-pointer"
                    >
                      <RefreshCw className={cn("w-3.5 h-3.5", isSyncing && "animate-spin text-indigo-500")} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="left" className="bg-slate-900 text-white text-[10px] p-2 rounded-lg border border-slate-850">
                    Sync Portfolio Now
                  </TooltipContent>
                </Tooltip>
              </CardHeader>
              <CardContent className="p-5 space-y-5">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                    <div className="text-xs text-slate-500 font-medium">
                      Total
                    </div>
                    <div className="text-lg font-bold text-slate-800 mt-0.5">
                      {accounts.length}
                    </div>
                  </div>
                  <div className="p-2.5 bg-emerald-50/50 rounded-lg border border-emerald-100/50">
                    <div className="text-xs text-emerald-600 font-medium">
                      Healthy
                    </div>
                    <div className="text-lg font-bold text-emerald-700 mt-0.5">
                      {
                        accounts.filter((a) => a.syncStatus === "success")
                          .length
                      }
                    </div>
                  </div>
                  <div
                    className={`p-2.5 rounded-lg border ${
                      accounts.filter((a) => a.syncStatus === "failed").length >
                      0
                        ? "bg-rose-50 border-rose-100"
                        : "bg-slate-50 border-slate-100"
                    }`}
                  >
                    <div
                      className={`text-xs font-medium ${
                        accounts.filter((a) => a.syncStatus === "failed")
                          .length > 0
                          ? "text-rose-600"
                          : "text-slate-500"
                      }`}
                    >
                      Errors
                    </div>
                    <div
                      className={`text-lg font-bold mt-0.5 ${
                        accounts.filter((a) => a.syncStatus === "failed")
                          .length > 0
                          ? "text-rose-700"
                          : "text-slate-800"
                      }`}
                    >
                      {accounts.filter((a) => a.syncStatus === "failed").length}
                    </div>
                  </div>
                </div>

                <div className="h-px bg-slate-100 w-full" />

                <div className="space-y-3">
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Accounts Sync Log
                  </h4>
                  <div className="space-y-2.5 max-h-[320px] overflow-y-auto pr-1">
                    {accounts.length === 0 ? (
                      <div className="text-xs text-slate-500 text-center py-4">
                        No accounts linked to sync.
                      </div>
                    ) : (
                      accounts.map((acc) => {
                        const isFailed = acc.syncStatus === "failed";
                        const isSuccess = acc.syncStatus === "success";

                        return (
                          <div
                            key={acc.id}
                            className="p-3 bg-white border border-slate-100 rounded-lg shadow-sm space-y-1.5"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="text-xs font-bold text-slate-800 truncate max-w-[160px]">
                                {acc.name}
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                {isSuccess && (
                                  <span className="text-[10px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded font-medium flex items-center gap-1">
                                    <CheckCircle2 className="w-2.5 h-2.5 text-emerald-500" />
                                    Synced
                                  </span>
                                )}
                                {isFailed && (
                                  <span className="text-[10px] text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded font-medium flex items-center gap-1">
                                    <XCircle className="w-2.5 h-2.5 text-rose-500" />
                                    Error
                                  </span>
                                )}
                                {!isSuccess && !isFailed && (
                                  <span className="text-[10px] text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded font-medium flex items-center gap-1">
                                    <Clock className="w-2.5 h-2.5 text-slate-400" />
                                    Pending
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                              <Clock className="w-3 h-3 text-slate-400" />
                              <span>
                                Attempted:{" "}
                                {acc.lastSyncedAt
                                  ? new Date(acc.lastSyncedAt).toLocaleString(
                                      "en-AU",
                                      {
                                        month: "short",
                                        day: "numeric",
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      },
                                    )
                                  : "Never"}
                              </span>
                            </div>

                            {isFailed && acc.syncError && (
                              <div className="text-[10px] text-rose-600 bg-rose-50/50 p-2.5 rounded-lg border border-rose-100/50 flex items-start gap-2 leading-relaxed shadow-sm">
                                <span className="flex-1 font-semibold">
                                  {getPrettySyncError(acc.syncError)}
                                </span>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button
                                      type="button"
                                      className="p-1 -m-1 hover:bg-rose-100 rounded-md transition-colors text-rose-400 hover:text-rose-600 shrink-0 cursor-pointer"
                                    >
                                      <Info className="w-3.5 h-3.5" />
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent
                                    side="top"
                                    align="end"
                                    className="max-w-[280px] bg-slate-900 text-slate-100 p-2 rounded-lg text-[9px] font-mono whitespace-normal break-all leading-normal border border-slate-800 shadow-xl"
                                  >
                                    <p className="font-bold text-slate-400 mb-1 border-b border-slate-800 pb-1">
                                      Raw Error Code / Trace
                                    </p>
                                    {acc.syncError}
                                  </TooltipContent>
                                </Tooltip>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {activeTab === "audit" && (
        <Card className="border-slate-200 shadow-sm overflow-hidden animate-in fade-in duration-200">
          <CardHeader className="bg-slate-50 border-b border-slate-100 p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-800">
                <History className="w-4 h-4 text-indigo-500" />
                Administrative Audit Logs
              </CardTitle>
              <CardDescription className="text-xs">
                History of configurations changed by digital strategists or
                external Claude MCP actions.
              </CardDescription>
            </div>
            {/* SEARCH AND FILTERS */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search actor, action, table..."
                  value={auditSearch}
                  onChange={(e) => setAuditSearch(e.target.value)}
                  className="pl-8 text-xs h-9 bg-white"
                />
              </div>
              <div className="flex items-center gap-1.5 bg-white border rounded-lg px-2 py-1 text-xs text-slate-600">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                <select
                  value={auditFilter}
                  onChange={(e) => setAuditFilter(e.target.value)}
                  className="bg-transparent border-none focus:outline-none text-xs font-medium cursor-pointer"
                >
                  <option value="all">All Actions</option>
                  <option value="triage">Triage & Targets</option>
                  <option value="rules">Alert Rules</option>
                  <option value="user">User Management</option>
                  <option value="security">Security & API</option>
                  <option value="system">Briefings / System</option>
                </select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-slate-50/50">
                <TableRow>
                  <TableHead className="w-[160px] pl-6 text-xs font-bold text-slate-600">
                    Timestamp
                  </TableHead>
                  <TableHead className="text-xs font-bold text-slate-600">
                    Actor
                  </TableHead>
                  <TableHead className="text-xs font-bold text-slate-600">
                    Action
                  </TableHead>
                  <TableHead className="text-xs font-bold text-slate-600">
                    Target
                  </TableHead>
                  <TableHead className="text-right pr-6 text-xs font-bold text-slate-600">
                    Inspection
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAuditLogs.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="h-24 text-center text-xs text-slate-500 font-sans"
                    >
                      No audit logs match criteria.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAuditLogs.map((log) => {
                    const isSystem = log.actorId === "SYSTEM_AUTOMATION";
                    const isMcp = log.actorId === "MCP_AGENT";
                    const actorName =
                      log.actor?.name ||
                      (isMcp
                        ? "Claude MCP Agent"
                        : isSystem
                          ? "System Automation"
                          : "System");
                    const actorEmail =
                      log.actor?.email ||
                      (isMcp
                        ? "mcp-agent@uprisedigital.com"
                        : isSystem
                          ? "system@uprisedigital.com"
                          : "");

                    return (
                      <TableRow
                        key={log.id}
                        className="hover:bg-slate-50/50 transition-colors"
                      >
                        <TableCell className="font-mono text-[10px] text-slate-500 pl-6">
                          {new Date(log.createdAt).toLocaleString("en-AU", {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                          })}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Avatar className="w-6 h-6 border">
                              <AvatarImage src={log.actor?.image || ""} />
                              <AvatarFallback className="bg-slate-100 text-[10px]">
                                {isMcp ? (
                                  "AI"
                                ) : isSystem ? (
                                  "SYS"
                                ) : (
                                  <UserIcon className="w-3 h-3 text-slate-500" />
                                )}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex flex-col">
                              <span className="text-xs font-semibold text-slate-800">
                                {actorName}
                              </span>
                              {actorEmail && (
                                <span className="text-[10px] text-slate-400 font-mono">
                                  {actorEmail}
                                </span>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={getActionBadgeVariant(log.action) as any}
                            className="text-[10px] py-0"
                          >
                            {log.action}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="text-xs font-medium text-slate-700 font-mono">
                              {log.targetTable}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              ID: {log.targetId}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right pr-6">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedAuditLog(log)}
                            className="h-8 w-8 p-0 rounded-full"
                          >
                            <Info className="w-4 h-4 text-slate-500" />
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

      {activeTab === "emails" && (
        <Card className="border-slate-200 shadow-sm overflow-hidden animate-in fade-in duration-200">
          <CardHeader className="bg-slate-50 border-b border-slate-100 p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-800">
                <Mail className="w-4 h-4 text-indigo-500" />
                Email Delivery Statuses
              </CardTitle>
              <CardDescription className="text-xs">
                Log of outgoing Resend email dispatches for briefings, automated
                schedules, and on-demand campaigns.
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
                  <option value="on_demand_report">On-Demand Reports</option>
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
                    const isSuccess = email.status === "success";

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
                              <span className="text-[10px] text-slate-400 font-medium">
                                Account: {email.accountName}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {isSuccess ? (
                            <span className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded font-bold inline-flex items-center gap-1">
                              <CheckCircle2 className="w-2.5 h-2.5 text-emerald-500" />
                              Delivered
                            </span>
                          ) : (
                            <span className="text-[10px] text-rose-700 bg-rose-50 border border-rose-100 px-1.5 py-0.5 rounded font-bold inline-flex items-center gap-1">
                              <XCircle className="w-2.5 h-2.5 text-rose-500" />
                              Bounced / Failed
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right pr-6">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedEmailLog(email)}
                            className="h-8 w-8 p-0 rounded-full"
                          >
                            <Info className="w-4 h-4 text-slate-500" />
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

      {/* AUDIT LOG INSPECTOR DIALOG */}
      <Dialog
        open={selectedAuditLog !== null}
        onOpenChange={(open) => !open && setSelectedAuditLog(null)}
      >
        <DialogContent className="max-w-xl bg-white border border-slate-200">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <History className="w-4 h-4 text-indigo-500" />
              Audit Log Details
            </DialogTitle>
            <DialogDescription className="text-xs">
              Full structured metadata audit trail details.
            </DialogDescription>
          </DialogHeader>
          {selectedAuditLog && (
            <div className="space-y-4 pt-2 font-sans text-xs">
              <div className="grid grid-cols-2 gap-4 border-b pb-4">
                <div className="space-y-0.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Timestamp
                  </span>
                  <span className="font-semibold text-slate-800">
                    {new Date(selectedAuditLog.createdAt).toLocaleString(
                      "en-AU",
                      {
                        weekday: "long",
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      },
                    )}
                  </span>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Action Badge
                  </span>
                  <Badge
                    variant={
                      getActionBadgeVariant(selectedAuditLog.action) as any
                    }
                    className="text-[10px]"
                  >
                    {selectedAuditLog.action}
                  </Badge>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Target Table
                  </span>
                  <span className="font-mono text-slate-700 font-semibold">
                    {selectedAuditLog.targetTable}
                  </span>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Target Item ID
                  </span>
                  <span className="font-mono text-slate-700 font-semibold">
                    {selectedAuditLog.targetId}
                  </span>
                </div>
              </div>

              {/* ACTOR CARD */}
              <div className="p-3 bg-slate-50 border rounded-lg flex items-center gap-3">
                <Avatar className="w-8 h-8 border">
                  <AvatarImage src={selectedAuditLog.actor?.image || ""} />
                  <AvatarFallback className="bg-slate-100 text-xs">
                    {selectedAuditLog.actorId === "MCP_AGENT"
                      ? "AI"
                      : selectedAuditLog.actorId === "SYSTEM_AUTOMATION"
                        ? "SYS"
                        : "U"}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="font-bold text-slate-800">
                    {selectedAuditLog.actor?.name ||
                      (selectedAuditLog.actorId === "MCP_AGENT"
                        ? "Claude MCP Agent"
                        : selectedAuditLog.actorId === "SYSTEM_AUTOMATION"
                          ? "System Automation"
                          : "System Agent")}
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono">
                    Actor ID: {selectedAuditLog.actorId || "unknown_system_id"}
                  </div>
                </div>
              </div>

              {/* STRUCTURED METADATA INSPECTION */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Change Details
                </span>
                {selectedAuditLog.metadata ? (
                  <div className="bg-slate-900 border text-slate-200 rounded-lg p-4 font-mono text-[10px] max-h-60 overflow-y-auto leading-relaxed shadow-inner">
                    <pre className="whitespace-pre-wrap">
                      {JSON.stringify(selectedAuditLog.metadata, null, 2)}
                    </pre>
                  </div>
                ) : (
                  <span className="text-slate-400 text-xs italic">
                    No additional metadata registered for this action.
                  </span>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* EMAIL LOG INSPECTOR DIALOG */}
      <Dialog
        open={selectedEmailLog !== null}
        onOpenChange={(open) => !open && setSelectedEmailLog(null)}
      >
        <DialogContent className="max-w-xl bg-white border border-slate-200">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Mail className="w-4 h-4 text-indigo-500" />
              Email Log Details
            </DialogTitle>
            <DialogDescription className="text-xs">
              Outbound Resend delivery statistics and tracing log.
            </DialogDescription>
          </DialogHeader>
          {selectedEmailLog && (
            <div className="space-y-4 pt-2 font-sans text-xs">
              <div className="grid grid-cols-2 gap-4 border-b pb-4">
                <div className="space-y-0.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Sent Timestamp
                  </span>
                  <span className="font-semibold text-slate-800">
                    {new Date(selectedEmailLog.sentAt).toLocaleString("en-AU", {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </span>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Email Type
                  </span>
                  <Badge
                    variant="outline"
                    className="text-[10px] text-slate-700 bg-slate-50 py-0"
                  >
                    {formatEmailType(selectedEmailLog.emailType)}
                  </Badge>
                </div>
                <div className="space-y-0.5 col-span-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Recipients
                  </span>
                  <span className="font-semibold text-slate-800 select-all font-mono break-all leading-normal">
                    {selectedEmailLog.recipient}
                  </span>
                </div>
                <div className="space-y-0.5 col-span-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Subject Line
                  </span>
                  <span className="font-bold text-slate-800 text-sm leading-normal">
                    {selectedEmailLog.subject}
                  </span>
                </div>
              </div>

              {/* RESEND MESSAGE ID CARD */}
              {selectedEmailLog.resendId && (
                <div className="p-3 bg-slate-50 border rounded-lg flex items-center justify-between gap-3">
                  <div className="space-y-0.5 min-w-0">
                    <span className="text-[9px] font-bold text-indigo-500 uppercase tracking-wider block">
                      Resend Message ID
                    </span>
                    <span className="font-mono text-[10px] text-slate-700 truncate block font-bold">
                      {selectedEmailLog.resendId}
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(selectedEmailLog.resendId!)}
                    className="h-8 shrink-0 flex items-center gap-1.5 text-[10px]"
                  >
                    {copiedText === selectedEmailLog.resendId ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-slate-500" />
                        Copy
                      </>
                    )}
                  </Button>
                </div>
              )}

              {/* TROUBLESHOOTING ERROR PANEL */}
              {selectedEmailLog.error && (
                <div className="space-y-2">
                  <span className="text-[10px] font-bold text-rose-500 uppercase tracking-wider block">
                    Error / Failure Log
                  </span>
                  <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-lg p-4 font-mono text-[10px] leading-relaxed shadow-sm flex gap-2 items-start">
                    <XCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                    <pre className="whitespace-pre-wrap font-mono leading-relaxed">
                      {selectedEmailLog.error}
                    </pre>
                  </div>
                </div>
              )}

              {/* CLIENT ACCOUNT LINK */}
              {selectedEmailLog.accountName && (
                <div className="p-3 border rounded-lg bg-slate-50/50 flex items-center justify-between text-xs text-slate-600">
                  <span>
                    Linked Client Account:{" "}
                    <strong>{selectedEmailLog.accountName}</strong>
                  </span>
                  {selectedEmailLog.adAccountId && (
                    <a
                      href={`/accounts/${selectedEmailLog.adAccountId}`}
                      className="text-indigo-600 font-semibold hover:underline flex items-center gap-1 text-[10px]"
                    >
                      View Account
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
    </TooltipProvider>
    </SettingsErrorBoundary>
  );
}
