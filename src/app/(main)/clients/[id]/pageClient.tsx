"use client";

import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
  ExternalLink,
  Flame,
  Globe,
  HelpCircle,
  History,
  Info,
  Layers,
  Link as LinkIcon,
  Loader2,
  Mail,
  Pencil,
  Phone,
  PhoneCall,
  Play,
  RefreshCw,
  RotateCw,
  Send,
  SlidersHorizontal,
  Sparkles,
  Target,
  Trash2,
  User,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { listAccountsAction } from "@/actions/agency.actions";
import {
  associateAdAccountAction,
  associateMetaAdAccountAction,
  deleteClientOnboardingAction,
  finalizeOnboardingAction,
  getClientEmailLogsAction,
  getClientOnboardingByIdAction,
  runOnboardingPipelineAction,
  sendOnboardingEmailAction,
  updateClientOnboardingAction,
} from "@/actions/client-onboarding.actions";
import { getMetaAdAccountsAction } from "@/actions/meta-settings.actions";
import { getOnboardingSettingsAction } from "@/actions/onboarding-settings.actions";
import ClientCallHistory from "@/components/clients/client-call-history";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { compileOnboardingEmail } from "@/lib/onboarding-email";
import { cn } from "@/lib/utils";

interface ClientDetailPageProps {
  clientId: number;
}

export default function ClientDetailPageClient({
  clientId,
}: ClientDetailPageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab =
    (searchParams.get("tab") as "calls" | "workspace" | "integrations") ||
    "calls";

  const [client, setClient] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<
    "calls" | "workspace" | "integrations"
  >(initialTab);

  // Settings & Ad Accounts
  const [onboardingSettings, setOnboardingSettings] = useState<any>(null);
  const [adAccountsList, setAdAccountsList] = useState<
    { id: number; name: string; googleAccountId: string }[]
  >([]);
  const [selectedAdAccountId, setSelectedAdAccountId] = useState<string>("");
  const [metaAdAccountsList, setMetaAdAccountsList] = useState<
    { id: number; name: string; metaAccountId: string }[]
  >([]);
  const [selectedMetaAdAccountId, setSelectedMetaAdAccountId] = useState<string>("");

  // Edit Link States
  const [editDrive, setEditDrive] = useState("");
  const [editNotion, setEditNotion] = useState("");
  const [editSignal, setEditSignal] = useState("");
  const [isSavingLinks, setIsSavingLinks] = useState(false);

  // Email States
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [isEditingEmailTemplate, setIsEditingEmailTemplate] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [emailLogs, setEmailLogs] = useState<any[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  // Execution states
  const [isRunningPipeline, setIsRunningPipeline] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);

  // Edit Client Details Modal States
  const [isEditClientOpen, setIsEditClientOpen] = useState(false);
  const [editClientName, setEditClientName] = useState("");
  const [editPrimaryContactName, setEditPrimaryContactName] = useState("");
  const [editContactEmail, setEditContactEmail] = useState("");
  const [editContactPhone, setEditContactPhone] = useState("");
  const [isSavingClientDetails, setIsSavingClientDetails] = useState(false);

  const loadClientDetails = useCallback(async () => {
    try {
      setLoading(true);
      const [clientRes, settingsRes, adAccountsRes, metaAccountsRes] = await Promise.all([
        getClientOnboardingByIdAction(clientId),
        getOnboardingSettingsAction(),
        listAccountsAction(),
        getMetaAdAccountsAction(),
      ]);

      if (clientRes.success && clientRes.client) {
        const c = clientRes.client;
        setClient(c);
        setEditDrive(c.driveFolderLink || "");
        setEditNotion(c.notionDashboardLink || "");
        setEditSignal(c.signalGroupLink || "");

        if ((clientRes as any).emailLogs) {
          setEmailLogs((clientRes as any).emailLogs);
        }

        const linkedGoogle = c.adAccounts?.[0];
        setSelectedAdAccountId(linkedGoogle ? String(linkedGoogle.id) : "");

        const linkedMeta = (c as any).metaAdAccounts?.[0];
        setSelectedMetaAdAccountId(linkedMeta ? String(linkedMeta.id) : "");
      } else {
        toast.error(clientRes.error || "Client record not found.");
      }

      if (settingsRes.success && settingsRes.data) {
        setOnboardingSettings(settingsRes.data);
        setEmailSubject(
          settingsRes.data.welcomeEmailSubject ||
            "Welcome to Uprise Digital - Let's get started!",
        );
        setEmailBody(settingsRes.data.welcomeEmailTemplate || "");
      }

      if (adAccountsRes.success && adAccountsRes.data) {
        setAdAccountsList(
          adAccountsRes.data.map((acc: any) => ({
            id: acc.id,
            name: acc.name,
            googleAccountId: acc.googleAccountId || acc.accountId || "",
          })),
        );
      }

      if (metaAccountsRes.success && metaAccountsRes.accounts) {
        setMetaAdAccountsList(
          metaAccountsRes.accounts.map((acc: any) => ({
            id: acc.id,
            name: acc.name,
            metaAccountId: acc.metaAccountId || "",
          })),
        );
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to load client details");
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    loadClientDetails();
  }, [loadClientDetails]);

  // Sync tab with URL query params
  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (
      tabParam &&
      (tabParam === "calls" ||
        tabParam === "workspace" ||
        tabParam === "integrations")
    ) {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  const handleTabChange = (tab: "calls" | "workspace" | "integrations") => {
    setActiveTab(tab);
    router.replace(`/clients/${clientId}?tab=${tab}`, { scroll: false });
  };

  const handleSaveLinks = async () => {
    if (!client) return;
    setIsSavingLinks(true);
    try {
      const res = await updateClientOnboardingAction(client.id, {
        driveFolderLink: editDrive || null,
        notionDashboardLink: editNotion || null,
        signalGroupLink: editSignal || null,
      });

      if (res.success) {
        toast.success("Workspace resource links updated!");
        setClient({
          ...client,
          driveFolderLink: editDrive,
          notionDashboardLink: editNotion,
          signalGroupLink: editSignal,
        });
      } else {
        toast.error(res.error || "Failed to update links.");
      }
    } catch (error: any) {
      toast.error(error.message || "An unexpected error occurred.");
    } finally {
      setIsSavingLinks(false);
    }
  };

  const openEditClientModal = () => {
    if (!client) return;
    setEditClientName(client.clientName || "");
    setEditPrimaryContactName(client.primaryContactName || "");
    setEditContactEmail(client.contactEmail || "");
    setEditContactPhone(client.contactPhone || "");
    setIsEditClientOpen(true);
  };

  const handleSaveClientDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!client) return;

    if (!editClientName.trim()) {
      toast.error("Company / Client name is required.");
      return;
    }
    if (!editPrimaryContactName.trim()) {
      toast.error("Primary contact name is required.");
      return;
    }
    if (!editContactEmail.trim()) {
      toast.error("Contact email is required.");
      return;
    }

    setIsSavingClientDetails(true);
    try {
      const res = await updateClientOnboardingAction(client.id, {
        clientName: editClientName.trim(),
        primaryContactName: editPrimaryContactName.trim(),
        contactEmail: editContactEmail.trim(),
        contactPhone: editContactPhone.trim() || null,
      });

      if (res.success) {
        toast.success("Client details updated successfully!");
        setClient({
          ...client,
          clientName: editClientName.trim(),
          primaryContactName: editPrimaryContactName.trim(),
          contactEmail: editContactEmail.trim(),
          contactPhone: editContactPhone.trim() || null,
        });
        setIsEditClientOpen(false);
      } else {
        toast.error(res.error || "Failed to update client details.");
      }
    } catch (error: any) {
      toast.error(error.message || "An unexpected error occurred.");
    } finally {
      setIsSavingClientDetails(false);
    }
  };

  const handleRunPipeline = async () => {
    if (!client) return;
    setIsRunningPipeline(true);
    try {
      const res = await runOnboardingPipelineAction(client.id);
      if (res.success) {
        toast.success("Onboarding pipeline completed successfully!");
        await loadClientDetails();
      } else {
        toast.error(res.error || "Pipeline execution failed.");
      }
    } catch (error: any) {
      toast.error(error.message || "An unexpected error occurred.");
    } finally {
      setIsRunningPipeline(false);
    }
  };

  const handleSendEmail = async () => {
    if (!client) return;

    if (!editSignal || !editSignal.trim()) {
      toast.error(
        "Please fill in the Signal Chat Group link before sending the welcome email.",
      );
      return;
    }
    if (!editDrive || !editDrive.trim()) {
      toast.error(
        "Please fill in the Google Drive Folder link before sending the welcome email.",
      );
      return;
    }
    if (!editNotion || !editNotion.trim()) {
      toast.error(
        "Please fill in the Notion Dashboard link before sending the welcome email.",
      );
      return;
    }

    setIsSendingEmail(true);
    try {
      // Auto-save the workspace links to the database before dispatching
      const saveRes = await updateClientOnboardingAction(client.id, {
        driveFolderLink: editDrive.trim() || null,
        notionDashboardLink: editNotion.trim() || null,
        signalGroupLink: editSignal.trim() || null,
      });

      if (!saveRes.success) {
        toast.error(saveRes.error || "Failed to save workspace links.");
        return;
      }

      const emailContent = compileOnboardingEmail({
        primaryContactName: client.primaryContactName,
        clientName: client.clientName,
        driveFolderLink: editDrive.trim(),
        notionDashboardLink: editNotion.trim(),
        signalGroupLink: editSignal.trim(),
        googleAdsAccess: client.googleAdsAccess,
        metaAdsAccess: client.metaAdsAccess,
        customTemplate: emailBody || undefined,
      });

      const res = await sendOnboardingEmailAction(
        client.id,
        emailSubject,
        emailContent.html,
        emailContent.text,
      );

      if (res.success) {
        toast.success("Onboarding email dispatched successfully!");
        await loadClientDetails();
      } else {
        toast.error(res.error || "Failed to dispatch email.");
      }
    } catch (error: any) {
      toast.error(error.message || "An unexpected error occurred.");
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handleFinalize = async () => {
    if (!client) return;
    setIsFinalizing(true);
    try {
      const res = await finalizeOnboardingAction(client.id);
      if (res.success) {
        toast.success("Client marked as active and onboarding finalized!");
        await loadClientDetails();
      } else {
        toast.error(res.error || "Failed to finalize client.");
      }
    } catch (error: any) {
      toast.error(error.message || "An unexpected error occurred.");
    } finally {
      setIsFinalizing(false);
    }
  };

  const handleAssociateAccount = async (accId: string) => {
    if (!client) return;
    setSelectedAdAccountId(accId);
    try {
      const res = await associateAdAccountAction(
        client.id,
        accId ? parseInt(accId, 10) : null,
      );
      if (res.success) {
        toast.success("Google Ad account linked successfully!");
        await loadClientDetails();
      } else {
        toast.error(res.error || "Failed to link Google ad account.");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to link Google ad account.");
    }
  };

  const handleAssociateMetaAccount = async (metaId: string) => {
    if (!client) return;
    setSelectedMetaAdAccountId(metaId);
    try {
      const res = await associateMetaAdAccountAction(
        client.id,
        metaId ? parseInt(metaId, 10) : null,
      );
      if (res.success) {
        toast.success("Meta Ad account linked successfully!");
        await loadClientDetails();
      } else {
        toast.error(res.error || "Failed to link Meta ad account.");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to link Meta ad account.");
    }
  };

  const handleDeleteClient = async () => {
    if (!client) return;
    if (
      !confirm(
        `Are you sure you want to delete ${client.clientName}? This action cannot be undone.`,
      )
    ) {
      return;
    }
    try {
      const res = await deleteClientOnboardingAction(client.id);
      if (res.success) {
        toast.success("Client deleted successfully.");
        router.push("/clients");
      } else {
        toast.error(res.error || "Failed to delete client.");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to delete client.");
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(label);
    toast.success(`${label} copied to clipboard!`);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const formatDateTime = (dateStr?: string | Date | null) => {
    if (!dateStr) return "N/A";
    const d = new Date(dateStr);
    return d.toLocaleString("en-AU", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const latestEmailLog = emailLogs[0] || null;
  const isEmailSent =
    client?.status === "email_sent" ||
    client?.status === "completed" ||
    Boolean(client?.emailSentAt) ||
    latestEmailLog?.status === "success";
  const emailSentDate = client?.emailSentAt || latestEmailLog?.sentAt;

  if (loading) {
    return (
      <div className="p-8 max-w-7xl mx-auto space-y-6">
        <div className="flex items-center gap-2 text-slate-400 text-xs">
          <Link
            href="/clients"
            className="hover:text-slate-700 flex items-center gap-1"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> All Clients
          </Link>
        </div>
        <div className="h-64 flex flex-col items-center justify-center text-slate-400">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-500 mb-3" />
          <p className="text-sm font-medium">
            Loading client intelligence & workspace...
          </p>
        </div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="p-8 max-w-7xl mx-auto space-y-6">
        <div className="flex items-center gap-2 text-slate-400 text-xs">
          <Link
            href="/clients"
            className="hover:text-slate-700 flex items-center gap-1"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> All Clients
          </Link>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center space-y-4">
          <AlertCircle className="h-10 w-10 text-rose-500 mx-auto" />
          <h2 className="text-lg font-bold text-slate-900">Client Not Found</h2>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            The requested client record does not exist or has been removed.
          </p>
          <Button
            onClick={() => router.push("/clients")}
            className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold"
          >
            Return to Clients Directory
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* 1. Breadcrumbs & Top Navigation */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Link
            href="/clients"
            className="hover:text-indigo-600 flex items-center gap-1 font-medium transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Clients Directory
          </Link>
          <span className="text-slate-300">/</span>
          <span className="font-bold text-slate-900 truncate max-w-xs">
            {client.clientName}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={openEditClientModal}
            className="bg-white hover:bg-slate-50 text-slate-700 font-medium text-xs h-8 px-3 rounded-lg flex items-center gap-1.5 shadow-xs border-slate-200 cursor-pointer"
            title="Edit Client & Contact Details"
          >
            <Pencil className="h-3.5 w-3.5 text-slate-500" />
            Edit Details
          </Button>

          {client.status !== "completed" && (
            <Button
              onClick={handleFinalize}
              disabled={isFinalizing}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs h-8 px-3 rounded-lg flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              {isFinalizing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5" />
              )}
              Finalize Onboarding
            </Button>
          )}

          <Button
            variant="outline"
            onClick={handleDeleteClient}
            className="text-xs h-8 text-slate-400 hover:text-rose-600 hover:bg-rose-50 border-slate-200 rounded-lg px-2.5 cursor-pointer"
            title="Delete Client"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* 2. Client Header Card */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div className="space-y-1.5">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2 group">
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                  {client.clientName}
                </h1>
                <button
                  type="button"
                  onClick={openEditClientModal}
                  className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                  title="Rename or Edit Client"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              </div>
              {client.status === "completed" ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />{" "}
                  Active Client
                </span>
              ) : client.status === "failed" ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                  <AlertCircle className="h-3.5 w-3.5 text-rose-500" /> Pipeline
                  Failed
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                  <Clock className="h-3.5 w-3.5 text-amber-500" /> In Onboarding
                </span>
              )}

              {/* Email Delivery Status Badge */}
              {isEmailSent ? (
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("workspace");
                    setIsHistoryOpen(true);
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors cursor-pointer"
                  title={
                    emailSentDate
                      ? `Welcome email sent on ${formatDateTime(emailSentDate)}`
                      : "Welcome email delivered"
                  }
                >
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  Email Sent
                  {emailSentDate
                    ? ` (${new Date(emailSentDate).toLocaleDateString("en-AU", { month: "short", day: "numeric" })})`
                    : ""}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setActiveTab("workspace")}
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-500 border border-slate-200 hover:bg-slate-200 transition-colors cursor-pointer"
                  title="Welcome email not dispatched yet"
                >
                  <Mail className="h-3.5 w-3.5 text-slate-400" />
                  Email Not Sent
                </button>
              )}

              {client.ghlPipelineStage && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  Stage: {client.ghlPipelineStage}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 flex items-center gap-2">
              <span>
                Added {new Date(client.createdAt).toLocaleDateString()}
              </span>
              {client.ghlContactId && (
                <>
                  <span>•</span>
                  <span className="text-indigo-600 font-mono text-[11px]">
                    GHL Contact ID: {client.ghlContactId}
                  </span>
                </>
              )}
            </p>
          </div>

          {/* Ad Access Badges */}
          <div className="flex items-center gap-2 shrink-0">
            {client.googleAdsAccess && (
              <span
                className={cn(
                  "px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 border",
                  client.googleAdsStatus === "granted"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : "bg-slate-50 text-slate-600 border-slate-200",
                )}
              >
                <Target className="h-3.5 w-3.5 text-indigo-600" /> Google Ads:{" "}
                {client.googleAdsStatus}
              </span>
            )}
            {client.metaAdsAccess && (
              <span
                className={cn(
                  "px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 border",
                  client.metaAdsStatus === "granted"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : "bg-slate-50 text-slate-600 border-slate-200",
                )}
              >
                <Layers className="h-3.5 w-3.5 text-blue-600" /> Meta:{" "}
                {client.metaAdsStatus}
              </span>
            )}
          </div>
        </div>

        {/* Contact Meta Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
          <div className="bg-slate-50/80 border border-slate-200/60 rounded-xl p-3 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
              <User className="h-3 w-3" /> Primary Contact
            </span>
            <p className="text-xs font-bold text-slate-800 truncate">
              {client.primaryContactName}
            </p>
          </div>

          <div className="bg-slate-50/80 border border-slate-200/60 rounded-xl p-3 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
              <Mail className="h-3 w-3" /> Email Address
            </span>
            <div className="flex items-center justify-between">
              <a
                href={`mailto:${client.contactEmail}`}
                className="text-xs font-bold text-indigo-600 hover:underline truncate"
              >
                {client.contactEmail}
              </a>
              <button
                type="button"
                onClick={() => copyToClipboard(client.contactEmail, "Email")}
                className="p-1 text-slate-400 hover:text-slate-600 rounded cursor-pointer"
                title="Copy Email"
              >
                {copiedField === "Email" ? (
                  <Check className="h-3 w-3 text-emerald-600" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </button>
            </div>
          </div>

          <div className="bg-slate-50/80 border border-slate-200/60 rounded-xl p-3 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
              <Phone className="h-3 w-3" /> Phone Number
            </span>
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-slate-800 truncate">
                {client.contactPhone || "Not specified"}
              </p>
              {client.contactPhone && (
                <button
                  type="button"
                  onClick={() => copyToClipboard(client.contactPhone, "Phone")}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded cursor-pointer"
                  title="Copy Phone"
                >
                  {copiedField === "Phone" ? (
                    <Check className="h-3 w-3 text-emerald-600" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </button>
              )}
            </div>
          </div>

          <div className="bg-slate-50/80 border border-slate-200/60 rounded-xl p-3 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
              <Globe className="h-3 w-3" /> Linked Portfolio
            </span>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 truncate">
                {client.adAccounts && client.adAccounts.length > 0
                  ? client.adAccounts[0].name
                  : "None linked"}
              </span>
              <button
                type="button"
                onClick={() => handleTabChange("integrations")}
                className="text-[10px] text-indigo-600 hover:underline font-semibold"
              >
                Manage
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Tab Switcher Navigation */}
      <div className="flex border-b border-slate-200 gap-6">
        <button
          type="button"
          onClick={() => handleTabChange("calls")}
          className={cn(
            "pb-3 text-sm font-bold transition-all border-b-2 flex items-center gap-2 cursor-pointer",
            activeTab === "calls"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-slate-500 hover:text-slate-800",
          )}
        >
          <PhoneCall className="h-4 w-4" /> Call History & AI Transcripts
        </button>

        <button
          type="button"
          onClick={() => handleTabChange("workspace")}
          className={cn(
            "pb-3 text-sm font-bold transition-all border-b-2 flex items-center gap-2 cursor-pointer",
            activeTab === "workspace"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-slate-500 hover:text-slate-800",
          )}
        >
          <SlidersHorizontal className="h-4 w-4" /> Workspace & Onboarding
          Outbox
        </button>

        <button
          type="button"
          onClick={() => handleTabChange("integrations")}
          className={cn(
            "pb-3 text-sm font-bold transition-all border-b-2 flex items-center gap-2 cursor-pointer",
            activeTab === "integrations"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-slate-500 hover:text-slate-800",
          )}
        >
          <Target className="h-4 w-4" /> Ad Accounts & Audits
        </button>
      </div>

      {/* 4. TAB CONTENTS */}

      {/* TAB 1: CALL INTELLIGENCE */}
      {activeTab === "calls" && (
        <div className="space-y-4">
          <ClientCallHistory
            clientId={client.id}
            clientName={client.clientName}
            contactPhone={client.contactPhone}
            contactEmail={client.contactEmail}
          />
        </div>
      )}

      {/* TAB 2: WORKSPACE & ASSETS */}
      {activeTab === "workspace" && (
        <div className="space-y-6">
          {/* Pipeline Failure Banner */}
          {client.status === "failed" && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-start gap-3 text-xs text-rose-800">
              <AlertCircle className="h-5 w-5 text-rose-500 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold">Onboarding Pipeline Failed</p>
                <p className="text-[11px] text-rose-700">
                  The automated asset generation encountered an error. Verify
                  your Google Drive or Notion credentials and click{" "}
                  <strong>Run Pipeline</strong> to retry.
                </p>
              </div>
            </div>
          )}

          {/* Resource Links Editor */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <SlidersHorizontal className="h-4 w-4 text-indigo-600" />{" "}
                  Generated Workspace Connections
                </h3>
                <p className="text-xs text-slate-500">
                  Client Google Drive folder, Notion portal, and Signal group
                  communication.
                </p>
              </div>

              <Button
                onClick={handleRunPipeline}
                disabled={isRunningPipeline}
                className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-300 text-white font-bold text-xs h-8 px-4 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                {isRunningPipeline ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Running
                    Pipeline...
                  </>
                ) : (
                  <>
                    <Play className="h-3.5 w-3.5 fill-white" /> Run Pipeline
                  </>
                )}
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Drive */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-600 flex items-center justify-between">
                  <span>Google Drive Folder</span>
                  {editDrive && (
                    <a
                      href={editDrive}
                      target="_blank"
                      rel="noreferrer"
                      className="text-indigo-600 hover:underline flex items-center gap-0.5 text-[10px]"
                    >
                      Open <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                  )}
                </label>
                <Input
                  value={editDrive}
                  onChange={(e) => setEditDrive(e.target.value)}
                  placeholder="https://drive.google.com/drive/folders/..."
                  className="text-xs h-9"
                />
              </div>

              {/* Notion */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-600 flex items-center justify-between">
                  <span>Notion Dashboard</span>
                  {editNotion && (
                    <a
                      href={editNotion}
                      target="_blank"
                      rel="noreferrer"
                      className="text-indigo-600 hover:underline flex items-center gap-0.5 text-[10px]"
                    >
                      Open <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                  )}
                </label>
                <Input
                  value={editNotion}
                  onChange={(e) => setEditNotion(e.target.value)}
                  placeholder="https://notion.so/..."
                  className="text-xs h-9"
                />
              </div>

              {/* Signal */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-600 flex items-center justify-between">
                  <span>Signal Chat Group</span>
                  {editSignal && (
                    <a
                      href={editSignal}
                      target="_blank"
                      rel="noreferrer"
                      className="text-indigo-600 hover:underline flex items-center gap-0.5 text-[10px]"
                    >
                      Open <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                  )}
                </label>
                <Input
                  value={editSignal}
                  onChange={(e) => setEditSignal(e.target.value)}
                  placeholder="https://signal.group/#..."
                  className="text-xs h-9"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button
                onClick={handleSaveLinks}
                disabled={isSavingLinks}
                className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs h-8 px-4 rounded-lg cursor-pointer"
              >
                {isSavingLinks ? "Saving..." : "Save Workspace Links"}
              </Button>
            </div>
          </div>

          {/* Email Outbox & Live HTML Preview */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Mail className="h-4 w-4 text-indigo-600" /> Onboarding Email
                  Dispatcher
                </h3>
                <p className="text-xs text-slate-500">
                  Preview dynamic welcome email with client workspace links and
                  dispatch directly.
                </p>
              </div>

              <div className="flex items-center gap-2">
                {emailLogs.length > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsHistoryOpen(true)}
                    className="text-xs h-7 px-2.5 font-bold text-slate-700 hover:text-slate-900 border-slate-200 cursor-pointer"
                  >
                    <History className="h-3.5 w-3.5 text-indigo-600 mr-1" />
                    Delivery History ({emailLogs.length})
                  </Button>
                )}

                <button
                  type="button"
                  onClick={() =>
                    setIsEditingEmailTemplate(!isEditingEmailTemplate)
                  }
                  className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 cursor-pointer"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  {isEditingEmailTemplate
                    ? "Hide Editor"
                    : "Customize Subject & Body"}
                </button>
              </div>
            </div>

            {/* Live Email Delivery Status Banner */}
            <div
              className={cn(
                "rounded-xl border p-4 transition-all",
                isEmailSent
                  ? "bg-emerald-50/70 border-emerald-200"
                  : latestEmailLog?.status === "failed"
                    ? "bg-rose-50/70 border-rose-200"
                    : "bg-slate-50 border-slate-200",
              )}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start sm:items-center gap-3">
                  <div
                    className={cn(
                      "h-10 w-10 rounded-xl flex items-center justify-center shrink-0",
                      isEmailSent
                        ? "bg-emerald-600 text-white shadow-sm"
                        : latestEmailLog?.status === "failed"
                          ? "bg-rose-600 text-white shadow-sm"
                          : "bg-slate-200 text-slate-600",
                    )}
                  >
                    {isEmailSent ? (
                      <CheckCircle2 className="h-5 w-5" />
                    ) : latestEmailLog?.status === "failed" ? (
                      <AlertCircle className="h-5 w-5" />
                    ) : (
                      <Mail className="h-5 w-5" />
                    )}
                  </div>
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4
                        className={cn(
                          "text-xs font-bold",
                          isEmailSent
                            ? "text-emerald-950"
                            : latestEmailLog?.status === "failed"
                              ? "text-rose-950"
                              : "text-slate-800",
                        )}
                      >
                        {isEmailSent
                          ? "Welcome Email Sent & Delivered"
                          : latestEmailLog?.status === "failed"
                            ? "Last Delivery Attempt Failed"
                            : "Welcome Email Not Sent Yet"}
                      </h4>
                      {isEmailSent && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 inline-flex items-center gap-1">
                          <Check className="h-3 w-3" /> Delivered (Resend)
                        </span>
                      )}
                      {latestEmailLog?.status === "failed" && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200">
                          Failed
                        </span>
                      )}
                    </div>

                    <div className="text-[11px] text-slate-600 flex items-center gap-2 flex-wrap pt-0.5">
                      {isEmailSent && emailSentDate ? (
                        <span>
                          <strong>Sent At:</strong>{" "}
                          {formatDateTime(emailSentDate)}
                        </span>
                      ) : (
                        <span>
                          <strong>Status:</strong> Ready to dispatch to{" "}
                          {client.contactEmail}
                        </span>
                      )}
                      <span>•</span>
                      <span>
                        <strong>Recipient:</strong> {client.contactEmail}
                      </span>
                      {latestEmailLog?.resendId && (
                        <>
                          <span>•</span>
                          <span className="inline-flex items-center gap-1 font-mono text-[10px] text-slate-500 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                            Resend ID: {latestEmailLog.resendId}
                            <button
                              type="button"
                              onClick={() =>
                                copyToClipboard(
                                  latestEmailLog.resendId,
                                  "Resend ID",
                                )
                              }
                              className="hover:text-slate-800 cursor-pointer ml-0.5"
                              title="Copy Resend ID"
                            >
                              <Copy className="h-3 w-3" />
                            </button>
                          </span>
                        </>
                      )}
                      {latestEmailLog?.error && (
                        <span className="text-rose-600 font-medium">
                          Error: {latestEmailLog.error}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                  {emailLogs.length > 0 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setIsHistoryOpen(true)}
                      className="text-xs h-8 bg-white hover:bg-slate-50 border-slate-200 text-slate-700 flex items-center gap-1.5 font-bold shadow-xs cursor-pointer"
                    >
                      <History className="h-3.5 w-3.5 text-indigo-600" />
                      View Full History ({emailLogs.length})
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Template Editor Drawer */}
            {isEditingEmailTemplate && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Email Subject
                  </label>
                  <Input
                    value={emailSubject}
                    onChange={(e) => setEmailSubject(e.target.value)}
                    className="bg-white text-xs h-9"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Custom Email Template Body (Supports markdown & variables)
                  </label>
                  <textarea
                    value={emailBody}
                    onChange={(e) => setEmailBody(e.target.value)}
                    className="w-full min-h-[140px] text-xs font-mono p-3 bg-white border border-slate-200 rounded-xl outline-none focus:border-indigo-500 leading-relaxed text-slate-700"
                  />
                </div>
              </div>
            )}

            {/* Dynamic Live Preview */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Dynamic Email Preview (Rendered)
                </span>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const compiled = compileOnboardingEmail({
                        primaryContactName: client.primaryContactName,
                        clientName: client.clientName,
                        driveFolderLink: editDrive || "#",
                        notionDashboardLink: editNotion || "#",
                        signalGroupLink: editSignal || "#",
                        googleAdsAccess: client.googleAdsAccess,
                        metaAdsAccess: client.metaAdsAccess,
                        customTemplate: emailBody || undefined,
                      });
                      copyToClipboard(compiled.text, "Email Body");
                    }}
                    className="h-6 text-[10px] font-bold text-slate-600 hover:bg-slate-100"
                  >
                    Copy Text
                  </Button>
                </div>
              </div>

              <div className="border border-slate-200 rounded-xl bg-slate-50 p-4 max-h-80 overflow-y-auto text-xs text-slate-800 space-y-2">
                <div className="border-b border-slate-200 pb-2">
                  <p className="text-[11px] text-slate-500">
                    To: {client.contactEmail}
                  </p>
                  <p className="text-[11px] text-slate-800 font-bold">
                    Subject: {emailSubject}
                  </p>
                </div>
                <div
                  // biome-ignore lint/security/noDangerouslySetInnerHtml: rendering email preview
                  dangerouslySetInnerHTML={{
                    __html: compileOnboardingEmail({
                      primaryContactName: client.primaryContactName,
                      clientName: client.clientName,
                      driveFolderLink: editDrive || "#",
                      notionDashboardLink: editNotion || "#",
                      signalGroupLink: editSignal || "#",
                      googleAdsAccess: client.googleAdsAccess,
                      metaAdsAccess: client.metaAdsAccess,
                      customTemplate: emailBody || undefined,
                    }).html,
                  }}
                  className="bg-white p-4 rounded-lg shadow-sm border border-slate-200"
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-100">
              <div className="flex items-center gap-2">
                {isEmailSent ? (
                  <div className="flex items-center gap-1.5 text-xs text-emerald-800 font-medium bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-200">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                    <span>
                      Welcome email sent on{" "}
                      <strong>{formatDateTime(emailSentDate)}</strong>
                    </span>
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-500 flex items-center gap-1.5">
                    {!editDrive || !editNotion || !editSignal ? (
                      <>
                        <span className="text-amber-500">⚠️</span>
                        <span>
                          Workspace links incomplete (Signal, Drive, or Notion
                          missing)
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block" />
                        <span>
                          Ready for dispatch to{" "}
                          <strong>{client.contactEmail}</strong>
                        </span>
                      </>
                    )}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2">
                {emailLogs.length > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsHistoryOpen(true)}
                    className="text-xs h-9 text-slate-600 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
                  >
                    <History className="h-3.5 w-3.5 mr-1 text-slate-500" />
                    History ({emailLogs.length})
                  </Button>
                )}

                <Button
                  onClick={handleSendEmail}
                  disabled={isSendingEmail}
                  className={cn(
                    "font-bold text-xs h-9 px-5 rounded-lg flex items-center gap-1.5 shadow-sm cursor-pointer transition-colors",
                    isEmailSent
                      ? "bg-slate-800 hover:bg-slate-700 text-white"
                      : "bg-indigo-600 hover:bg-indigo-500 text-white",
                  )}
                >
                  {isSendingEmail ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />{" "}
                      Dispatching...
                    </>
                  ) : isEmailSent ? (
                    <>
                      <RotateCw className="h-4 w-4" /> Resend Welcome Email
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" /> Send Welcome Email
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: AD ACCOUNTS & INTEGRATIONS */}
      {activeTab === "integrations" && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm space-y-5">
            <div className="border-b border-slate-100 pb-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Target className="h-4 w-4 text-indigo-600" /> Linked Ad
                Accounts & Performance Portfolios
              </h3>
              <p className="text-xs text-slate-500">
                Connect this client to one of your agency Google Ads portfolios
                for automated CRO audits, competitor insights, and negative
                keyword harvesting.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Google Ads Linking */}
              <div className="space-y-3 bg-slate-50/60 p-4 rounded-xl border border-slate-200/70">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                      Google
                    </span>
                    Linked Google Ads Account
                  </label>
                  {selectedAdAccountId && (
                    <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" /> Connected
                    </span>
                  )}
                </div>
                <select
                  value={selectedAdAccountId}
                  onChange={(e) => handleAssociateAccount(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:border-indigo-500 cursor-pointer shadow-sm"
                >
                  <option value="">-- No Google Account Linked --</option>
                  {adAccountsList.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} ({acc.googleAccountId})
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-500">
                  Links this client to your Google Ads MCC account for search terms, negatives & briefing audits.
                </p>
              </div>

              {/* Meta Ads Linking */}
              <div className="space-y-3 bg-slate-50/60 p-4 rounded-xl border border-slate-200/70">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                      Meta
                    </span>
                    Linked Meta Ads Account
                  </label>
                  {selectedMetaAdAccountId && (
                    <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" /> Connected
                    </span>
                  )}
                </div>
                <select
                  value={selectedMetaAdAccountId}
                  onChange={(e) => handleAssociateMetaAccount(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:border-indigo-500 cursor-pointer shadow-sm"
                >
                  <option value="">-- No Meta Account Linked --</option>
                  {metaAdAccountsList.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} ({acc.metaAccountId})
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-500">
                  Links this client to your Meta Business account for cross-platform blended reporting.
                </p>
              </div>
            </div>

            {(selectedAdAccountId || selectedMetaAdAccountId) && (
              <div className="pt-4 border-t border-slate-100 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-800">
                    Quick Client Actions & Cross-Platform Portfolios
                  </h4>
                  {selectedAdAccountId && selectedMetaAdAccountId && (
                    <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full text-[10px] font-bold flex items-center gap-1">
                      <Sparkles className="h-3 w-3 text-indigo-500" /> Blended Dual-Platform Active
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Link
                    href={
                      selectedAdAccountId
                        ? `/accounts/${selectedAdAccountId}`
                        : `/overview/industry`
                    }
                    className="p-3 bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 rounded-xl text-xs font-semibold text-slate-700 hover:text-indigo-700 transition-all flex items-center justify-between"
                  >
                    <span>View Performance Dashboard</span>
                    <ExternalLink className="h-3.5 w-3.5 text-slate-400" />
                  </Link>

                  <Link
                    href="/overview/industry"
                    className="p-3 bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 rounded-xl text-xs font-semibold text-slate-700 hover:text-indigo-700 transition-all flex items-center justify-between"
                  >
                    <span>Industry & Peer Benchmarks</span>
                    <Layers className="h-3.5 w-3.5 text-indigo-500" />
                  </Link>

                  {selectedAdAccountId ? (
                    <Link
                      href={`/accounts/${selectedAdAccountId}/negatives`}
                      className="p-3 bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 rounded-xl text-xs font-semibold text-slate-700 hover:text-indigo-700 transition-all flex items-center justify-between"
                    >
                      <span>Negative Keyword Harvester</span>
                      <Zap className="h-3.5 w-3.5 text-amber-500" />
                    </Link>
                  ) : (
                    <Link
                      href={`/lp-analysis`}
                      className="p-3 bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 rounded-xl text-xs font-semibold text-slate-700 hover:text-indigo-700 transition-all flex items-center justify-between"
                    >
                      <span>Run Landing Page CRO Audit</span>
                      <Flame className="h-3.5 w-3.5 text-rose-500" />
                    </Link>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Email Dispatch History Modal */}
      <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
        <DialogContent className="max-w-xl bg-white rounded-2xl shadow-2xl p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-slate-900">
              <Mail className="h-4 w-4 text-indigo-600" />
              Email Dispatch History
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Audit logs of system emails dispatched to{" "}
              <strong>{client.contactEmail}</strong> for{" "}
              <strong>{client.clientName}</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-96 overflow-y-auto divide-y divide-slate-100 pr-1 mt-2">
            {emailLogs.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                No email dispatch logs found for this client yet.
              </div>
            ) : (
              emailLogs.map((log: any) => {
                const isSuccess = log.status === "success";
                return (
                  <div key={log.id} className="py-3.5 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border",
                            isSuccess
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : "bg-rose-50 text-rose-700 border-rose-200",
                          )}
                        >
                          {isSuccess ? (
                            <>
                              <CheckCircle2 className="h-3 w-3 text-emerald-600" />{" "}
                              Delivered
                            </>
                          ) : (
                            <>
                              <AlertCircle className="h-3 w-3 text-rose-600" />{" "}
                              Failed
                            </>
                          )}
                        </span>
                        <span className="text-xs font-semibold text-slate-800">
                          {log.subject}
                        </span>
                      </div>
                      <span className="text-[11px] font-mono text-slate-400 shrink-0">
                        {formatDateTime(log.sentAt)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-500 pl-1">
                      <span>
                        Recipient:{" "}
                        <strong className="text-slate-700">
                          {log.recipient}
                        </strong>
                      </span>
                      {log.resendId && (
                        <div className="flex items-center gap-1 font-mono text-[10px] text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200">
                          <span>ID: {log.resendId}</span>
                          <button
                            type="button"
                            onClick={() =>
                              copyToClipboard(log.resendId, "Resend Message ID")
                            }
                            className="hover:text-slate-800 p-0.5 cursor-pointer"
                            title="Copy Message ID"
                          >
                            <Copy className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                    </div>

                    {log.error && (
                      <div className="bg-rose-50 border border-rose-200 rounded-lg p-2 text-[11px] text-rose-700 mt-1">
                        <strong>Error:</strong> {log.error}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* 5. Edit Client Details Dialog */}
      <Dialog open={isEditClientOpen} onOpenChange={setIsEditClientOpen}>
        <DialogContent className="max-w-md bg-white p-6 rounded-2xl shadow-xl border border-slate-200">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Pencil className="h-4 w-4 text-indigo-600" />
              Edit Client Details
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Update the business name and primary contact details for this
              client.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveClientDetails} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label
                htmlFor="editClientName"
                className="text-xs font-semibold text-slate-700"
              >
                Company / Business Name *
              </Label>
              <Input
                id="editClientName"
                value={editClientName}
                onChange={(e) => setEditClientName(e.target.value)}
                placeholder="e.g. Acme Corporation"
                className="h-9 text-xs"
                required
              />
              <p className="text-[11px] text-slate-400">
                Displayed across headers, reports, and onboarding
                communications.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="editPrimaryContactName"
                className="text-xs font-semibold text-slate-700"
              >
                Primary Contact Name *
              </Label>
              <Input
                id="editPrimaryContactName"
                value={editPrimaryContactName}
                onChange={(e) => setEditPrimaryContactName(e.target.value)}
                placeholder="e.g. John Doe"
                className="h-9 text-xs"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="editContactEmail"
                className="text-xs font-semibold text-slate-700"
              >
                Contact Email *
              </Label>
              <Input
                id="editContactEmail"
                type="email"
                value={editContactEmail}
                onChange={(e) => setEditContactEmail(e.target.value)}
                placeholder="client@example.com"
                className="h-9 text-xs"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="editContactPhone"
                className="text-xs font-semibold text-slate-700"
              >
                Phone Number (Optional)
              </Label>
              <Input
                id="editContactPhone"
                type="tel"
                value={editContactPhone}
                onChange={(e) => setEditContactPhone(e.target.value)}
                placeholder="e.g. +61 400 000 000"
                className="h-9 text-xs"
              />
            </div>

            <DialogFooter className="pt-3 gap-2 flex items-center justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditClientOpen(false)}
                disabled={isSavingClientDetails}
                className="text-xs h-9 cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSavingClientDetails}
                className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs h-9 px-4 font-bold flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                {isSavingClientDetails ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Check className="h-3.5 w-3.5" />
                    Save Changes
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
