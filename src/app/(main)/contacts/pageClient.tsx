"use client";

import {
  AlertCircle,
  ArrowRight,
  ArrowUpDown,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  ExternalLink,
  Filter,
  Flame,
  Globe,
  HelpCircle,
  Info,
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
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  assignContactToClientAction,
  getCrmDirectoryDataAction,
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
  contactsCount: number;
  callCount: number;
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
  jobTitle?: string | null;
  isPrimary: boolean;
  pipelineStage?: string | null;
  status: string;
  callCount: number;
  lastCallAt?: Date | string | null;
  latestLeadScore?: number | null;
  latestSentiment?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export default function ContactsDirectoryClient() {
  const [clients, setClients] = useState<ClientEntity[]>([]);
  const [contacts, setContacts] = useState<ContactEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncingGhl, setSyncingGhl] = useState(false);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [stageFilter, setStageFilter] = useState<"all" | "leads" | "won" | "unassigned">("all");
  const [callFilter, setCallFilter] = useState<"all" | "with_calls" | "hot_leads">("all");

  // Assignment Modal
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedContact, setSelectedContact] = useState<ContactEntity | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  const [assigningLoading, setAssigningLoading] = useState(false);
  const [clientSearchQuery, setClientSearchQuery] = useState("");

  // Promote Modal
  const [promoteModalOpen, setPromoteModalOpen] = useState(false);
  const [promoteContact, setPromoteContact] = useState<ContactEntity | null>(null);
  const [newClientName, setNewClientName] = useState("");
  const [promotingLoading, setPromotingLoading] = useState(false);

  // Fetch Directory Data
  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await getCrmDirectoryDataAction();
      if (res.success && res.clients && res.contacts) {
        setClients(res.clients as any);
        setContacts(res.contacts as any);
      } else {
        toast.error("Failed to load contacts directory");
      }
    } catch (err: any) {
      toast.error(err.message || "Network error loading directory");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Sync GHL Contacts & Calls
  const handleSyncGhl = async () => {
    setSyncingGhl(true);
    try {
      const res = await syncAllGhlClientsAction();
      if (res.success) {
        toast.success(`Synced ${res.totalFound || 0} contacts from GoHighLevel!`);
        await fetchData(true);
      } else {
        toast.error(res.error || "GHL sync failed");
      }
    } catch (err: any) {
      toast.error(err.message || "GHL sync failed");
    } finally {
      setSyncingGhl(false);
    }
  };

  // Assign Contact to Client Action
  const handleSaveAssignment = async () => {
    if (!selectedContact) return;
    setAssigningLoading(true);
    try {
      const res = await assignContactToClientAction(selectedContact.id, selectedClientId);
      if (res.success) {
        const clientObj = clients.find((c) => c.id === selectedClientId);
        toast.success(
          selectedClientId
            ? `Assigned ${selectedContact.name} to ${clientObj?.name || "Client"}`
            : `Unassigned ${selectedContact.name}`,
        );
        setAssignModalOpen(false);
        fetchData(true);
      } else {
        toast.error(res.error || "Failed to update assignment");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to update assignment");
    } finally {
      setAssigningLoading(false);
    }
  };

  // Promote Contact to New Client Action
  const handlePromoteToClient = async () => {
    if (!promoteContact || !newClientName.trim()) return;
    setPromotingLoading(true);
    try {
      const res = await promoteContactToClientAction(promoteContact.id, newClientName.trim());
      if (res.success) {
        toast.success(`Created client "${newClientName.trim()}" and linked ${promoteContact.name}!`);
        setPromoteModalOpen(false);
        setNewClientName("");
        fetchData(true);
      } else {
        toast.error(res.error || "Failed to promote contact");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to promote contact");
    } finally {
      setPromotingLoading(false);
    }
  };

  // Filtered Contacts
  const filteredContacts = useMemo(() => {
    return contacts.filter((c) => {
      // Stage filter
      if (stageFilter === "leads") {
        const stage = (c.pipelineStage || "").toLowerCase();
        if (stage.includes("won") || stage.includes("lost") || stage.includes("disqualified")) return false;
      } else if (stageFilter === "won") {
        const stage = (c.pipelineStage || "").toLowerCase();
        if (!stage.includes("won") && c.status !== "active") return false;
      } else if (stageFilter === "unassigned") {
        if (c.clientId) return false;
      }

      // Call filter
      if (callFilter === "with_calls" && c.callCount === 0) return false;
      if (callFilter === "hot_leads" && (!c.latestLeadScore || c.latestLeadScore < 7)) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = c.name?.toLowerCase().includes(q);
        const matchesEmail = c.email?.toLowerCase().includes(q);
        const matchesPhone = c.phone?.includes(q);
        const matchesClient = c.clientName?.toLowerCase().includes(q);
        const matchesStage = c.pipelineStage?.toLowerCase().includes(q);
        return matchesName || matchesEmail || matchesPhone || matchesClient || matchesStage;
      }

      return true;
    });
  }, [contacts, stageFilter, callFilter, searchQuery]);

  // Clients filtered for assignment picker
  const filteredClientsForPicker = useMemo(() => {
    if (!clientSearchQuery.trim()) return clients;
    const q = clientSearchQuery.toLowerCase();
    return clients.filter((c) => c.name.toLowerCase().includes(q) || c.industry.toLowerCase().includes(q));
  }, [clients, clientSearchQuery]);

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Contacts & Leads</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
              {contacts.length} Total
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Individual contacts and sales leads synced from GoHighLevel. Assign them to your real client businesses.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchData(true)}
            disabled={refreshing || loading}
            className="text-xs h-9 bg-white"
          >
            <RefreshCw className={cn("w-3.5 h-3.5 mr-1.5", refreshing && "animate-spin")} />
            Refresh
          </Button>

          <Button
            size="sm"
            onClick={handleSyncGhl}
            disabled={syncingGhl}
            className="text-xs h-9 bg-indigo-600 hover:bg-indigo-700 text-white font-medium shadow-sm"
          >
            <Zap className={cn("w-3.5 h-3.5 mr-1.5 text-indigo-200", syncingGhl && "animate-spin")} />
            {syncingGhl ? "Syncing GHL..." : "Sync from GHL"}
          </Button>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
        {/* Stage Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          <button
            type="button"
            onClick={() => setStageFilter("all")}
            className={cn(
              "px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap",
              stageFilter === "all"
                ? "bg-indigo-50 text-indigo-700 border border-indigo-200"
                : "text-slate-600 hover:bg-slate-50",
            )}
          >
            All Contacts ({contacts.length})
          </button>
          <button
            type="button"
            onClick={() => setStageFilter("leads")}
            className={cn(
              "px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap",
              stageFilter === "leads"
                ? "bg-indigo-50 text-indigo-700 border border-indigo-200"
                : "text-slate-600 hover:bg-slate-50",
            )}
          >
            Leads & Pipeline
          </button>
          <button
            type="button"
            onClick={() => setStageFilter("won")}
            className={cn(
              "px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap",
              stageFilter === "won"
                ? "bg-indigo-50 text-indigo-700 border border-indigo-200"
                : "text-slate-600 hover:bg-slate-50",
            )}
          >
            Closed Won / Active
          </button>
          <button
            type="button"
            onClick={() => setStageFilter("unassigned")}
            className={cn(
              "px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap",
              stageFilter === "unassigned"
                ? "bg-amber-50 text-amber-700 border border-amber-200"
                : "text-slate-600 hover:bg-slate-50",
            )}
          >
            Unassigned ({contacts.filter((c) => !c.clientId).length})
          </button>
        </div>

        {/* Search & Call Filters */}
        <div className="flex items-center gap-2">
          {/* Call Filter */}
          <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-xs">
            <button
              type="button"
              onClick={() => setCallFilter("all")}
              className={cn(
                "px-2 py-1 rounded-md font-medium text-[11px]",
                callFilter === "all" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900",
              )}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setCallFilter("with_calls")}
              className={cn(
                "px-2 py-1 rounded-md font-medium text-[11px] flex items-center gap-1",
                callFilter === "with_calls"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-900",
              )}
            >
              <PhoneCall className="w-3 h-3" /> Calls
            </button>
            <button
              type="button"
              onClick={() => setCallFilter("hot_leads")}
              className={cn(
                "px-2 py-1 rounded-md font-medium text-[11px] flex items-center gap-1",
                callFilter === "hot_leads"
                  ? "bg-white text-amber-700 shadow-sm font-bold"
                  : "text-slate-500 hover:text-slate-900",
              )}
            >
              <Flame className="w-3 h-3 text-amber-500" /> Hot (7+)
            </button>
          </div>

          <div className="relative w-64">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <Input
              type="text"
              placeholder="Search contacts, phone, client..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8 text-xs bg-slate-50 border-slate-200"
            />
          </div>
        </div>
      </div>

      {/* Contacts Table */}
      <Card className="border-slate-200 shadow-sm overflow-hidden">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-16 flex flex-col items-center justify-center gap-3">
              <Loader2 className="h-7 w-7 text-indigo-600 animate-spin" />
              <p className="text-xs font-semibold text-slate-500">Loading contacts directory...</p>
            </div>
          ) : filteredContacts.length === 0 ? (
            <div className="p-16 text-center">
              <Users className="h-10 w-10 text-slate-300 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-slate-800">No contacts found</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                {searchQuery ? "Try adjusting your search query or filters." : "No contacts match the selected criteria."}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-slate-50/80 border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-500">
                <TableRow>
                  <TableHead className="font-bold py-3 pl-6">Contact / Lead</TableHead>
                  <TableHead className="font-bold">Pipeline Stage</TableHead>
                  <TableHead className="font-bold">Assigned Client Business</TableHead>
                  <TableHead className="font-bold">Call History</TableHead>
                  <TableHead className="font-bold">Contact Info</TableHead>
                  <TableHead className="font-bold text-right pr-6">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-slate-100 text-xs">
                {filteredContacts.map((c) => {
                  const assignedClient = clients.find((cl) => cl.id === c.clientId);
                  return (
                    <TableRow key={c.id} className="hover:bg-slate-50/60 transition-colors group">
                      {/* Contact / Lead Name */}
                      <TableCell className="py-3.5 pl-6">
                        <div className="font-semibold text-slate-900 text-xs flex items-center gap-2">
                          <span>{c.name}</span>
                          {c.ghlContactId && (
                            <span className="px-1.5 py-0.5 text-[9px] font-mono bg-slate-100 text-slate-500 rounded">
                              GHL
                            </span>
                          )}
                        </div>
                        {c.jobTitle && <div className="text-[11px] text-slate-400 mt-0.5">{c.jobTitle}</div>}
                      </TableCell>

                      {/* Pipeline Stage */}
                      <TableCell>
                        {c.pipelineStage ? (
                          <span
                            className={cn(
                              "px-2 py-0.5 rounded-full text-[10px] font-semibold border inline-block",
                              c.pipelineStage.toLowerCase().includes("won")
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : c.pipelineStage.toLowerCase().includes("meeting") ||
                                    c.pipelineStage.toLowerCase().includes("scheduled")
                                  ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                                  : c.pipelineStage.toLowerCase().includes("disqualified")
                                    ? "bg-rose-50 text-rose-700 border-rose-200"
                                    : "bg-slate-100 text-slate-700 border-slate-200",
                            )}
                          >
                            {c.pipelineStage}
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">No stage</span>
                        )}
                      </TableCell>

                      {/* Assigned Client Business */}
                      <TableCell>
                        {assignedClient ? (
                          <div className="flex items-center gap-2">
                            <Link
                              href={`/clients/${assignedClient.id}`}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-indigo-50/80 text-indigo-700 hover:bg-indigo-100 transition-colors border border-indigo-200/60"
                            >
                              <Building2 className="w-3 h-3 text-indigo-500" />
                              <span className="truncate max-w-[150px]">{assignedClient.name}</span>
                            </Link>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedContact(c);
                                setSelectedClientId(c.clientId || null);
                                setClientSearchQuery("");
                                setAssignModalOpen(true);
                              }}
                              className="text-slate-400 hover:text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                              title="Change Client"
                            >
                              <Pencil className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedContact(c);
                                setSelectedClientId(null);
                                setClientSearchQuery("");
                                setAssignModalOpen(true);
                              }}
                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50/60 hover:bg-indigo-100/80 px-2 py-0.5 rounded border border-dashed border-indigo-300 transition-colors"
                            >
                              <LinkIcon className="w-2.5 h-2.5" /> Assign to Client
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setPromoteContact(c);
                                setNewClientName(c.name);
                                setPromoteModalOpen(true);
                              }}
                              className="text-[11px] text-slate-400 hover:text-slate-600 underline"
                              title="Promote contact to its own client business"
                            >
                              New Client
                            </button>
                          </div>
                        )}
                      </TableCell>

                      {/* Call History */}
                      <TableCell>
                        {c.callCount > 0 ? (
                          <div className="flex items-center gap-1.5">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-violet-50 text-violet-700 border border-violet-200">
                              <PhoneCall className="w-2.5 h-2.5" />
                              {c.callCount} {c.callCount === 1 ? "call" : "calls"}
                            </span>
                            {c.latestLeadScore && (
                              <span
                                className={cn(
                                  "px-1.5 py-0.5 rounded text-[10px] font-bold",
                                  c.latestLeadScore >= 7
                                    ? "bg-amber-100 text-amber-800"
                                    : "bg-slate-100 text-slate-600",
                                )}
                              >
                                Score: {c.latestLeadScore}/10
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">No calls</span>
                        )}
                      </TableCell>

                      {/* Contact Info (Email & Phone) */}
                      <TableCell>
                        <div className="space-y-0.5">
                          {c.email && (
                            <div className="text-[11px] text-slate-600 truncate max-w-[180px] flex items-center gap-1">
                              <Mail className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                              <span>{c.email}</span>
                            </div>
                          )}
                          {c.phone && (
                            <div className="text-[11px] text-slate-500 flex items-center gap-1">
                              <Phone className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                              <span>{c.phone}</span>
                            </div>
                          )}
                        </div>
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="text-right pr-6">
                        <div className="flex items-center justify-end gap-1.5">
                          {c.email && (
                            <a
                              href={`mailto:${c.email}`}
                              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
                              title="Send Email"
                            >
                              <Mail className="w-3.5 h-3.5" />
                            </a>
                          )}
                          {c.phone && (
                            <a
                              href={`tel:${c.phone}`}
                              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
                              title="Call Contact"
                            >
                              <Phone className="w-3.5 h-3.5" />
                            </a>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedContact(c);
                              setSelectedClientId(c.clientId || null);
                              setClientSearchQuery("");
                              setAssignModalOpen(true);
                            }}
                            className="h-7 text-[11px] text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50"
                          >
                            {c.clientId ? "Change Client" : "Assign"}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Assign Client Modal */}
      {assignModalOpen && selectedContact && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Assign Contact to Client Business</h3>
              <p className="text-xs text-slate-500 mt-1">
                Link <span className="font-semibold text-slate-800">{selectedContact.name}</span> to an agency client company (e.g., Ray Amp Solar, Smooth Concrete).
              </p>
            </div>

            <div className="p-5 space-y-4">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <Input
                  placeholder="Search real client businesses..."
                  value={clientSearchQuery}
                  onChange={(e) => setClientSearchQuery(e.target.value)}
                  className="pl-8 text-xs h-9"
                />
              </div>

              <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-lg">
                <button
                  type="button"
                  onClick={() => setSelectedClientId(null)}
                  className={cn(
                    "w-full text-left p-2.5 text-xs flex items-center justify-between hover:bg-slate-50 transition-colors",
                    selectedClientId === null ? "bg-indigo-50/60 font-semibold text-indigo-700" : "text-slate-600",
                  )}
                >
                  <span className="italic">None (Leave Unassigned)</span>
                  {selectedClientId === null && <Check className="w-3.5 h-3.5 text-indigo-600" />}
                </button>

                {filteredClientsForPicker.map((cl) => {
                  const isSelected = selectedClientId === cl.id;
                  return (
                    <button
                      key={cl.id}
                      type="button"
                      onClick={() => setSelectedClientId(cl.id)}
                      className={cn(
                        "w-full text-left p-2.5 text-xs flex items-center justify-between hover:bg-slate-50 transition-colors",
                        isSelected ? "bg-indigo-50/60 font-semibold text-indigo-700" : "text-slate-700",
                      )}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{cl.name}</span>
                        {cl.industry && (
                          <span className="text-[10px] text-slate-400 bg-slate-100 px-1 rounded shrink-0">
                            {cl.industry}
                          </span>
                        )}
                      </div>
                      {isSelected && <Check className="w-3.5 h-3.5 text-indigo-600 shrink-0 ml-2" />}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAssignModalOpen(false)}
                className="text-xs h-8"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSaveAssignment}
                disabled={assigningLoading}
                className="text-xs h-8 bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                {assigningLoading ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                Save Assignment
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Promote to New Client Modal */}
      {promoteModalOpen && promoteContact && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Create Client Business</h3>
              <p className="text-xs text-slate-500 mt-1">
                Promote <span className="font-semibold text-slate-800">{promoteContact.name}</span> into their own distinct client company account.
              </p>
            </div>

            <div className="p-5 space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Company / Client Name</label>
                <Input
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                  placeholder="e.g. Ray Amp Solar, Smooth Concrete"
                  className="text-xs h-9"
                />
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPromoteModalOpen(false)}
                className="text-xs h-8"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handlePromoteToClient}
                disabled={promotingLoading || !newClientName.trim()}
                className="text-xs h-8 bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                {promotingLoading ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                Create Client & Link
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
