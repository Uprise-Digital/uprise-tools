"use client";

import {
  AlertCircle,
  ArrowLeft,
  Building2,
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
  Search,
  Send,
  SlidersHorizontal,
  Sparkles,
  Target,
  Trash2,
  User,
  UserPlus,
  Users,
  X,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { listAccountsAction } from "@/actions/agency.actions";
import {
  assignContactToClientAction,
  associateAdAccountAction,
  associateMetaAdAccountAction,
  createClientGhlSubAccountAction,
  createContactForClientAction,
  deleteClientOnboardingAction,
  finalizeOnboardingAction,
  getClientEmailLogsAction,
  getClientOnboardingByIdAction,
  getOrgContactsAction,
  runOnboardingPipelineAction,
  sendOnboardingEmailAction,
  updateClientOnboardingAction,
} from "@/actions/client-onboarding.actions";
import { getMetaAdAccountsAction } from "@/actions/meta-settings.actions";
import { getOnboardingSettingsAction } from "@/actions/onboarding-settings.actions";
import ClientCallHistory from "@/components/clients/client-call-history";
import { GoogleLogo, MetaLogo } from "@/components/icons/platform-logos";
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
import { Spinner, TopProgressBar } from "@/components/ui/loading";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
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
  const [selectedMetaAdAccountId, setSelectedMetaAdAccountId] =
    useState<string>("");

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
  const [isCreatingGhlSubAccount, setIsCreatingGhlSubAccount] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);

  // Edit Client Details Sidebar States
  const [isEditClientOpen, setIsEditClientOpen] = useState(false);
  const [editClientName, setEditClientName] = useState("");
  const [editPrimaryContactName, setEditPrimaryContactName] = useState("");
  const [editContactEmail, setEditContactEmail] = useState("");
  const [editContactPhone, setEditContactPhone] = useState("");
  const [editGoogleEnabled, setEditGoogleEnabled] = useState(true);
  const [editMetaEnabled, setEditMetaEnabled] = useState(true);
  const [editGhlSubAccountId, setEditGhlSubAccountId] = useState("");
  const [isSavingClientDetails, setIsSavingClientDetails] = useState(false);
  const [selectedContactId, setSelectedContactId] = useState<number | null>(null);
  const [selectedContactName, setSelectedContactName] = useState<string | null>(null);
  const [isContactPickerOpen, setIsContactPickerOpen] = useState(false);
  const [contactSearchQuery, setContactSearchQuery] = useState("");
  const [orgContacts, setOrgContacts] = useState<any[]>([]);
  const [loadingOrgContacts, setLoadingOrgContacts] = useState(false);

  // Dedicated Client Contacts Management Modal
  const [isContactsModalOpen, setIsContactsModalOpen] = useState(false);
  const [contactsModalSearch, setContactsModalSearch] = useState("");
  const [isLinkingContactId, setIsLinkingContactId] = useState<number | null>(null);
  const [activeContactTab, setActiveContactTab] = useState<"list" | "link" | "new">("list");
  const [newContactName, setNewContactName] = useState("");
  const [newContactEmail, setNewContactEmail] = useState("");
  const [newContactPhone, setNewContactPhone] = useState("");
  const [newContactJobTitle, setNewContactJobTitle] = useState("");
  const [newContactIsPrimary, setNewContactIsPrimary] = useState(false);
  const [isCreatingContact, setIsCreatingContact] = useState(false);

  const loadClientDetails = useCallback(async () => {
    try {
      setLoading(true);
      const [clientRes, settingsRes, adAccountsRes, metaAccountsRes] =
        await Promise.all([
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

  const loadOrgContacts = useCallback(async () => {
    setLoadingOrgContacts(true);
    try {
      const res = await getOrgContactsAction();
      if (res.success && res.contacts) {
        setOrgContacts(res.contacts);
      }
    } catch (err) {
      console.error("Failed to load contacts list:", err);
    } finally {
      setLoadingOrgContacts(false);
    }
  }, []);

  const openEditClientModal = () => {
    if (!client) return;
    setEditClientName(client.clientName || "");
    setEditPrimaryContactName(client.primaryContactName || "");
    setEditContactEmail(client.contactEmail || "");
    setEditContactPhone(client.contactPhone || "");
    setEditGoogleEnabled(
      client.googleEnabled ?? client.googleAdsAccess ?? true,
    );
    setEditMetaEnabled(client.metaEnabled ?? client.metaAdsAccess ?? true);
    setEditGhlSubAccountId(client.ghlSubAccountId || "");

    const primaryCt =
      client.contacts?.find((ct: any) => ct.isPrimary) ||
      client.contacts?.[0];
    if (primaryCt) {
      setSelectedContactId(primaryCt.id);
      setSelectedContactName(primaryCt.name);
    } else {
      setSelectedContactId(null);
      setSelectedContactName(null);
    }
    setContactSearchQuery("");
    setIsEditClientOpen(true);
    loadOrgContacts();
  };

  const handleSelectContactFromList = (contact: any) => {
    setSelectedContactId(contact.id);
    setSelectedContactName(contact.name);
    setEditPrimaryContactName(contact.name);
    if (contact.email) setEditContactEmail(contact.email);
    if (contact.phone) setEditContactPhone(contact.phone);
    setIsContactPickerOpen(false);
    toast.success(`Selected "${contact.name}" from contacts list`);
  };

  const handleClearSelectedContact = () => {
    setSelectedContactId(null);
    setSelectedContactName(null);
  };

  const filteredOrgContacts = useMemo(() => {
    if (!contactSearchQuery.trim()) return orgContacts;
    const q = contactSearchQuery.toLowerCase().trim();
    return orgContacts.filter((c: any) => {
      const name = (c.name || "").toLowerCase();
      const email = (c.email || "").toLowerCase();
      const phone = (c.phone || "").toLowerCase();
      const clientName = (c.client?.name || "").toLowerCase();
      return (
        name.includes(q) ||
        email.includes(q) ||
        phone.includes(q) ||
        clientName.includes(q)
      );
    });
  }, [orgContacts, contactSearchQuery]);

  const filteredModalContacts = useMemo(() => {
    if (!contactsModalSearch.trim()) return orgContacts;
    const q = contactsModalSearch.toLowerCase().trim();
    return orgContacts.filter((c: any) => {
      const name = (c.name || "").toLowerCase();
      const email = (c.email || "").toLowerCase();
      const phone = (c.phone || "").toLowerCase();
      const clientName = (c.client?.name || "").toLowerCase();
      return (
        name.includes(q) ||
        email.includes(q) ||
        phone.includes(q) ||
        clientName.includes(q)
      );
    });
  }, [orgContacts, contactsModalSearch]);

  const openContactsModal = () => {
    setIsContactsModalOpen(true);
    setActiveContactTab("list");
    setContactsModalSearch("");
    loadOrgContacts();
  };

  const handleQuickLinkContactToClient = async (
    contactId: number,
    makePrimary = false,
  ) => {
    if (!client) return;
    setIsLinkingContactId(contactId);
    try {
      const res = await assignContactToClientAction(
        contactId,
        client.id,
        makePrimary,
      );
      if (res.success) {
        toast.success(
          makePrimary
            ? "Contact linked as primary contact!"
            : "Contact linked to client!",
        );
        await Promise.all([loadClientDetails(), loadOrgContacts()]);
      } else {
        toast.error(res.error || "Failed to link contact");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to link contact");
    } finally {
      setIsLinkingContactId(null);
    }
  };

  const handleQuickUnlinkContact = async (contactId: number) => {
    if (!client) return;
    setIsLinkingContactId(contactId);
    try {
      const res = await assignContactToClientAction(contactId, null);
      if (res.success) {
        toast.success("Contact unlinked from client");
        await Promise.all([loadClientDetails(), loadOrgContacts()]);
      } else {
        toast.error(res.error || "Failed to unlink contact");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to unlink contact");
    } finally {
      setIsLinkingContactId(null);
    }
  };

  const handleCreateNewContactForClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!client || !newContactName.trim()) {
      toast.error("Contact name is required.");
      return;
    }
    setIsCreatingContact(true);
    try {
      const res = await createContactForClientAction({
        clientId: client.id,
        name: newContactName.trim(),
        email: newContactEmail.trim() || null,
        phone: newContactPhone.trim() || null,
        jobTitle: newContactJobTitle.trim() || null,
        isPrimary: newContactIsPrimary,
      });

      if (res.success) {
        toast.success(`Contact "${newContactName.trim()}" created and linked!`);
        setNewContactName("");
        setNewContactEmail("");
        setNewContactPhone("");
        setNewContactJobTitle("");
        setNewContactIsPrimary(false);
        setActiveContactTab("list");
        await Promise.all([loadClientDetails(), loadOrgContacts()]);
      } else {
        toast.error(res.error || "Failed to create contact");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to create contact");
    } finally {
      setIsCreatingContact(false);
    }
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
        googleEnabled: editGoogleEnabled,
        metaEnabled: editMetaEnabled,
        googleAdsAccess: editGoogleEnabled,
        metaAdsAccess: editMetaEnabled,
        ghlSubAccountId: editGhlSubAccountId.trim() || null,
        contactId: selectedContactId,
      });

      if (res.success) {
        toast.success("Client details updated successfully!");
        await loadClientDetails();
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

  const handleCreateGhlSubAccount = async () => {
    if (!client) return;
    setIsCreatingGhlSubAccount(true);
    try {
      const res = await createClientGhlSubAccountAction(client.id);
      if (res.success) {
        toast.success(
          `GoHighLevel sub-account "${res.name}" created successfully!`,
        );
        await loadClientDetails();
      } else {
        toast.error(res.error || "Failed to create GoHighLevel sub-account.");
      }
    } catch (error: any) {
      toast.error(
        error.message ||
          "An unexpected error occurred while creating GHL sub-account.",
      );
    } finally {
      setIsCreatingGhlSubAccount(false);
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
  const isCompleted =
    client?.status === "completed" || client?.status === "active";
  const isPipelineActive = Boolean(
    isCompleted ||
      client?.status === "active" ||
      (client?.ghlPipelineStage &&
        /active|won|close|client|onboard/i.test(client.ghlPipelineStage)),
  );
  const isEmailSent =
    client?.status === "email_sent" ||
    isCompleted ||
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
          <Spinner size="xl" variant="brand" className="mb-3" />
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
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6 relative">
      <TopProgressBar
        loading={
          isRunningPipeline ||
          isFinalizing ||
          isSendingEmail ||
          isSavingClientDetails
        }
        color="indigo"
      />
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
            onClick={openContactsModal}
            className="bg-white hover:bg-slate-50 text-slate-700 font-medium text-xs h-8 px-3 rounded-lg flex items-center gap-1.5 shadow-xs border-slate-200 cursor-pointer"
            title="Manage and Add Client Contacts"
          >
            <Users className="h-3.5 w-3.5 text-indigo-600" />
            Contacts ({client?.contacts?.length || 0})
          </Button>

          <Button
            variant="outline"
            onClick={openEditClientModal}
            className="bg-white hover:bg-slate-50 text-slate-700 font-medium text-xs h-8 px-3 rounded-lg flex items-center gap-1.5 shadow-xs border-slate-200 cursor-pointer"
            title="Edit Client & Contact Details"
          >
            <Pencil className="h-3.5 w-3.5 text-slate-500" />
            Edit Details
          </Button>

          {!isCompleted && (
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
              {isCompleted ? (
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
            <span
              className={cn(
                "px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition-all",
                (client.googleEnabled ?? client.googleAdsAccess ?? true)
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200 shadow-xs"
                  : "bg-slate-100 text-slate-400 border-slate-200 line-through opacity-70",
              )}
            >
              <GoogleLogo className="h-3.5 w-3.5 shrink-0" />
              <span>
                Google Ads:{" "}
                {(client.googleEnabled ?? client.googleAdsAccess ?? true)
                  ? client.googleAdsStatus === "granted"
                    ? "Active"
                    : "Enabled"
                  : "Disabled"}
              </span>
            </span>

            <span
              className={cn(
                "px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition-all",
                (client.metaEnabled ?? client.metaAdsAccess ?? true)
                  ? "bg-blue-50 text-blue-700 border-blue-200 shadow-xs"
                  : "bg-slate-100 text-slate-400 border-slate-200 line-through opacity-70",
              )}
            >
              <MetaLogo className="h-3.5 w-3.5 shrink-0" />
              <span>
                Meta:{" "}
                {(client.metaEnabled ?? client.metaAdsAccess ?? true)
                  ? client.metaAdsStatus === "granted"
                    ? "Active"
                    : "Enabled"
                  : "Disabled"}
              </span>
            </span>
          </div>
        </div>

        {/* Contact Meta Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
          <div className="bg-slate-50/80 border border-slate-200/60 rounded-xl p-3 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                <User className="h-3 w-3" /> Primary Contact
              </span>
              <button
                type="button"
                onClick={openContactsModal}
                className="text-[10px] text-indigo-600 hover:text-indigo-700 font-bold hover:underline cursor-pointer"
              >
                Manage ({client?.contacts?.length || 0})
              </button>
            </div>
            <p className="text-xs font-bold text-slate-800 truncate">
              {client.primaryContactName || "Not assigned"}
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

              <div className="flex items-center gap-2">
                {!client.ghlSubAccountId && (
                  <Button
                    type="button"
                    onClick={handleCreateGhlSubAccount}
                    disabled={isCreatingGhlSubAccount}
                    className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-300 text-white font-bold text-xs h-8 px-3.5 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    {isCreatingGhlSubAccount ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />{" "}
                        Creating Sub-Account...
                      </>
                    ) : (
                      <>
                        <Building2 className="h-3.5 w-3.5" /> Create GHL
                        Sub-Account
                      </>
                    )}
                  </Button>
                )}

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

          {/* Linked GoHighLevel Sub-Account */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-indigo-600" />
                    Linked GoHighLevel Sub-Account
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                    Pipeline Stage: {client.ghlPipelineStage || "Active"}
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  Client sub-account for CRM synchronization, lead routing, and
                  pipeline automations.
                </p>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={openEditClientModal}
                className="text-xs h-8 px-3 rounded-lg flex items-center gap-1.5 border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer self-start sm:self-auto font-medium"
              >
                <Pencil className="h-3 w-3 text-slate-500" />
                {client.ghlSubAccountId
                  ? "Edit Sub-Account"
                  : "Link Sub-Account"}
              </Button>
            </div>

            {client.ghlError && !client.ghlSubAccountId && (
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-3.5 text-xs text-rose-800 flex items-start gap-2.5">
                <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="flex-1 space-y-0.5">
                  <p className="font-bold text-rose-900">
                    Previous GHL Provisioning Notice
                  </p>
                  <p className="text-rose-700 font-mono text-[11px]">
                    {client.ghlError}
                  </p>
                </div>
              </div>
            )}

            {client.ghlSubAccountId ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                <div className="bg-slate-50/80 border border-slate-200/70 rounded-xl p-4 space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                    <span>Sub-Account / Location ID</span>
                    <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200/70">
                      Connected
                    </span>
                  </span>
                  <div className="flex items-center justify-between">
                    <code className="text-xs font-mono font-bold text-slate-900 bg-white px-2.5 py-1 rounded border border-slate-200/80">
                      {client.ghlSubAccountId}
                    </code>
                    <button
                      type="button"
                      onClick={() =>
                        copyToClipboard(
                          client.ghlSubAccountId,
                          "GHL Sub-Account ID",
                        )
                      }
                      className="p-1 text-slate-400 hover:text-slate-700 rounded hover:bg-white transition-colors cursor-pointer"
                      title="Copy Sub-Account ID"
                    >
                      {copiedField === "GHL Sub-Account ID" ? (
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="bg-slate-50/80 border border-slate-200/70 rounded-xl p-4 space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                    <span>GHL CRM Access</span>
                    {client.ghlContactId && (
                      <span className="text-indigo-600 font-mono text-[10px]">
                        Contact: {client.ghlContactId}
                      </span>
                    )}
                  </span>
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-slate-700">
                      GoHighLevel Location Dashboard
                    </p>
                    <a
                      href={`https://app.gohighlevel.com/location/${client.ghlSubAccountId}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-md transition-colors"
                    >
                      Open Sub-Account
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-slate-50/60 border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 shrink-0">
                    <Building2 className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800">
                      No GoHighLevel sub-account linked yet
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Provision a new sub-account location in GoHighLevel or
                      link an existing Location ID.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleCreateGhlSubAccount}
                    disabled={isCreatingGhlSubAccount}
                    className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white text-xs font-bold h-8 px-3 rounded-lg shrink-0 cursor-pointer shadow-xs flex items-center gap-1.5"
                  >
                    {isCreatingGhlSubAccount ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Creating Sub-Account...
                      </>
                    ) : (
                      <>
                        <Building2 className="h-3.5 w-3.5" />
                        Create GHL Sub-Account
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={openEditClientModal}
                    className="border-slate-300 text-slate-700 hover:bg-white text-xs font-medium h-8 px-3 rounded-lg shrink-0 cursor-pointer"
                  >
                    Link Existing
                  </Button>
                </div>
              </div>
            )}
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
                  Links this client to your Google Ads MCC account for search
                  terms, negatives & briefing audits.
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
                  Links this client to your Meta Business account for
                  cross-platform blended reporting.
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
                      <Sparkles className="h-3 w-3 text-indigo-500" /> Blended
                      Dual-Platform Active
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

      {/* 6. Client Contacts Management Sidebar */}
      <Sheet open={isContactsModalOpen} onOpenChange={setIsContactsModalOpen}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-md md:max-w-lg lg:max-w-xl p-0 flex flex-col justify-between bg-white border-l border-slate-200 shadow-2xl z-50 overflow-hidden gap-0"
        >
          <SheetHeader className="px-6 py-5 sm:px-7 sm:py-6 border-b border-slate-100 bg-slate-50/60 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-xs shrink-0">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <SheetTitle className="text-base sm:text-lg font-bold text-slate-900 leading-snug">
                  Client Contacts
                </SheetTitle>
                <SheetDescription className="text-xs text-slate-500 mt-0.5">
                  Connected contacts &amp; team members for{" "}
                  <strong className="text-slate-700">{client.clientName}</strong>.
                </SheetDescription>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex gap-2 pt-3 border-t border-slate-200/60 mt-4 overflow-x-auto">
              <button
                type="button"
                onClick={() => setActiveContactTab("list")}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer",
                  activeContactTab === "list"
                    ? "bg-white text-indigo-700 shadow-xs border border-slate-200"
                    : "text-slate-500 hover:text-slate-800 hover:bg-slate-100/80",
                )}
              >
                <Users className="h-3.5 w-3.5" />
                Linked Contacts ({client.contacts?.length || 0})
              </button>

              <button
                type="button"
                onClick={() => setActiveContactTab("link")}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer",
                  activeContactTab === "link"
                    ? "bg-white text-indigo-700 shadow-xs border border-slate-200"
                    : "text-slate-500 hover:text-slate-800 hover:bg-slate-100/80",
                )}
              >
                <UserPlus className="h-3.5 w-3.5" />
                Add from Contacts List
              </button>

              <button
                type="button"
                onClick={() => setActiveContactTab("new")}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer",
                  activeContactTab === "new"
                    ? "bg-white text-indigo-700 shadow-xs border border-slate-200"
                    : "text-slate-500 hover:text-slate-800 hover:bg-slate-100/80",
                )}
              >
                <Pencil className="h-3.5 w-3.5" />
                + Create
              </button>
            </div>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-6 py-6 sm:px-7 sm:py-7 space-y-4">
            {/* TAB 1: Currently Linked Contacts */}
            {activeContactTab === "list" && (
              <div className="space-y-4">
                {!client.contacts || client.contacts.length === 0 ? (
                  <div className="space-y-4">
                    <div className="py-10 px-4 text-center space-y-3 bg-slate-50/70 rounded-2xl border border-dashed border-slate-200">
                      <div className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
                        <Users className="h-6 w-6" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-800">
                          No contacts linked yet
                        </p>
                        <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                          Link an existing contact from your agency contacts directory, or create a new contact profile.
                        </p>
                      </div>
                      <div className="pt-2">
                        <Button
                          size="sm"
                          onClick={() => setActiveContactTab("link")}
                          className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold gap-1.5 shadow-xs cursor-pointer"
                        >
                          <UserPlus className="h-3.5 w-3.5" />
                          Choose from Contacts List
                        </Button>
                      </div>
                    </div>

                    {client.primaryContactName && (
                      <div className="bg-amber-50/60 border border-amber-200/70 rounded-xl p-3.5 space-y-2 text-xs">
                        <div className="flex items-center gap-2 text-amber-900 font-bold">
                          <Info className="h-4 w-4 text-amber-600 shrink-0" />
                          <span>Onboarding Profile Details</span>
                        </div>
                        <p className="text-[11px] text-amber-800 leading-relaxed">
                          This client profile lists <strong>{client.primaryContactName}</strong>
                          {client.contactEmail ? ` (${client.contactEmail})` : ""} as the primary contact, but they are not yet in your CRM contacts directory.
                        </p>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={isCreatingContact}
                          onClick={() => {
                            setNewContactName(client.primaryContactName || "");
                            setNewContactEmail(client.contactEmail || "");
                            setNewContactPhone(client.contactPhone || "");
                            setNewContactIsPrimary(true);
                            setActiveContactTab("new");
                          }}
                          className="h-7 text-xs bg-white text-amber-900 border-amber-200 hover:bg-amber-50 font-semibold cursor-pointer gap-1"
                        >
                          <Pencil className="h-3 w-3" />
                          Save as CRM Contact
                        </Button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {client.contacts.map((ct: any) => {
                      const isPrimary = ct.isPrimary;
                      return (
                        <div
                          key={ct.id}
                          className={cn(
                            "p-3.5 rounded-xl border transition-all flex items-center justify-between gap-3 bg-white",
                            isPrimary
                              ? "border-emerald-200 shadow-xs bg-emerald-50/20"
                              : "border-slate-200 hover:border-slate-300",
                          )}
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div
                              className={cn(
                                "w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0",
                                isPrimary
                                  ? "bg-emerald-100 text-emerald-800"
                                  : "bg-slate-100 text-slate-700",
                              )}
                            >
                              {ct.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="space-y-0.5 min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-bold text-slate-900 truncate">
                                  {ct.name}
                                </span>
                                {isPrimary && (
                                  <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                    Primary Contact
                                  </span>
                                )}
                                {ct.jobTitle && (
                                  <span className="text-[10px] text-slate-400 font-medium truncate">
                                    {ct.jobTitle}
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-500 truncate flex items-center gap-3">
                                {ct.email && (
                                  <a
                                    href={`mailto:${ct.email}`}
                                    className="hover:text-indigo-600 truncate flex items-center gap-1"
                                  >
                                    <Mail className="h-3 w-3 text-slate-400" />
                                    {ct.email}
                                  </a>
                                )}
                                {ct.phone && (
                                  <a
                                    href={`tel:${ct.phone}`}
                                    className="hover:text-indigo-600 shrink-0 flex items-center gap-1"
                                  >
                                    <Phone className="h-3 w-3 text-slate-400" />
                                    {ct.phone}
                                  </a>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {!isPrimary && (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={isLinkingContactId === ct.id}
                                onClick={() =>
                                  handleQuickLinkContactToClient(ct.id, true)
                                }
                                className="h-7 text-[11px] font-semibold text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 cursor-pointer"
                              >
                                {isLinkingContactId === ct.id ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  "Make Primary"
                                )}
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={isLinkingContactId === ct.id}
                              onClick={() => handleQuickUnlinkContact(ct.id)}
                              className="h-7 text-[11px] text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                              title="Unlink contact from this client"
                            >
                              Unlink
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: Quick Link from Agency Contacts List */}
            {activeContactTab === "link" && (
              <div className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Search agency contacts by name, email, or phone..."
                    value={contactsModalSearch}
                    onChange={(e) => setContactsModalSearch(e.target.value)}
                    className="pl-9 text-xs h-9 bg-slate-50/80 border-slate-200"
                    autoFocus
                  />
                </div>

                <div className="space-y-2">
                  {loadingOrgContacts ? (
                    <div className="py-12 text-center text-xs text-slate-400">
                      <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2 text-indigo-600" />
                      Loading contacts directory...
                    </div>
                  ) : filteredModalContacts.length === 0 ? (
                    <div className="py-12 text-center text-xs text-slate-400">
                      No contacts found matching &ldquo;{contactsModalSearch}&rdquo;.
                    </div>
                  ) : (
                    filteredModalContacts.map((ct: any) => {
                      const isAlreadyLinked =
                        ct.clientId === client.id ||
                        client.contacts?.some((c: any) => c.id === ct.id);
                      return (
                        <div
                          key={ct.id}
                          className={cn(
                            "p-3 rounded-xl border transition-all flex items-center justify-between gap-3",
                            isAlreadyLinked
                              ? "bg-slate-50/80 border-slate-200 opacity-70"
                              : "bg-white border-slate-200 hover:border-indigo-200 hover:shadow-xs",
                          )}
                        >
                          <div className="space-y-0.5 min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-slate-800 truncate">
                                {ct.name}
                              </span>
                              {ct.jobTitle && (
                                <span className="text-[10px] text-slate-400 truncate">
                                  ({ct.jobTitle})
                                </span>
                              )}
                              {isAlreadyLinked && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-semibold">
                                  Already Linked
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-500 truncate flex items-center gap-2">
                              {ct.email && <span>{ct.email}</span>}
                              {ct.phone && (
                                <span className="text-slate-400">
                                  • {ct.phone}
                                </span>
                              )}
                              {ct.client?.name && !isAlreadyLinked && (
                                <span className="text-[10px] text-amber-700 bg-amber-50 px-1 rounded border border-amber-200/50">
                                  Currently linked to {ct.client.name}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {isAlreadyLinked ? (
                              <span className="text-xs text-slate-400 font-medium">
                                Connected
                              </span>
                            ) : (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={isLinkingContactId === ct.id}
                                  onClick={() =>
                                    handleQuickLinkContactToClient(ct.id, false)
                                  }
                                  className="h-7 text-[11px] font-semibold text-indigo-600 hover:bg-indigo-50 border-indigo-200 cursor-pointer"
                                >
                                  {isLinkingContactId === ct.id ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    "+ Add"
                                  )}
                                </Button>
                                <Button
                                  size="sm"
                                  disabled={isLinkingContactId === ct.id}
                                  onClick={() =>
                                    handleQuickLinkContactToClient(ct.id, true)
                                  }
                                  className="h-7 text-[11px] font-bold bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer"
                                  title="Add and make primary contact"
                                >
                                  + Primary
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* TAB 3: Create New Contact */}
            {activeContactTab === "new" && (
              <form
                onSubmit={handleCreateNewContactForClient}
                className="space-y-4"
              >
                <div className="space-y-1.5">
                  <Label
                    htmlFor="modalNewContactName"
                    className="text-xs font-semibold text-slate-700 flex items-center gap-1"
                  >
                    Contact Full Name <span className="text-rose-500">*</span>
                  </Label>
                  <Input
                    id="modalNewContactName"
                    value={newContactName}
                    onChange={(e) => setNewContactName(e.target.value)}
                    placeholder="e.g. Sarah Jenkins"
                    className="h-9 text-xs"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label
                      htmlFor="modalNewContactEmail"
                      className="text-xs font-semibold text-slate-700"
                    >
                      Email Address
                    </Label>
                    <Input
                      id="modalNewContactEmail"
                      type="email"
                      value={newContactEmail}
                      onChange={(e) => setNewContactEmail(e.target.value)}
                      placeholder="sarah@client.com"
                      className="h-9 text-xs"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label
                      htmlFor="modalNewContactPhone"
                      className="text-xs font-semibold text-slate-700"
                    >
                      Phone Number
                    </Label>
                    <Input
                      id="modalNewContactPhone"
                      type="tel"
                      value={newContactPhone}
                      onChange={(e) => setNewContactPhone(e.target.value)}
                      placeholder="+61 400 000 000"
                      className="h-9 text-xs"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label
                    htmlFor="modalNewContactJobTitle"
                    className="text-xs font-semibold text-slate-700"
                  >
                    Role / Job Title (Optional)
                  </Label>
                  <Input
                    id="modalNewContactJobTitle"
                    value={newContactJobTitle}
                    onChange={(e) => setNewContactJobTitle(e.target.value)}
                    placeholder="e.g. Operations Manager"
                    className="h-9 text-xs"
                  />
                </div>

                <div className="pt-2 flex items-center justify-between border-t border-slate-100">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newContactIsPrimary}
                      onChange={(e) =>
                        setNewContactIsPrimary(e.target.checked)
                      }
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                    />
                    <span className="text-xs font-semibold text-slate-700">
                      Set as Primary Contact
                    </span>
                  </label>

                  <Button
                    type="submit"
                    disabled={isCreatingContact || !newContactName.trim()}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs h-8 px-4 cursor-pointer gap-1.5"
                  >
                    {isCreatingContact ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <UserPlus className="h-3.5 w-3.5" />
                    )}
                    Save Contact
                  </Button>
                </div>
              </form>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* 5. Edit Client Details Sidebar */}
      <Sheet open={isEditClientOpen} onOpenChange={setIsEditClientOpen}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-md md:max-w-lg p-0 flex flex-col justify-between bg-white border-l border-slate-200 shadow-2xl z-50 overflow-hidden gap-0"
        >
          <SheetHeader className="px-6 py-5 sm:px-7 sm:py-6 border-b border-slate-100 bg-slate-50/60 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-xs shrink-0">
                <Pencil className="h-5 w-5" />
              </div>
              <div>
                <SheetTitle className="text-base sm:text-lg font-bold text-slate-900 leading-snug">
                  Edit Client Details
                </SheetTitle>
                <SheetDescription className="text-xs text-slate-500 mt-0.5">
                  Update business profile, primary contact info, and active
                  advertising platforms.
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>

          <form
            id="edit-client-sidebar-form"
            onSubmit={handleSaveClientDetails}
            className="flex-1 overflow-y-auto px-6 py-6 sm:px-7 sm:py-7 space-y-6"
          >
            {/* Section 1: Business Profile & Primary Contact */}
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-slate-400" />
                  Client Profile & Contact
                </h3>
                <span className="text-[10px] text-slate-400 font-medium">
                  Required fields *
                </span>
              </div>

              <div className="space-y-1.5">
                <Label
                  htmlFor="editClientName"
                  className="text-xs font-semibold text-slate-700 flex items-center gap-1"
                >
                  Company / Business Name
                  <span className="text-rose-500">*</span>
                </Label>
                <Input
                  id="editClientName"
                  value={editClientName}
                  onChange={(e) => setEditClientName(e.target.value)}
                  placeholder="e.g. Acme Corporation"
                  className="h-10 text-xs bg-white border-slate-200 focus-visible:ring-indigo-500"
                  required
                />
                <p className="text-[11px] text-slate-400">
                  Displayed across agency dashboards, reports, and
                  communications.
                </p>
              </div>

              {/* Quick Select from Contacts Directory */}
              <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-3 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-indigo-950 flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5 text-indigo-600" />
                    Contacts Directory
                  </span>
                  <Popover
                    open={isContactPickerOpen}
                    onOpenChange={setIsContactPickerOpen}
                  >
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs bg-white text-indigo-600 border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 font-semibold shadow-2xs gap-1.5 cursor-pointer"
                      >
                        <UserPlus className="h-3.5 w-3.5" />
                        Choose from Contacts List
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      side="bottom"
                      align="end"
                      className="w-80 sm:w-96 p-3 z-[70] shadow-2xl border-slate-200 bg-white"
                    >
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
                          <div>
                            <p className="text-xs font-bold text-slate-800">
                              Agency Contacts List
                            </p>
                            <p className="text-[10px] text-slate-400">
                              Select a contact to auto-fill and link
                            </p>
                          </div>
                          <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                            {filteredOrgContacts.length} contacts
                          </span>
                        </div>
                        <div className="relative">
                          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                          <Input
                            placeholder="Search by name, email, phone..."
                            value={contactSearchQuery}
                            onChange={(e) =>
                              setContactSearchQuery(e.target.value)
                            }
                            className="h-8 pl-8 text-xs bg-slate-50 border-slate-200"
                            autoFocus
                          />
                        </div>
                        <div className="max-h-56 overflow-y-auto space-y-1 divide-y divide-slate-50">
                          {loadingOrgContacts ? (
                            <div className="py-6 text-center text-xs text-slate-400">
                              <Loader2 className="h-4 w-4 animate-spin mx-auto mb-1 text-indigo-600" />
                              Loading contacts...
                            </div>
                          ) : filteredOrgContacts.length === 0 ? (
                            <div className="py-6 text-center text-xs text-slate-400">
                              No matching contacts found.
                            </div>
                          ) : (
                            filteredOrgContacts.map((ct: any) => {
                              const isSelected =
                                selectedContactId === ct.id ||
                                (editContactEmail &&
                                  ct.email?.toLowerCase() ===
                                    editContactEmail.toLowerCase());
                              return (
                                <button
                                  key={ct.id}
                                  type="button"
                                  onClick={() =>
                                    handleSelectContactFromList(ct)
                                  }
                                  className={cn(
                                    "w-full text-left p-2 rounded-lg hover:bg-slate-50 transition-colors flex items-start justify-between gap-2 group cursor-pointer",
                                    isSelected &&
                                      "bg-indigo-50/70 border border-indigo-100",
                                  )}
                                >
                                  <div className="space-y-0.5 min-w-0 flex-1">
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-xs font-bold text-slate-800 group-hover:text-indigo-600 truncate">
                                        {ct.name}
                                      </span>
                                      {ct.jobTitle && (
                                        <span className="text-[10px] text-slate-400 truncate">
                                          ({ct.jobTitle})
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-[11px] text-slate-500 truncate flex items-center gap-2">
                                      {ct.email && (
                                        <span className="truncate">
                                          {ct.email}
                                        </span>
                                      )}
                                      {ct.phone && (
                                        <span className="shrink-0 text-slate-400">
                                          • {ct.phone}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="shrink-0 text-right">
                                    {isSelected ? (
                                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 font-bold flex items-center gap-0.5">
                                        <Check className="h-3 w-3" /> Selected
                                      </span>
                                    ) : ct.client?.name ? (
                                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">
                                        {ct.client.name}
                                      </span>
                                    ) : (
                                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 font-medium border border-amber-200/60">
                                        Unassigned
                                      </span>
                                    )}
                                  </div>
                                </button>
                              );
                            })
                          )}
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>

                {selectedContactName ? (
                  <div className="flex items-center justify-between bg-white border border-indigo-200/90 rounded-lg p-2.5 text-xs shadow-2xs">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-[11px] shrink-0">
                        {selectedContactName.charAt(0).toUpperCase()}
                      </div>
                      <div className="truncate">
                        <div className="flex items-center gap-1.5">
                          <p className="font-bold text-slate-800 truncate leading-tight">
                            {selectedContactName}
                          </p>
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200">
                            Linked
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500 truncate leading-tight mt-0.5">
                          {editContactEmail ||
                            editContactPhone ||
                            "Contact details applied"}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleClearSelectedContact}
                      className="text-[11px] text-slate-400 hover:text-rose-600 font-medium shrink-0 ml-2 cursor-pointer"
                      title="Clear contact link"
                    >
                      Clear
                    </button>
                  </div>
                ) : (
                  <p className="text-[11px] text-indigo-900/70 leading-relaxed">
                    Quickly autofill and link a contact from your agency contacts
                    directory, or enter details manually below.
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label
                  htmlFor="editPrimaryContactName"
                  className="text-xs font-semibold text-slate-700 flex items-center gap-1"
                >
                  Primary Contact Name
                  <span className="text-rose-500">*</span>
                </Label>
                <Input
                  id="editPrimaryContactName"
                  value={editPrimaryContactName}
                  onChange={(e) => setEditPrimaryContactName(e.target.value)}
                  placeholder="e.g. John Doe"
                  className="h-10 text-xs bg-white border-slate-200 focus-visible:ring-indigo-500"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label
                  htmlFor="editContactEmail"
                  className="text-xs font-semibold text-slate-700 flex items-center gap-1"
                >
                  Contact Email
                  <span className="text-rose-500">*</span>
                </Label>
                <Input
                  id="editContactEmail"
                  type="email"
                  value={editContactEmail}
                  onChange={(e) => setEditContactEmail(e.target.value)}
                  placeholder="client@example.com"
                  className="h-10 text-xs bg-white border-slate-200 focus-visible:ring-indigo-500"
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
                  className="h-10 text-xs bg-white border-slate-200 focus-visible:ring-indigo-500"
                />
              </div>
            </div>

            {/* Section 2: Advertising Platforms (googleEnabled & metaEnabled) */}
            <div className="space-y-4 pt-1">
              <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <Target className="h-3.5 w-3.5 text-slate-400" />
                  Advertising Platforms
                </h3>
                <span className="text-[10px] text-slate-400 font-medium">
                  Channel activation
                </span>
              </div>

              <div className="space-y-3">
                {/* Google Ads Toggle */}
                <div
                  className={cn(
                    "p-4 rounded-xl border transition-all flex items-center justify-between gap-4",
                    editGoogleEnabled
                      ? "bg-emerald-50/40 border-emerald-200/90 shadow-xs"
                      : "bg-slate-50/70 border-slate-200 opacity-80",
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-white border border-slate-200/80 shadow-xs shrink-0 mt-0.5">
                      <GoogleLogo className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900">
                          Google Ads
                        </span>
                        <span
                          className={cn(
                            "px-1.5 py-0.5 rounded text-[10px] font-semibold",
                            editGoogleEnabled
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-slate-200 text-slate-600",
                          )}
                        >
                          {editGoogleEnabled ? "Enabled" : "Disabled"}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                        Enable Google Ads tracking, reporting dashboards, and
                        MCC account syncing.
                      </p>
                    </div>
                  </div>
                  <Switch
                    id="toggleGoogleEnabled"
                    checked={editGoogleEnabled}
                    onCheckedChange={setEditGoogleEnabled}
                    className="data-[state=checked]:bg-emerald-600 cursor-pointer"
                  />
                </div>

                {/* Meta Ads Toggle */}
                <div
                  className={cn(
                    "p-4 rounded-xl border transition-all flex items-center justify-between gap-4",
                    editMetaEnabled
                      ? "bg-blue-50/40 border-blue-200/90 shadow-xs"
                      : "bg-slate-50/70 border-slate-200 opacity-80",
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-white border border-slate-200/80 shadow-xs shrink-0 mt-0.5">
                      <MetaLogo className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900">
                          Meta Ads
                        </span>
                        <span
                          className={cn(
                            "px-1.5 py-0.5 rounded text-[10px] font-semibold",
                            editMetaEnabled
                              ? "bg-blue-100 text-blue-800"
                              : "bg-slate-200 text-slate-600",
                          )}
                        >
                          {editMetaEnabled ? "Enabled" : "Disabled"}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                        Enable Meta Ads campaigns, Facebook & Instagram
                        portfolio metrics.
                      </p>
                    </div>
                  </div>
                  <Switch
                    id="toggleMetaEnabled"
                    checked={editMetaEnabled}
                    onCheckedChange={setEditMetaEnabled}
                    className="data-[state=checked]:bg-blue-600 cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* Section 3: Linked GoHighLevel Sub-Account (if pipeline stage is active) */}
            {isPipelineActive && (
              <div className="space-y-4 pt-1">
                <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                  <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5 text-slate-400" />
                    Linked GoHighLevel Sub-Account
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Stage: {client.ghlPipelineStage || "Active"}
                  </span>
                </div>

                <div className="p-4 rounded-xl border border-slate-200/90 bg-slate-50/50 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900">
                          GHL Sub-Account / Location ID
                        </span>
                        {editGhlSubAccountId ? (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                            Linked
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-200 text-slate-600">
                            Not Linked
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        GoHighLevel location/sub-account ID for active CRM sync,
                        lead automation, and pipelines.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Input
                      id="editGhlSubAccountId"
                      value={editGhlSubAccountId}
                      onChange={(e) => setEditGhlSubAccountId(e.target.value)}
                      placeholder="e.g. loc_9f81a7b4 or GHL Location ID"
                      className="h-10 text-xs font-mono bg-white border-slate-200 focus-visible:ring-indigo-500"
                    />
                    {client.ghlContactId && (
                      <p className="text-[11px] text-slate-400 font-mono">
                        Associated GHL Contact ID: {client.ghlContactId}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </form>

          <SheetFooter className="px-6 py-4 sm:px-7 sm:py-5 border-t border-slate-100 bg-slate-50/80 shrink-0 flex flex-row items-center justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsEditClientOpen(false)}
              disabled={isSavingClientDetails}
              className="text-xs h-9 px-4 cursor-pointer hover:bg-slate-100 border-slate-200 font-medium"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="edit-client-sidebar-form"
              disabled={isSavingClientDetails}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs h-9 px-4 font-bold flex items-center gap-1.5 cursor-pointer shadow-sm transition-all"
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
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
