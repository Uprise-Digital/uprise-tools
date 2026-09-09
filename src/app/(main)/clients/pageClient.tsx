"use client";

import {
  AlertCircle,
  ArrowRight,
  ArrowUpDown,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  ExternalLink,
  Filter,
  Flame,
  Globe,
  HelpCircle,
  Info,
  Layers,
  Link as LinkIcon,
  Loader2,
  Mail,
  Pencil,
  Phone,
  PhoneCall,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  SlidersHorizontal,
  Sparkles,
  Target,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { listAccountsAction } from "@/actions/agency.actions";
import {
  assignContactToClientAction,
  createClientOnboardingAction,
  deleteClientOnboardingAction,
  getCrmDirectoryDataAction,
  migrateGhlRecordsToClientsAndContactsAction,
  promoteContactToClientAction,
  syncAllGhlClientsAction,
  syncGhlCallNotesAction,
} from "@/actions/client-onboarding.actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export interface ClientEntity {
  id: number;
  name: string;
  legalBusinessName?: string | null;
  industry: string;
  websiteUrl?: string | null;
  status: string;
  driveFolderLink?: string | null;
  notionDashboardLink?: string | null;
  signalGroupLink?: string | null;
  ghlSubAccountId?: string | null;
  contactsCount: number;
  callCount: number;
  lastCallAt?: Date | string | null;
  latestLeadScore?: number | null;
  latestSentiment?: string | null;
  createdAt: Date;
  updatedAt: Date;
  adAccounts?: { id: number; name: string; googleAccountId: string }[];
  metaAdAccounts?: { id: number; name: string; metaAccountId: string }[];
}

export interface ContactEntity {
  id: number;
  clientId?: number | null;
  clientName?: string | null;
  ghlContactId?: string | null;
  ghlOpportunityId?: string | null;
  name: string;
  email?: string | null;
  phone?: string | null;
  pipelineStage?: string | null;
  status: string;
  callCount: number;
  lastCallAt?: Date | string | null;
  latestLeadScore?: number | null;
  latestSentiment?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

type MainViewType = "clients" | "contacts";
type ClientTabType = "all" | "active" | "with_ads" | "onboarding";
type ContactTabType = "all" | "opportunities" | "won" | "unassigned";
type CallFilterType = "all" | "has_calls" | "no_calls" | "hot_leads";
type SortOption =
  | "last_contacted"
  | "call_count"
  | "lead_score"
  | "name_asc"
  | "name_desc"
  | "created_desc"
  | "created_asc"
  | "stage";

export default function ClientsDirectoryClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Active top-level view: Clients vs Contacts & Leads
  const initialView = (searchParams.get("view") === "contacts" ? "contacts" : "clients") as MainViewType;
  const [mainView, setMainView] = useState<MainViewType>(initialView);

  // Data states
  const [clients, setClients] = useState<ClientEntity[]>([]);
  const [contacts, setContacts] = useState<ContactEntity[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [clientTab, setClientTab] = useState<ClientTabType>("all");
  const [contactTab, setContactTab] = useState<ContactTabType>("all");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [callFilter, setCallFilter] = useState<CallFilterType>("all");
  const [sortBy, setSortBy] = useState<SortOption>("last_contacted");

  // Syncing / Migration states
  const [isSyncingGhl, setIsSyncingGhl] = useState(false);
  const [isSyncingNotes, setIsSyncingNotes] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);

  // New Client Modal
  const [isNewClientOpen, setIsNewClientOpen] = useState(false);
  const [formClientName, setFormClientName] = useState("");
  const [formContactName, setFormContactName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formGoogleAds, setFormGoogleAds] = useState(true);
  const [formMetaAds, setFormMetaAds] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // GHL Search Autocomplete for New Client
  const [ghlSearchQuery, setGhlSearchQuery] = useState("");
  const [ghlResults, setGhlResults] = useState<any[]>([]);
  const [loadingGhl, setLoadingGhl] = useState(false);
  const [ghlSearchError, setGhlSearchError] = useState<string | null>(null);
  const [hasSearchedGhl, setHasSearchedGhl] = useState(false);
  const [selectedGhlContact, setSelectedGhlContact] = useState<any | null>(null);

  // Contact Assignment Modal
  const [assigningContact, setAssigningContact] = useState<ContactEntity | null>(null);
  const [selectedParentClientId, setSelectedParentClientId] = useState<string>("");
  const [isAssigning, setIsAssigning] = useState(false);

  // Contact Promote Modal / State
  const [promotingContact, setPromotingContact] = useState<ContactEntity | null>(null);
  const [promoteClientName, setPromoteClientName] = useState("");
  const [isPromoting, setIsPromoting] = useState(false);

  // Load CRM Directory Data (Canonical Clients & Contacts)
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getCrmDirectoryDataAction();
      if (res.success && res.clients && res.contacts) {
        setClients(res.clients as unknown as ClientEntity[]);
        setContacts(res.contacts as unknown as ContactEntity[]);
      } else {
        toast.error(res.error || "Failed to load CRM directory.");
      }
    } catch (error: any) {
      console.error("Error loading CRM directory:", error);
      toast.error("Failed to load CRM directory.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Keep view synchronized with URL searchParams
  useEffect(() => {
    const viewParam = searchParams.get("view");
    if (viewParam === "contacts" && mainView !== "contacts") {
      setMainView("contacts");
    } else if (viewParam === "clients" && mainView !== "clients") {
      setMainView("clients");
    }
  }, [searchParams, mainView]);

  const switchMainView = (view: MainViewType) => {
    setMainView(view);
    const params = new URLSearchParams(window.location.search);
    params.set("view", view);
    router.replace(`/clients?${params.toString()}`);
  };

  // GHL Search Debounce
  useEffect(() => {
    if (!ghlSearchQuery.trim() || ghlSearchQuery.trim().length < 2) {
      setGhlResults([]);
      setGhlSearchError(null);
      setHasSearchedGhl(false);
      return;
    }

    const delayDebounce = setTimeout(async () => {
      setLoadingGhl(true);
      setGhlSearchError(null);
      try {
        const res = await fetch(
          `/api/gohighlevel/search?q=${encodeURIComponent(ghlSearchQuery.trim())}`
        );
        const data = await res.json();
        if (res.ok && data.contacts) {
          setGhlResults(data.contacts);
          setHasSearchedGhl(true);
        } else if (!res.ok || data.error) {
          setGhlSearchError(data.error || "Failed to search GoHighLevel contacts.");
          setGhlResults([]);
          setHasSearchedGhl(true);
        }
      } catch (err) {
        console.error("Failed to search GHL:", err);
        setGhlSearchError("Network error while searching GoHighLevel.");
      } finally {
        setLoadingGhl(false);
      }
    }, 400);

    return () => clearTimeout(delayDebounce);
  }, [ghlSearchQuery]);

  const handleSyncGhlClients = async () => {
    setIsSyncingGhl(true);
    const toastId = toast.loading("Syncing all clients & contacts from GoHighLevel...");
    try {
      const res = await syncAllGhlClientsAction();
      if (res.success) {
        toast.success(
          `GHL Sync Complete! Found ${res.totalFound} contact(s) (${res.totalImported} imported, ${res.totalUpdated} updated)`,
          { id: toastId }
        );
        await loadData();
      } else {
        toast.error(res.error || "Failed to sync clients from GHL", { id: toastId });
      }
    } catch (err: any) {
      toast.error(err.message || "GHL Sync failed", { id: toastId });
    } finally {
      setIsSyncingGhl(false);
    }
  };

  const handleSyncCallNotes = async () => {
    setIsSyncingNotes(true);
    const toastId = toast.loading("Scanning calls and pushing ~100-word summaries into GHL Contact Notes...");
    try {
      const res = await syncGhlCallNotesAction();
      if (res.success) {
        toast.success(
          `GHL Notes Sync Complete! Posted ${res.totalNotesPosted} note(s) into GoHighLevel across ${res.totalProcessed} calls.`,
          { id: toastId }
        );
        await loadData();
      } else {
        toast.error(res.error || "Failed to sync call notes into GHL", { id: toastId });
      }
    } catch (err: any) {
      toast.error(err.message || "Call Notes Sync failed", { id: toastId });
    } finally {
      setIsSyncingNotes(false);
    }
  };

  const handleMigrateGhl = async () => {
    setIsMigrating(true);
    const toastId = toast.loading("Organizing 251 GHL records into canonical Clients and linked Contacts...");
    try {
      const res = await migrateGhlRecordsToClientsAndContactsAction();
      if (res.success) {
        toast.success(
          `Migration Complete! Organized ${res.totalRawRecords} records into ${res.clientsCreated} unique Client(s), ${res.contactsCreated} Contact(s), and linked ${res.accountsLinked} ad account(s).`,
          { id: toastId, duration: 6000 }
        );
        await loadData();
      } else {
        toast.error(res.error || "Migration failed", { id: toastId });
      }
    } catch (err: any) {
      toast.error(err.message || "Migration failed", { id: toastId });
    } finally {
      setIsMigrating(false);
    }
  };

  const handleSelectGhlContact = (contact: any) => {
    setSelectedGhlContact(contact);
    setFormClientName(contact.companyName || `${contact.name}'s Business`);
    setFormContactName(contact.name);
    setFormEmail(contact.email);
    setFormPhone(contact.phone || "");
    setGhlSearchQuery("");
    setGhlResults([]);
    setGhlSearchError(null);
    setHasSearchedGhl(false);
  };

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formClientName || !formContactName || !formEmail) {
      toast.error("Please fill in all required fields.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await createClientOnboardingAction({
        clientName: formClientName,
        primaryContactName: formContactName,
        contactEmail: formEmail,
        googleAdsAccess: formGoogleAds,
        metaAdsAccess: formMetaAds,
        ghlContactId: selectedGhlContact?.id || "",
      });

      if (res.success && res.onboardingId) {
        toast.success("Client added successfully! Automation triggered.");
        setIsNewClientOpen(false);
        setFormClientName("");
        setFormContactName("");
        setFormEmail("");
        setFormPhone("");
        setFormGoogleAds(true);
        setFormMetaAds(true);
        setSelectedGhlContact(null);
        await loadData();
        router.push(`/clients/${res.onboardingId}`);
      } else {
        toast.error(res.error || "Failed to create client.");
      }
    } catch (err: any) {
      console.error("Client Onboarding submit error:", err);
      toast.error(`Error creating client record: ${err.message || String(err)}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteClient = async (clientId: number, clientName: string) => {
    if (!confirm(`Are you sure you want to delete ${clientName}? This will remove associated onboarding records.`)) {
      return;
    }

    try {
      const res = await deleteClientOnboardingAction(clientId);
      if (res.success) {
        toast.success("Client record deleted.");
        loadData();
      } else {
        toast.error(res.error || "Failed to delete client.");
      }
    } catch (err: any) {
      toast.error("Error deleting client.");
    }
  };

  // Assign Contact to Client Handler
  const handleConfirmAssignContact = async () => {
    if (!assigningContact) return;
    setIsAssigning(true);
    try {
      const targetClientId = selectedParentClientId ? parseInt(selectedParentClientId, 10) : null;
      const res = await assignContactToClientAction(assigningContact.id, targetClientId);
      if (res.success) {
        toast.success(
          targetClientId
            ? `Contact "${assigningContact.name}" linked to client!`
            : `Contact "${assigningContact.name}" unlinked.`
        );
        setAssigningContact(null);
        setSelectedParentClientId("");
        await loadData();
      } else {
        toast.error(res.error || "Failed to assign contact to client.");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to assign contact.");
    } finally {
      setIsAssigning(false);
    }
  };

  // Promote Contact to Client Handler
  const handleConfirmPromoteContact = async () => {
    if (!promotingContact || !promoteClientName.trim()) {
      toast.error("Please enter a valid Client Business Name");
      return;
    }
    setIsPromoting(true);
    try {
      const res = await promoteContactToClientAction(promotingContact.id, promoteClientName.trim());
      if (res.success) {
        toast.success(`Promoted "${promoteClientName}" to canonical Client!`);
        setPromotingContact(null);
        setPromoteClientName("");
        await loadData();
      } else {
        toast.error(res.error || "Failed to promote contact.");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to promote contact.");
    } finally {
      setIsPromoting(false);
    }
  };

  // Pipeline stages available for contact filtering
  const availableContactStages = useMemo(() => {
    const stageCounts = new Map<string, number>();
    for (const c of contacts) {
      const s = c.pipelineStage || "Uncategorized";
      stageCounts.set(s, (stageCounts.get(s) || 0) + 1);
    }
    return Array.from(stageCounts.entries()).map(([stage, count]) => ({
      stage,
      count,
    }));
  }, [contacts]);

  // Clients Filter & Sort Logic
  const filteredAndSortedClients = useMemo(() => {
    const result = clients.filter((c) => {
      // Search
      const q = searchTerm.toLowerCase().trim();
      if (q) {
        const matchesName = c.name.toLowerCase().includes(q);
        const matchesLegal = c.legalBusinessName?.toLowerCase().includes(q);
        const matchesIndustry = c.industry?.toLowerCase().includes(q);
        if (!matchesName && !matchesLegal && !matchesIndustry) return false;
      }

      // Tab
      if (clientTab === "active") {
        if (c.status !== "active" && c.status !== "completed") return false;
      } else if (clientTab === "with_ads") {
        const hasGoogle = (c.adAccounts && c.adAccounts.length > 0);
        const hasMeta = (c.metaAdAccounts && c.metaAdAccounts.length > 0);
        if (!hasGoogle && !hasMeta) return false;
      } else if (clientTab === "onboarding") {
        if (c.status !== "draft" && c.status !== "in_progress" && c.status !== "pending") return false;
      }

      // Calls Filter
      if (callFilter === "has_calls") {
        if (!c.callCount || c.callCount === 0) return false;
      } else if (callFilter === "no_calls") {
        if (c.callCount && c.callCount > 0) return false;
      } else if (callFilter === "hot_leads") {
        if (!c.latestLeadScore || c.latestLeadScore < 7) return false;
      }

      return true;
    });

    // Sorting
    result.sort((a, b) => {
      if (sortBy === "last_contacted") {
        const aTime = a.lastCallAt ? new Date(a.lastCallAt).getTime() : new Date(a.createdAt).getTime();
        const bTime = b.lastCallAt ? new Date(b.lastCallAt).getTime() : new Date(b.createdAt).getTime();
        if (a.callCount && !b.callCount) return -1;
        if (!a.callCount && b.callCount) return 1;
        return bTime - aTime;
      }
      if (sortBy === "call_count") return (b.callCount || 0) - (a.callCount || 0);
      if (sortBy === "lead_score") return (b.latestLeadScore || 0) - (a.latestLeadScore || 0);
      if (sortBy === "name_asc") return a.name.localeCompare(b.name);
      if (sortBy === "name_desc") return b.name.localeCompare(a.name);
      if (sortBy === "created_desc") return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (sortBy === "created_asc") return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      return 0;
    });

    return result;
  }, [clients, searchTerm, clientTab, callFilter, sortBy]);

  // Contacts Filter & Sort Logic
  const filteredAndSortedContacts = useMemo(() => {
    const result = contacts.filter((c) => {
      // Search
      const q = searchTerm.toLowerCase().trim();
      if (q) {
        const matchesName = c.name.toLowerCase().includes(q);
        const matchesEmail = c.email?.toLowerCase().includes(q);
        const matchesPhone = c.phone && c.phone.includes(q);
        const matchesStage = c.pipelineStage?.toLowerCase().includes(q);
        const matchesClient = c.clientName?.toLowerCase().includes(q);
        if (!matchesName && !matchesEmail && !matchesPhone && !matchesStage && !matchesClient) {
          return false;
        }
      }

      // Tab
      const stageLower = (c.pipelineStage || "").toLowerCase();
      if (contactTab === "opportunities") {
        const isOpportunity =
          stageLower.includes("meeting") ||
          stageLower.includes("booked") ||
          stageLower.includes("follow up") ||
          stageLower.includes("awaiting") ||
          stageLower.includes("new lead") ||
          stageLower.includes("lead") ||
          stageLower.includes("inquiry");
        if (!isOpportunity) return false;
      } else if (contactTab === "won") {
        const isWon = stageLower.includes("won") || stageLower.includes("active client");
        if (!isWon) return false;
      } else if (contactTab === "unassigned") {
        if (c.clientId) return false;
      }

      // Stage Filter Dropdown
      if (stageFilter !== "all") {
        const cStage = c.pipelineStage || "Uncategorized";
        if (cStage !== stageFilter) return false;
      }

      // Calls Filter
      if (callFilter === "has_calls") {
        if (!c.callCount || c.callCount === 0) return false;
      } else if (callFilter === "no_calls") {
        if (c.callCount && c.callCount > 0) return false;
      } else if (callFilter === "hot_leads") {
        if (!c.latestLeadScore || c.latestLeadScore < 7) return false;
      }

      return true;
    });

    // Sorting
    result.sort((a, b) => {
      if (sortBy === "last_contacted") {
        const aTime = a.lastCallAt ? new Date(a.lastCallAt).getTime() : new Date(a.createdAt).getTime();
        const bTime = b.lastCallAt ? new Date(b.lastCallAt).getTime() : new Date(b.createdAt).getTime();
        if (a.callCount && !b.callCount) return -1;
        if (!a.callCount && b.callCount) return 1;
        return bTime - aTime;
      }
      if (sortBy === "call_count") return (b.callCount || 0) - (a.callCount || 0);
      if (sortBy === "lead_score") return (b.latestLeadScore || 0) - (a.latestLeadScore || 0);
      if (sortBy === "name_asc") return a.name.localeCompare(b.name);
      if (sortBy === "name_desc") return b.name.localeCompare(a.name);
      if (sortBy === "stage") return (a.pipelineStage || "").localeCompare(b.pipelineStage || "");
      if (sortBy === "created_desc") return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (sortBy === "created_asc") return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      return 0;
    });

    return result;
  }, [contacts, searchTerm, contactTab, stageFilter, callFilter, sortBy]);

  // Counts for Metric Cards
  const totalClientsCount = clients.length;
  const totalContactsCount = contacts.length;
  const activeClientsCount = clients.filter((c) => c.status === "active" || c.status === "completed").length;
  const clientsWithAdsCount = clients.filter(
    (c) => (c.adAccounts && c.adAccounts.length > 0) || (c.metaAdAccounts && c.metaAdAccounts.length > 0)
  ).length;
  const unassignedContactsCount = contacts.filter((c) => !c.clientId).length;
  const totalCallsLogged = clients.reduce((acc, c) => acc + (c.callCount || 0), 0) + contacts.reduce((acc, ct) => acc + (ct.callCount || 0), 0);

  const resetFilters = () => {
    setSearchTerm("");
    setClientTab("all");
    setContactTab("all");
    setStageFilter("all");
    setCallFilter("all");
    setSortBy("last_contacted");
  };

  const hasActiveFilters =
    searchTerm !== "" ||
    (mainView === "clients" && clientTab !== "all") ||
    (mainView === "contacts" && (contactTab !== "all" || stageFilter !== "all")) ||
    callFilter !== "all" ||
    sortBy !== "last_contacted";

  // Helper for rendering contextual stage badge
  const renderStageBadge = (stage: string | null | undefined, status?: string) => {
    const s = stage || status || "General";
    const lower = s.toLowerCase();

    if (
      lower.includes("spam") ||
      lower.includes("not a fit") ||
      lower.includes("disqualified") ||
      lower.includes("lost")
    ) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
          <AlertCircle className="h-3 w-3 text-rose-500" /> {s}
        </span>
      );
    }
    if (lower.includes("meeting") || lower.includes("booked")) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
          <Calendar className="h-3 w-3 text-blue-500" /> {s}
        </span>
      );
    }
    if (lower.includes("follow up") || lower.includes("awaiting") || lower.includes("post appt")) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200">
          <Clock className="h-3 w-3 text-purple-500" /> {s}
        </span>
      );
    }
    if (lower.includes("new lead") || lower.includes("inquiry")) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
          <Zap className="h-3 w-3 text-amber-500" /> {s}
        </span>
      );
    }
    if (lower.includes("won") || lower.includes("active client") || lower === "active" || lower === "completed") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <CheckCircle2 className="h-3 w-3 text-emerald-500" /> {stage || "Active"}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
        {s}
      </span>
    );
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* 1. Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Clients & CRM Directory
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Manage canonical client accounts, connected Google/Meta ad accounts, contacts, and AI call recordings.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
          <Button
            onClick={handleSyncCallNotes}
            disabled={isSyncingNotes}
            variant="outline"
            className="border-purple-200 hover:bg-purple-50 text-purple-700 font-bold text-xs h-9 px-3.5 rounded-xl flex items-center gap-1.5 cursor-pointer shadow-sm"
            title="Scan calls, generate summaries, and write notes directly to GHL Contact profiles"
          >
            <PhoneCall className={cn("h-3.5 w-3.5 text-purple-600", isSyncingNotes && "animate-spin")} />
            {isSyncingNotes ? "Syncing Notes..." : "Auto-Sync GHL Call Notes"}
          </Button>

          <Button
            onClick={handleMigrateGhl}
            disabled={isMigrating}
            variant="outline"
            className="border-indigo-200 hover:bg-indigo-50 text-indigo-700 font-bold text-xs h-9 px-3.5 rounded-xl flex items-center gap-1.5 cursor-pointer shadow-sm"
            title="Organize GHL records into canonical Clients and Contacts, automatically linking Google and Meta accounts."
          >
            <Building2 className={cn("h-3.5 w-3.5 text-indigo-600", isMigrating && "animate-spin")} />
            {isMigrating ? "Organizing..." : "Organize CRM (Deduplicate)"}
          </Button>

          <Button
            onClick={handleSyncGhlClients}
            disabled={isSyncingGhl}
            variant="outline"
            className="border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs h-9 px-3.5 rounded-xl flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <RefreshCw className={cn("h-3.5 w-3.5 text-indigo-600", isSyncingGhl && "animate-spin")} />
            {isSyncingGhl ? "Syncing GHL..." : "Sync GHL"}
          </Button>

          <Button
            onClick={() => setIsNewClientOpen(true)}
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs h-9 px-4 rounded-xl flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <UserPlus className="h-4 w-4" />
            Onboard New Client
          </Button>
        </div>
      </div>

      {/* 2. Top-Level Main Segmented Switcher (Clients vs Contacts & Leads) */}
      <div className="flex items-center justify-between border-b border-slate-200/80 pb-3">
        <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-200/70 shadow-inner">
          <button
            type="button"
            onClick={() => switchMainView("clients")}
            className={cn(
              "flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer",
              mainView === "clients"
                ? "bg-white text-indigo-700 shadow-sm border border-indigo-100/50"
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            <Building2 className={cn("h-4 w-4", mainView === "clients" ? "text-indigo-600" : "text-slate-400")} />
            <span>Clients</span>
            <span
              className={cn(
                "px-2 py-0.5 rounded-full text-[10px] font-bold",
                mainView === "clients" ? "bg-indigo-50 text-indigo-700" : "bg-slate-200 text-slate-600"
              )}
            >
              {totalClientsCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => switchMainView("contacts")}
            className={cn(
              "flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer",
              mainView === "contacts"
                ? "bg-white text-indigo-700 shadow-sm border border-indigo-100/50"
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            <Users className={cn("h-4 w-4", mainView === "contacts" ? "text-indigo-600" : "text-slate-400")} />
            <span>Contacts & Leads</span>
            <span
              className={cn(
                "px-2 py-0.5 rounded-full text-[10px] font-bold",
                mainView === "contacts" ? "bg-indigo-50 text-indigo-700" : "bg-slate-200 text-slate-600"
              )}
            >
              {totalContactsCount}
            </span>
          </button>
        </div>

        {mainView === "contacts" && unassignedContactsCount > 0 && (
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold">
            <Info className="h-3.5 w-3.5 text-amber-600" />
            <span>{unassignedContactsCount} contact(s) not yet linked to a client business.</span>
          </div>
        )}
      </div>

      {/* 3. Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-white border-slate-200/80 shadow-sm rounded-2xl">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                {mainView === "clients" ? "Total Clients" : "Total Contacts"}
              </p>
              <h3 className="text-2xl font-black text-slate-900 mt-0.5">
                {mainView === "clients" ? totalClientsCount : totalContactsCount}
              </h3>
            </div>
            <div className="h-10 w-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400">
              {mainView === "clients" ? <Building2 className="h-5 w-5" /> : <Users className="h-5 w-5" />}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200/80 shadow-sm rounded-2xl">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                {mainView === "clients" ? "Active Clients" : "Won / Active Contacts"}
              </p>
              <h3 className="text-2xl font-black text-emerald-600 mt-0.5">
                {mainView === "clients"
                  ? activeClientsCount
                  : contacts.filter((c) => (c.pipelineStage || "").toLowerCase().includes("won")).length}
              </h3>
            </div>
            <div className="h-10 w-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-500">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200/80 shadow-sm rounded-2xl">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                {mainView === "clients" ? "With Ad Accounts" : "Unassigned Contacts"}
              </p>
              <h3 className="text-2xl font-black text-indigo-600 mt-0.5">
                {mainView === "clients" ? clientsWithAdsCount : unassignedContactsCount}
              </h3>
            </div>
            <div className="h-10 w-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-500">
              <Target className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200/80 shadow-sm rounded-2xl">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Total Calls Tracked
              </p>
              <h3 className="text-2xl font-black text-purple-600 mt-0.5">
                {totalCallsLogged}
              </h3>
            </div>
            <div className="h-10 w-10 bg-purple-50 rounded-xl flex items-center justify-center text-purple-500">
              <PhoneCall className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 4. Main Directory Table Card */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden space-y-3">
        {/* Sub-Tabs Row */}
        <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50/50">
          {mainView === "clients" ? (
            <div className="flex bg-slate-200/70 p-1 rounded-xl w-fit flex-wrap gap-1">
              <button
                type="button"
                onClick={() => setClientTab("all")}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                  clientTab === "all" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
                )}
              >
                All Clients ({totalClientsCount})
              </button>
              <button
                type="button"
                onClick={() => setClientTab("active")}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                  clientTab === "active" ? "bg-white text-emerald-700 shadow-sm" : "text-slate-600 hover:text-slate-900"
                )}
              >
                Active ({activeClientsCount})
              </button>
              <button
                type="button"
                onClick={() => setClientTab("with_ads")}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                  clientTab === "with_ads" ? "bg-white text-indigo-700 shadow-sm" : "text-slate-600 hover:text-slate-900"
                )}
              >
                With Ad Accounts ({clientsWithAdsCount})
              </button>
              <button
                type="button"
                onClick={() => setClientTab("onboarding")}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                  clientTab === "onboarding" ? "bg-white text-amber-700 shadow-sm" : "text-slate-600 hover:text-slate-900"
                )}
              >
                Onboarding Queue
              </button>
            </div>
          ) : (
            <div className="flex bg-slate-200/70 p-1 rounded-xl w-fit flex-wrap gap-1">
              <button
                type="button"
                onClick={() => setContactTab("all")}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                  contactTab === "all" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
                )}
              >
                All Contacts ({totalContactsCount})
              </button>
              <button
                type="button"
                onClick={() => setContactTab("opportunities")}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                  contactTab === "opportunities" ? "bg-white text-indigo-700 shadow-sm" : "text-slate-600 hover:text-slate-900"
                )}
              >
                Leads & Opportunities
              </button>
              <button
                type="button"
                onClick={() => setContactTab("won")}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                  contactTab === "won" ? "bg-white text-emerald-700 shadow-sm" : "text-slate-600 hover:text-slate-900"
                )}
              >
                Closed Won / Active
              </button>
              <button
                type="button"
                onClick={() => setContactTab("unassigned")}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                  contactTab === "unassigned" ? "bg-white text-amber-700 shadow-sm" : "text-slate-600 hover:text-slate-900"
                )}
              >
                Unassigned ({unassignedContactsCount})
              </button>
            </div>
          )}

          {/* Call Presence Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1">
              Calls:
            </span>
            <button
              type="button"
              onClick={() => setCallFilter("all")}
              className={cn(
                "px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer border transition-colors",
                callFilter === "all"
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              )}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setCallFilter("has_calls")}
              className={cn(
                "px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer border transition-colors flex items-center gap-1",
                callFilter === "has_calls"
                  ? "bg-purple-600 text-white border-purple-600"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              )}
            >
              <PhoneCall className="h-3 w-3" /> With Calls
            </button>
            <button
              type="button"
              onClick={() => setCallFilter("hot_leads")}
              className={cn(
                "px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer border transition-colors flex items-center gap-1",
                callFilter === "hot_leads"
                  ? "bg-rose-600 text-white border-rose-600"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              )}
            >
              <Flame className="h-3 w-3 text-amber-300" /> Hot Leads (7+)
            </button>
          </div>
        </div>

        {/* Search, Filter & Sort Controls */}
        <div className="px-4 py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative w-full sm:w-72">
            <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={mainView === "clients" ? "Search clients, industry..." : "Search contacts, email, phone, stage..."}
              className="pl-9 text-xs h-9 bg-slate-50 border-slate-200 rounded-xl"
            />
          </div>

          <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
            {mainView === "contacts" && (
              <div className="flex items-center gap-1.5">
                <Filter className="h-3.5 w-3.5 text-slate-400" />
                <select
                  value={stageFilter}
                  onChange={(e) => setStageFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-700 font-medium outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <option value="all">All Stages ({contacts.length})</option>
                  {availableContactStages.map(({ stage, count }) => (
                    <option key={stage} value={stage}>
                      {stage} ({count})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Sort Selector */}
            <div className="flex items-center gap-1.5">
              <ArrowUpDown className="h-3.5 w-3.5 text-slate-400" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-700 font-medium outline-none focus:border-indigo-500 cursor-pointer"
              >
                <option value="last_contacted">Sort by: Last Call / Contact</option>
                <option value="call_count">Sort by: Call Count</option>
                <option value="lead_score">Sort by: Highest Lead Score</option>
                <option value="created_desc">Sort by: Added (Newest)</option>
                <option value="created_asc">Sort by: Added (Oldest)</option>
                <option value="name_asc">Sort by: Name (A → Z)</option>
                <option value="name_desc">Sort by: Name (Z → A)</option>
                {mainView === "contacts" && <option value="stage">Sort by: Pipeline Stage</option>}
              </select>
            </div>

            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={resetFilters}
                className="text-xs h-8 text-slate-400 hover:text-slate-700 flex items-center gap-1 px-2"
              >
                <RotateCcw className="h-3 w-3" /> Reset
              </Button>
            )}
          </div>
        </div>

        {/* 5. Table Rendering */}
        <div className="overflow-x-auto">
          {mainView === "clients" ? (
            /* CLIENTS TABLE */
            <Table>
              <TableHeader className="bg-slate-50/50">
                <TableRow className="border-slate-100">
                  <TableHead className="text-[11px] font-bold text-slate-500 uppercase tracking-wider py-3">
                    Client / Business
                  </TableHead>
                  <TableHead className="text-[11px] font-bold text-slate-500 uppercase tracking-wider py-3">
                    Industry & Details
                  </TableHead>
                  <TableHead className="text-[11px] font-bold text-slate-500 uppercase tracking-wider py-3">
                    Connected Ads
                  </TableHead>
                  <TableHead className="text-[11px] font-bold text-slate-500 uppercase tracking-wider py-3">
                    Contacts
                  </TableHead>
                  <TableHead className="text-[11px] font-bold text-slate-500 uppercase tracking-wider py-3">
                    Call History
                  </TableHead>
                  <TableHead className="text-[11px] font-bold text-slate-500 uppercase tracking-wider py-3 text-right">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-slate-400 text-sm">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-indigo-500 mb-2" />
                      Loading canonical client accounts...
                    </TableCell>
                  </TableRow>
                ) : filteredAndSortedClients.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-slate-400 text-sm space-y-2">
                      <p className="font-semibold text-slate-700">No clients found matching the selected filters.</p>
                      {hasActiveFilters && (
                        <Button variant="outline" size="sm" onClick={resetFilters} className="text-xs text-indigo-600 hover:bg-indigo-50 border-indigo-200">
                          Clear Filters
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAndSortedClients.map((client) => (
                    <TableRow
                      key={client.id}
                      className="border-slate-100 hover:bg-slate-50/80 transition-colors cursor-pointer"
                      onClick={() => router.push(`/clients/${client.id}`)}
                    >
                      {/* Client / Business */}
                      <TableCell className="font-bold text-slate-900 py-3 text-sm">
                        <div className="space-y-0.5">
                          <span className="hover:text-indigo-600 transition-colors font-bold text-slate-900">
                            {client.name}
                          </span>
                          {client.legalBusinessName && client.legalBusinessName !== client.name && (
                            <span className="block text-[11px] font-normal text-slate-400">
                              {client.legalBusinessName}
                            </span>
                          )}
                        </div>
                      </TableCell>

                      {/* Industry & Details */}
                      <TableCell className="py-3 text-sm">
                        <div className="space-y-0.5">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                            {client.industry || "OTHER"}
                          </span>
                          {client.websiteUrl && (
                            <a
                              href={client.websiteUrl}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="block text-[11px] text-indigo-600 hover:underline truncate max-w-[160px]"
                            >
                              {client.websiteUrl.replace(/^https?:\/\//, "")}
                            </a>
                          )}
                        </div>
                      </TableCell>

                      {/* Connected Ad Accounts */}
                      <TableCell className="py-3">
                        <div className="flex flex-col gap-1">
                          {client.adAccounts && client.adAccounts.length > 0 ? (
                            client.adAccounts.map((acc) => (
                              <span
                                key={acc.id}
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200"
                                title={`Google: ${acc.name} (${acc.googleAccountId})`}
                              >
                                <span className="font-mono text-[9px] font-bold text-blue-800">G</span>
                                <span className="truncate max-w-[120px]">{acc.name}</span>
                              </span>
                            ))
                          ) : null}

                          {client.metaAdAccounts && client.metaAdAccounts.length > 0 ? (
                            client.metaAdAccounts.map((acc) => (
                              <span
                                key={acc.id}
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200"
                                title={`Meta: ${acc.name} (${acc.metaAccountId})`}
                              >
                                <span className="font-mono text-[9px] font-bold text-purple-800">M</span>
                                <span className="truncate max-w-[120px]">{acc.name}</span>
                              </span>
                            ))
                          ) : null}

                          {!client.adAccounts?.length && !client.metaAdAccounts?.length && (
                            <span className="text-[11px] text-slate-400">No ad accounts</span>
                          )}
                        </div>
                      </TableCell>

                      {/* Contacts Count */}
                      <TableCell className="py-3 text-sm">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
                          <Users className="h-3 w-3 text-slate-500" />
                          {client.contactsCount || 0} contact{(client.contactsCount || 0) === 1 ? "" : "s"}
                        </span>
                      </TableCell>

                      {/* Call History */}
                      <TableCell className="py-3">
                        {client.callCount && client.callCount > 0 ? (
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200 flex items-center gap-1">
                                <PhoneCall className="h-2.5 w-2.5 text-purple-600" />
                                {client.callCount} call{client.callCount > 1 ? "" : ""}
                              </span>
                              {client.latestLeadScore !== null && client.latestLeadScore !== undefined && (
                                <span
                                  className={cn(
                                    "px-1.5 py-0.5 rounded text-[10px] font-bold",
                                    client.latestLeadScore >= 8
                                      ? "bg-rose-50 text-rose-700 border border-rose-200"
                                      : client.latestLeadScore >= 5
                                        ? "bg-amber-50 text-amber-700 border border-amber-200"
                                        : "bg-slate-50 text-slate-600 border border-slate-200"
                                  )}
                                >
                                  Score: {client.latestLeadScore}/10
                                </span>
                              )}
                            </div>
                            {client.lastCallAt && (
                              <p className="text-[10px] text-slate-400">
                                Last: {new Date(client.lastCallAt).toLocaleDateString()}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400">No calls logged</span>
                        )}
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="py-3 text-right">
                        <div className="flex justify-end items-center gap-1.5">
                          <Button
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/clients/${client.id}?tab=calls`);
                            }}
                            className="text-xs h-8 hover:bg-purple-50 hover:text-purple-600 text-slate-600 rounded-lg cursor-pointer flex items-center gap-1 font-semibold"
                            title="View Call History & AI Transcripts"
                          >
                            <PhoneCall className="h-3.5 w-3.5 text-purple-500" />
                            Calls
                          </Button>

                          <Button
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/clients/${client.id}`);
                            }}
                            className="text-xs h-8 hover:bg-slate-100 text-slate-600 rounded-lg cursor-pointer font-semibold"
                          >
                            Workspace
                          </Button>

                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteClient(client.id, client.name);
                            }}
                            className="h-8 w-8 hover:bg-rose-50 hover:text-rose-600 text-slate-400 rounded-lg cursor-pointer"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          ) : (
            /* CONTACTS TABLE */
            <Table>
              <TableHeader className="bg-slate-50/50">
                <TableRow className="border-slate-100">
                  <TableHead className="text-[11px] font-bold text-slate-500 uppercase tracking-wider py-3">
                    Contact Person
                  </TableHead>
                  <TableHead className="text-[11px] font-bold text-slate-500 uppercase tracking-wider py-3">
                    Parent Client Business
                  </TableHead>
                  <TableHead className="text-[11px] font-bold text-slate-500 uppercase tracking-wider py-3">
                    Pipeline Stage
                  </TableHead>
                  <TableHead className="text-[11px] font-bold text-slate-500 uppercase tracking-wider py-3">
                    Call Logs & Lead Score
                  </TableHead>
                  <TableHead className="text-[11px] font-bold text-slate-500 uppercase tracking-wider py-3 text-right">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-12 text-slate-400 text-sm">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-indigo-500 mb-2" />
                      Loading contacts and leads...
                    </TableCell>
                  </TableRow>
                ) : filteredAndSortedContacts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-12 text-slate-400 text-sm space-y-2">
                      <p className="font-semibold text-slate-700">No contacts found matching the selected filters.</p>
                      {hasActiveFilters && (
                        <Button variant="outline" size="sm" onClick={resetFilters} className="text-xs text-indigo-600 hover:bg-indigo-50 border-indigo-200">
                          Clear Filters
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAndSortedContacts.map((contact) => (
                    <TableRow key={contact.id} className="border-slate-100 hover:bg-slate-50/80 transition-colors">
                      {/* Contact Info */}
                      <TableCell className="py-3 text-sm">
                        <div>
                          <p className="font-bold text-slate-900">{contact.name}</p>
                          <p className="text-xs text-slate-500">
                            {contact.email}
                            {contact.phone && ` • ${contact.phone}`}
                          </p>
                          {contact.ghlContactId && (
                            <span className="inline-block text-[10px] text-indigo-600 font-mono mt-0.5">
                              GHL ID: {contact.ghlContactId.slice(0, 10)}...
                            </span>
                          )}
                        </div>
                      </TableCell>

                      {/* Parent Client Business */}
                      <TableCell className="py-3 text-sm">
                        {contact.clientId && contact.clientName ? (
                          <Link
                            href={`/clients/${contact.clientId}`}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 transition-colors"
                          >
                            <Building2 className="h-3.5 w-3.5 text-indigo-600" />
                            <span>{contact.clientName}</span>
                            <ExternalLink className="h-3 w-3 opacity-60" />
                          </Link>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                            Unassigned
                          </span>
                        )}
                      </TableCell>

                      {/* Pipeline Stage */}
                      <TableCell className="py-3">
                        <div>{renderStageBadge(contact.pipelineStage, contact.status)}</div>
                      </TableCell>

                      {/* Call History & Score */}
                      <TableCell className="py-3">
                        {contact.callCount && contact.callCount > 0 ? (
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200 flex items-center gap-1">
                                <PhoneCall className="h-2.5 w-2.5 text-purple-600" />
                                {contact.callCount} call{contact.callCount > 1 ? "s" : ""}
                              </span>
                              {contact.latestLeadScore !== null && contact.latestLeadScore !== undefined && (
                                <span
                                  className={cn(
                                    "px-1.5 py-0.5 rounded text-[10px] font-bold",
                                    contact.latestLeadScore >= 8
                                      ? "bg-rose-50 text-rose-700 border border-rose-200"
                                      : contact.latestLeadScore >= 5
                                        ? "bg-amber-50 text-amber-700 border border-amber-200"
                                        : "bg-slate-50 text-slate-600 border border-slate-200"
                                  )}
                                >
                                  Score: {contact.latestLeadScore}/10
                                </span>
                              )}
                            </div>
                            {contact.lastCallAt && (
                              <p className="text-[10px] text-slate-400">
                                Last: {new Date(contact.lastCallAt).toLocaleDateString()}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400">No calls logged</span>
                        )}
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="py-3 text-right">
                        <div className="flex justify-end items-center gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setAssigningContact(contact);
                              setSelectedParentClientId(contact.clientId ? String(contact.clientId) : "");
                            }}
                            className="text-xs h-7 text-indigo-700 hover:bg-indigo-50 border-indigo-200 font-semibold cursor-pointer"
                          >
                            <LinkIcon className="h-3 w-3 mr-1" />
                            {contact.clientId ? "Change Client" : "Assign Client"}
                          </Button>

                          {!contact.clientId && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setPromotingContact(contact);
                                setPromoteClientName(`${contact.name}'s Business`);
                              }}
                              className="text-xs h-7 text-emerald-700 hover:bg-emerald-50 border-emerald-200 font-semibold cursor-pointer"
                            >
                              <Plus className="h-3 w-3 mr-1" />
                              Promote to Client
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      {/* 6. Assign Contact to Client Modal */}
      {assigningContact && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md p-6 space-y-5 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex justify-between items-start border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-base font-bold text-slate-900">Assign Contact to Client</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Link <strong>{assigningContact.name}</strong> to a canonical client business entity.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAssigningContact(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">Select Client Entity</label>
                <select
                  value={selectedParentClientId}
                  onChange={(e) => setSelectedParentClientId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-medium outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <option value="">-- None (Unassigned) --</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.legalBusinessName ? `(${c.legalBusinessName})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setAssigningContact(null)}
                  className="text-xs text-slate-500 hover:text-slate-800"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleConfirmAssignContact}
                  disabled={isAssigning}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-4"
                >
                  {isAssigning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save Link"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 7. Promote Contact to Client Modal */}
      {promotingContact && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md p-6 space-y-5 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex justify-between items-start border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-base font-bold text-slate-900">Promote Contact to Client</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Create a new canonical client business for <strong>{promotingContact.name}</strong>.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPromotingContact(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  Client / Business Name <span className="text-rose-500">*</span>
                </label>
                <Input
                  value={promoteClientName}
                  onChange={(e) => setPromoteClientName(e.target.value)}
                  placeholder="e.g. Acme Solar Solutions"
                  className="text-xs h-9"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setPromotingContact(null)}
                  className="text-xs text-slate-500 hover:text-slate-800"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleConfirmPromoteContact}
                  disabled={isPromoting}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-4"
                >
                  {isPromoting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Create & Link Client"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 8. Onboard New Client Modal */}
      {isNewClientOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg p-6 space-y-6 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex justify-between items-start border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Onboard New Client</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Link an existing GoHighLevel contact or create a manual entry.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsNewClientOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateClient} className="space-y-4">
              {/* GoHighLevel Contact Search Autocomplete */}
              <div className="space-y-1.5 relative">
                <label className="block text-xs font-bold text-slate-700">
                  Search from GoHighLevel Contact (Optional)
                </label>
                <div className="relative">
                  <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={ghlSearchQuery}
                    onChange={(e) => setGhlSearchQuery(e.target.value)}
                    placeholder="Type name, company, or email to search GHL..."
                    className="pl-9 text-xs h-9 bg-slate-50"
                  />
                  {loadingGhl && (
                    <Loader2 className="h-3.5 w-3.5 animate-spin absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  )}
                </div>

                {/* Dropdown list */}
                {ghlResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 z-10 bg-white border border-slate-200 rounded-xl shadow-lg mt-1 max-h-48 overflow-y-auto divide-y divide-slate-100">
                    {ghlResults.map((c) => (
                      <div
                        key={c.id}
                        onClick={() => handleSelectGhlContact(c)}
                        className="p-2.5 hover:bg-indigo-50 cursor-pointer text-xs transition-colors"
                      >
                        <p className="font-bold text-slate-800">{c.companyName || c.name}</p>
                        <p className="text-[11px] text-slate-500">
                          {c.name} {c.email ? `(${c.email})` : c.phone ? `(${c.phone})` : ""}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {hasSearchedGhl && !loadingGhl && ghlResults.length === 0 && !ghlSearchError && (
                  <div className="absolute top-full left-0 right-0 z-10 bg-white border border-slate-200 rounded-xl shadow-lg mt-1 p-3 text-center text-xs text-slate-500">
                    No matching GoHighLevel contacts found.
                  </div>
                )}

                {ghlSearchError && (
                  <p className="text-[11px] text-rose-500 mt-1">{ghlSearchError}</p>
                )}

                {selectedGhlContact && (
                  <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-2 flex items-center justify-between text-xs text-indigo-700 mt-2">
                    <span>
                      Linked to GHL Contact: <strong>{selectedGhlContact.name}</strong>
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedGhlContact(null)}
                      className="text-indigo-400 hover:text-indigo-700 cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>

              {/* Client Business Name */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  Client / Business Name <span className="text-rose-500">*</span>
                </label>
                <Input
                  value={formClientName}
                  onChange={(e) => setFormClientName(e.target.value)}
                  placeholder="e.g. Acme Solar Solutions"
                  required
                  className="text-xs h-9"
                />
              </div>

              {/* Primary Contact Person */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  Primary Contact Person <span className="text-rose-500">*</span>
                </label>
                <Input
                  value={formContactName}
                  onChange={(e) => setFormContactName(e.target.value)}
                  placeholder="e.g. John Doe"
                  required
                  className="text-xs h-9"
                />
              </div>

              {/* Contact Email */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  Contact Email <span className="text-rose-500">*</span>
                </label>
                <Input
                  type="email"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="john@acmesolar.com.au"
                  required
                  className="text-xs h-9"
                />
              </div>

              {/* Contact Phone */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">Contact Phone</label>
                <Input
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  placeholder="+61 400 000 000"
                  className="text-xs h-9"
                />
              </div>

              {/* Access Flags */}
              <div className="pt-2 border-t border-slate-100 flex gap-4">
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formGoogleAds}
                    onChange={(e) => setFormGoogleAds(e.target.checked)}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                  Request Google Ads Access
                </label>
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formMetaAds}
                    onChange={(e) => setFormMetaAds(e.target.checked)}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                  Request Meta Ads Access
                </label>
              </div>

              {/* Form Buttons */}
              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setIsNewClientOpen(false)}
                  className="text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-4 cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Adding...
                    </>
                  ) : (
                    "Create Client & Launch Dashboard"
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
