"use client";

import {
  AlertCircle,
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  ExternalLink,
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
  Search,
  Send,
  SlidersHorizontal,
  Sparkles,
  Target,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { listAccountsAction } from "@/actions/agency.actions";
import {
  createClientOnboardingAction,
  deleteClientOnboardingAction,
  getClientOnboardingsAction,
  syncAllGhlClientsAction,
} from "@/actions/client-onboarding.actions";
import { getOnboardingSettingsAction } from "@/actions/onboarding-settings.actions";
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

export interface ClientRecord {
  id: number;
  clientName: string;
  primaryContactName: string;
  contactEmail: string;
  contactPhone?: string | null;
  ghlPipelineStage?: string | null;
  googleAdsAccess: boolean;
  metaAdsAccess: boolean;
  driveFolderLink: string | null;
  notionDashboardLink: string | null;
  signalGroupLink: string | null;
  status: string;
  googleAdsStatus: string;
  metaAdsStatus: string;
  ghlContactId: string | null;
  ghlOpportunityId: string | null;
  ghlSubAccountId?: string | null;
  ghlStatus?: string | null;
  ghlError?: string | null;
  createdAt: Date;
  updatedAt: Date;
  adAccounts?: { id: number; name: string; googleAccountId: string }[];
}

export default function ClientsDirectoryClient() {
  const router = useRouter();

  // Data states
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [adAccountsList, setAdAccountsList] = useState<
    { id: number; name: string; googleAccountId: string }[]
  >([]);
  const [loading, setLoading] = useState(true);

  // Search & Tabs
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<
    "onboarding" | "active" | "ghl" | "all"
  >("onboarding");

  // Syncing states
  const [isSyncingGhl, setIsSyncingGhl] = useState(false);

  // Form states (New Client modal)
  const [isNewClientOpen, setIsNewClientOpen] = useState(false);
  const [formClientName, setFormClientName] = useState("");
  const [formContactName, setFormContactName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formGoogleAds, setFormGoogleAds] = useState(true);
  const [formMetaAds, setFormMetaAds] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // GHL Search Autocomplete
  const [ghlSearchQuery, setGhlSearchQuery] = useState("");
  const [ghlResults, setGhlResults] = useState<any[]>([]);
  const [loadingGhl, setLoadingGhl] = useState(false);
  const [selectedGhlContact, setSelectedGhlContact] = useState<any | null>(
    null,
  );

  // Load clients and accounts
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [clientRes, adAccountsRes] = await Promise.all([
        getClientOnboardingsAction(),
        listAccountsAction(),
      ]);

      if (clientRes.success && clientRes.clients) {
        setClients(clientRes.clients as unknown as ClientRecord[]);
      } else {
        toast.error(clientRes.error || "Failed to load clients.");
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
    } catch (error: any) {
      console.error("Error loading client data:", error);
      toast.error("Failed to load client onboardings.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // GHL Search Debounce
  useEffect(() => {
    if (!ghlSearchQuery.trim()) {
      setGhlResults([]);
      return;
    }

    const delayDebounce = setTimeout(async () => {
      setLoadingGhl(true);
      try {
        const res = await fetch(
          `/api/gohighlevel/search?q=${encodeURIComponent(ghlSearchQuery)}`,
        );
        const data = await res.json();
        if (data.contacts) {
          setGhlResults(data.contacts);
        }
      } catch (err) {
        console.error("Failed to search GHL:", err);
      } finally {
        setLoadingGhl(false);
      }
    }, 400);

    return () => clearTimeout(delayDebounce);
  }, [ghlSearchQuery]);

  const handleSyncGhlClients = async () => {
    setIsSyncingGhl(true);
    const toastId = toast.loading(
      "Syncing all clients & contacts from GoHighLevel...",
    );
    try {
      const res = await syncAllGhlClientsAction();
      if (res.success) {
        toast.success(
          `GHL Sync Complete! Found ${res.totalFound} contact(s) (${res.totalImported} imported, ${res.totalUpdated} updated)`,
          { id: toastId },
        );
        await loadData();
      } else {
        toast.error(res.error || "Failed to sync clients from GHL", {
          id: toastId,
        });
      }
    } catch (err: any) {
      toast.error(err.message || "GHL Sync failed", { id: toastId });
    } finally {
      setIsSyncingGhl(false);
    }
  };

  const handleSelectGhlContact = (contact: any) => {
    setSelectedGhlContact(contact);
    setFormClientName(contact.companyName || `${contact.name}'s Business`);
    setFormContactName(contact.name);
    setFormEmail(contact.email);
    setGhlSearchQuery("");
    setGhlResults([]);
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
      toast.error(
        `Error creating client record: ${err.message || String(err)}`,
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteClient = async (clientId: number, clientName: string) => {
    if (
      !confirm(
        `Are you sure you want to delete ${clientName}? This will remove associated onboarding records.`,
      )
    ) {
      return;
    }

    try {
      const res = await deleteClientOnboardingAction(clientId);
      if (res.success) {
        toast.success("Client onboarding record deleted.");
        loadData();
      } else {
        toast.error(res.error || "Failed to delete client.");
      }
    } catch (err: any) {
      toast.error("Error deleting client.");
    }
  };

  // Filter clients based on tab and search
  const filteredClients = clients.filter((c) => {
    const matchesSearch =
      c.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.primaryContactName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.contactEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.contactPhone && c.contactPhone.includes(searchTerm));

    if (!matchesSearch) return false;

    if (activeTab === "onboarding") {
      return c.status !== "completed" && c.status !== "active";
    }
    if (activeTab === "active") {
      return c.status === "completed" || c.status === "active";
    }
    if (activeTab === "ghl") {
      return Boolean(c.ghlContactId);
    }
    return true; // "all"
  });

  // Calculate high-level summary counts
  const totalClientsCount = clients.length;
  const activeClientsCount = clients.filter(
    (c) => c.status === "completed" || c.status === "active",
  ).length;
  const inOnboardingCount = clients.filter(
    (c) => c.status !== "completed" && c.status !== "active",
  ).length;
  const ghlSyncedCount = clients.filter((c) => Boolean(c.ghlContactId)).length;

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
      case "active":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="h-3 w-3 text-emerald-500" /> Active Client
          </span>
        );
      case "email_sent":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
            <Mail className="h-3 w-3 text-blue-500" /> Email Dispatched
          </span>
        );
      case "failed":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
            <AlertCircle className="h-3 w-3 text-rose-500" /> Pipeline Error
          </span>
        );
      case "in_progress":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
            <Loader2 className="h-3 w-3 animate-spin text-indigo-500" /> Running
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="h-3 w-3 text-amber-500" /> In Onboarding
          </span>
        );
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* 1. Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Clients Directory & Onboarding
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Automate onboarding workspaces, sync GoHighLevel CRM clients, and
            inspect AI call recordings.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            onClick={handleSyncGhlClients}
            disabled={isSyncingGhl}
            variant="outline"
            className="border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs h-9 px-3.5 rounded-xl flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <RefreshCw
              className={cn(
                "h-3.5 w-3.5 text-indigo-600",
                isSyncingGhl && "animate-spin",
              )}
            />
            {isSyncingGhl ? "Syncing GHL..." : "Sync GHL Clients"}
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

      {/* 2. Top Metric Cards */}
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
              <Users className="h-5 w-5" />
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
                In Onboarding
              </p>
              <h3 className="text-2xl font-black text-amber-600 mt-0.5">
                {inOnboardingCount}
              </h3>
            </div>
            <div className="h-10 w-10 bg-amber-50 rounded-xl flex items-center justify-center text-amber-500">
              <Clock className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200/80 shadow-sm rounded-2xl">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                GHL Synced
              </p>
              <h3 className="text-2xl font-black text-indigo-600 mt-0.5">
                {ghlSyncedCount}
              </h3>
            </div>
            <div className="h-10 w-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-500">
              <Building2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 3. Table Filters & Search */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Tabs */}
          <div className="flex bg-slate-100/80 p-1 rounded-xl w-fit">
            <button
              type="button"
              onClick={() => setActiveTab("onboarding")}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                activeTab === "onboarding"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-900",
              )}
            >
              Onboarding Queue ({inOnboardingCount})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("active")}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                activeTab === "active"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-900",
              )}
            >
              Active Clients ({activeClientsCount})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("ghl")}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                activeTab === "ghl"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-900",
              )}
            >
              GHL / Existing ({ghlSyncedCount})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("all")}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                activeTab === "all"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-900",
              )}
            >
              All Records ({totalClientsCount})
            </button>
          </div>

          {/* Search */}
          <div className="relative w-full sm:w-64">
            <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by client, email, phone..."
              className="pl-9 text-xs h-9 bg-slate-50 border-slate-200 rounded-xl"
            />
          </div>
        </div>

        {/* Client Table */}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50/50">
              <TableRow className="border-slate-100">
                <TableHead className="text-[11px] font-bold text-slate-500 uppercase tracking-wider py-3">
                  Client / Business
                </TableHead>
                <TableHead className="text-[11px] font-bold text-slate-500 uppercase tracking-wider py-3">
                  Primary Contact
                </TableHead>
                <TableHead className="text-[11px] font-bold text-slate-500 uppercase tracking-wider py-3">
                  Status & Stage
                </TableHead>
                <TableHead className="text-[11px] font-bold text-slate-500 uppercase tracking-wider py-3">
                  Google / Meta Ads
                </TableHead>
                <TableHead className="text-[11px] font-bold text-slate-500 uppercase tracking-wider py-3">
                  Linked Ad Accounts
                </TableHead>
                <TableHead className="text-[11px] font-bold text-slate-500 uppercase tracking-wider py-3 text-right">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center py-12 text-slate-400 text-sm"
                  >
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-indigo-500 mb-2" />
                    Fetching clients...
                  </TableCell>
                </TableRow>
              ) : filteredClients.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center py-12 text-slate-400 text-sm"
                  >
                    No clients found matching filter. Click{" "}
                    <strong>Sync GHL Clients</strong> or{" "}
                    <strong>Onboard New Client</strong> to add!
                  </TableCell>
                </TableRow>
              ) : (
                filteredClients.map((client) => (
                  <TableRow
                    key={client.id}
                    className="border-slate-100 hover:bg-slate-50/80 transition-colors cursor-pointer"
                    onClick={() => router.push(`/clients/${client.id}`)}
                  >
                    <TableCell className="font-bold text-slate-900 py-3 text-sm">
                      <div className="space-y-0.5">
                        <span className="hover:text-indigo-600 transition-colors">
                          {client.clientName}
                        </span>
                        {client.ghlContactId && (
                          <span className="block text-[10px] font-normal text-indigo-600">
                            GHL Contact
                          </span>
                        )}
                      </div>
                    </TableCell>

                    <TableCell className="py-3 text-sm">
                      <div>
                        <p className="font-semibold text-slate-800 hover:text-indigo-600 transition-colors">
                          {client.primaryContactName}
                        </p>
                        <p className="text-xs text-slate-500">
                          {client.contactEmail}
                          {client.contactPhone && ` • ${client.contactPhone}`}
                        </p>
                      </div>
                    </TableCell>

                    <TableCell className="py-3">
                      <div className="space-y-1">
                        {renderStatusBadge(client.status)}
                        {client.ghlPipelineStage && (
                          <p className="text-[10px] text-slate-500 truncate max-w-[140px]">
                            {client.ghlPipelineStage}
                          </p>
                        )}
                      </div>
                    </TableCell>

                    <TableCell className="py-3">
                      <div className="flex gap-1.5 flex-wrap">
                        {client.googleAdsAccess && (
                          <span
                            className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                              client.googleAdsStatus === "granted"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : "bg-slate-100 text-slate-500"
                            }`}
                          >
                            G-Ads: {client.googleAdsStatus}
                          </span>
                        )}
                        {client.metaAdsAccess && (
                          <span
                            className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                              client.metaAdsStatus === "granted"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : "bg-slate-100 text-slate-500"
                            }`}
                          >
                            Meta: {client.metaAdsStatus}
                          </span>
                        )}
                      </div>
                    </TableCell>

                    <TableCell className="py-3 text-xs text-slate-600">
                      {client.adAccounts && client.adAccounts.length > 0 ? (
                        <div className="flex items-center gap-1.5">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                          <span className="truncate max-w-[150px]">
                            {client.adAccounts[0].name}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-[11px]">
                          None linked
                        </span>
                      )}
                    </TableCell>

                    <TableCell className="py-3 text-right">
                      <div className="flex justify-end items-center gap-1.5">
                        <Button
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/clients/${client.id}?tab=calls`);
                          }}
                          className="text-xs h-8 hover:bg-indigo-50 hover:text-indigo-600 text-slate-600 rounded-lg cursor-pointer flex items-center gap-1 font-semibold"
                          title="View Call History & AI Transcripts"
                        >
                          <PhoneCall className="h-3.5 w-3.5 text-indigo-500" />
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
                          View Details
                        </Button>

                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteClient(client.id, client.clientName);
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

      {/* 4. Create Client Modal */}
      {isNewClientOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg p-6 space-y-6 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex justify-between items-start border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Onboard New Client
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Link an existing GoHighLevel contact or create a manual entry.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsNewClientOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
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
                        <p className="font-bold text-slate-800">
                          {c.companyName || c.name}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {c.name} ({c.email})
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {selectedGhlContact && (
                  <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-2 flex items-center justify-between text-xs text-indigo-700 mt-2">
                    <span>
                      Linked to GHL Contact:{" "}
                      <strong>{selectedGhlContact.name}</strong>
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedGhlContact(null)}
                      className="text-indigo-400 hover:text-indigo-700"
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>

              {/* Client Business Name */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  Client / Business Name{" "}
                  <span className="text-rose-500">*</span>
                </label>
                <Input
                  value={formClientName}
                  onChange={(e) => setFormClientName(e.target.value)}
                  placeholder="e.g. Acme Solar Solutions"
                  required
                  className="text-xs h-9"
                />
              </div>

              {/* Primary Contact Name */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  Primary Contact Person{" "}
                  <span className="text-rose-500">*</span>
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

              {/* Access Flags */}
              <div className="pt-2 border-t border-slate-100 flex gap-4">
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formGoogleAds}
                    onChange={(e) => setFormGoogleAds(e.target.checked)}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  Request Google Ads Access
                </label>
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formMetaAds}
                    onChange={(e) => setFormMetaAds(e.target.checked)}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
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
                  className="text-xs text-slate-500 hover:text-slate-800"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-4"
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
