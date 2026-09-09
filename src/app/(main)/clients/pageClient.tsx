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
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  createClientOnboardingAction,
  deleteClientAction,
  getCrmDirectoryDataAction,
  migrateGhlRecordsToClientsAndContactsAction,
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

type ClientTabType = "all" | "active" | "with_ads" | "onboarding";
type CallFilterType = "all" | "has_calls" | "no_calls" | "hot_leads";
type SortOption =
  | "last_contacted"
  | "call_count"
  | "lead_score"
  | "name_asc"
  | "name_desc"
  | "created_desc"
  | "created_asc";

export default function ClientsDirectoryClient() {
  const router = useRouter();

  // Data states
  const [clients, setClients] = useState<ClientEntity[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [clientTab, setClientTab] = useState<ClientTabType>("all");
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

  // Load CRM Directory Data (Canonical Clients)
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getCrmDirectoryDataAction();
      if (res.success && res.clients) {
        setClients(res.clients as unknown as ClientEntity[]);
      } else {
        toast.error(res.error || "Failed to load client directory.");
      }
    } catch (error: any) {
      console.error("Error loading client directory:", error);
      toast.error("Failed to load client directory.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

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
    const toastId = toast.loading("Organizing records into canonical Clients and linked Contacts...");
    try {
      const res = await migrateGhlRecordsToClientsAndContactsAction();
      if (res.success) {
        toast.success(
          `CRM Clean Complete! Organized into ${res.clientsCreated} unique Client(s), ${res.contactsCreated} Contact(s), and linked ${res.accountsLinked} ad account(s).`,
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
    if (!confirm(`Are you sure you want to delete ${clientName}? This will unlink any connected ad accounts and contacts.`)) {
      return;
    }

    try {
      const res = await deleteClientAction(clientId);
      if (res.success) {
        toast.success(`Client "${clientName}" deleted.`);
        loadData();
      } else {
        toast.error(res.error || "Failed to delete client.");
      }
    } catch (err: any) {
      toast.error("Error deleting client.");
    }
  };

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

  // Counts for Metric Cards
  const totalClientsCount = clients.length;
  const activeClientsCount = clients.filter((c) => c.status === "active" || c.status === "completed").length;
  const clientsWithAdsCount = clients.filter(
    (c) => (c.adAccounts && c.adAccounts.length > 0) || (c.metaAdAccounts && c.metaAdAccounts.length > 0)
  ).length;
  const onboardingClientsCount = clients.filter(
    (c) => c.status === "draft" || c.status === "in_progress" || c.status === "pending"
  ).length;
  const totalCallsLogged = clients.reduce((acc, c) => acc + (c.callCount || 0), 0);

  const resetFilters = () => {
    setSearchTerm("");
    setClientTab("all");
    setCallFilter("all");
    setSortBy("last_contacted");
  };

  const hasActiveFilters =
    searchTerm !== "" ||
    clientTab !== "all" ||
    callFilter !== "all" ||
    sortBy !== "last_contacted";

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* 1. Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Clients Directory
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Manage canonical client businesses, connected Google &amp; Meta ad accounts, and client workspaces.
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

      {/* 2. Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-white border-slate-200/80 shadow-sm rounded-2xl">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Total Clients
              </p>
              <h3 className="text-2xl font-black text-slate-900 mt-0.5">
                {totalClientsCount}
              </h3>
            </div>
            <div className="h-10 w-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400">
              <Building2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200/80 shadow-sm rounded-2xl">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Active Clients
              </p>
              <h3 className="text-2xl font-black text-emerald-600 mt-0.5">
                {activeClientsCount}
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
                With Ad Accounts
              </p>
              <h3 className="text-2xl font-black text-indigo-600 mt-0.5">
                {clientsWithAdsCount}
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

      {/* 3. Main Directory Table Card */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden space-y-3">
        {/* Sub-Tabs Row */}
        <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50/50">
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
              Onboarding ({onboardingClientsCount})
            </button>
          </div>

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
              <Flame className="h-3 w-3 text-amber-300" /> Hot (7+)
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
              placeholder="Search clients, industry, legal name..."
              className="pl-9 text-xs h-9 bg-slate-50 border-slate-200 rounded-xl"
            />
          </div>

          <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
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

        {/* 4. Clients Table */}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50/50">
              <TableRow className="border-slate-100">
                <TableHead className="text-[11px] font-bold text-slate-500 uppercase tracking-wider py-3">
                  Client / Business
                </TableHead>
                <TableHead className="text-[11px] font-bold text-slate-500 uppercase tracking-wider py-3">
                  Industry &amp; Details
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
                      <Link
                        href={`/contacts?search=${encodeURIComponent(client.name)}`}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 border border-slate-200 hover:border-indigo-200 transition-colors"
                        title="View client contacts in Contacts directory"
                      >
                        <Users className="h-3 w-3 text-slate-500" />
                        {client.contactsCount || 0} contact{(client.contactsCount || 0) === 1 ? "" : "s"}
                      </Link>
                    </TableCell>

                    {/* Call History */}
                    <TableCell className="py-3">
                      {client.callCount && client.callCount > 0 ? (
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200 flex items-center gap-1">
                              <PhoneCall className="h-2.5 w-2.5 text-purple-600" />
                              {client.callCount} call{client.callCount > 1 ? "s" : ""}
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
        </div>
      </div>

      {/* 5. Onboard New Client Modal */}
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
