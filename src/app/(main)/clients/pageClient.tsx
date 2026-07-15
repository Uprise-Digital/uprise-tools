"use client";

import {
  CheckCircle2,
  ExternalLink,
  Info,
  Link as LinkIcon,
  Loader2,
  Mail,
  Search,
  Send,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { listAccountsAction } from "@/actions/agency.actions";
import {
  associateAdAccountAction,
  createClientOnboardingAction,
  deleteClientOnboardingAction,
  finalizeOnboardingAction,
  getClientOnboardingsAction,
  sendOnboardingEmailAction,
  updateClientOnboardingAction,
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
import { compileOnboardingEmail } from "@/lib/onboarding-email";

interface ClientRecord {
  id: number;
  clientName: string;
  primaryContactName: string;
  contactEmail: string;
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
  const [activeTab, setActiveTab] = useState<"onboarding" | "active" | "all">(
    "onboarding",
  );

  // Modals & Drawers
  const [isNewClientOpen, setIsNewClientOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<ClientRecord | null>(
    null,
  );

  // Form states (New Client)
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

  // Edit Link states
  const [editDrive, setEditDrive] = useState("");
  const [editNotion, setEditNotion] = useState("");
  const [editSignal, setEditSignal] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [onboardingSettings, setOnboardingSettings] = useState<any>(null);
  const [isUpdatingLinks, setIsUpdatingLinks] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);

  // Link ad account modal state
  const [selectedAdAccountId, setSelectedAdAccountId] = useState<string>("");
  const [isLinkingAccount, setIsLinkingAccount] = useState(false);

  // Load clients and accounts
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const clientsRes = await getClientOnboardingsAction();
      if (clientsRes.success && clientsRes.clients) {
        const mappedClients = clientsRes.clients.map((c: any) => ({
          ...c,
          createdAt: new Date(c.createdAt),
          updatedAt: new Date(c.updatedAt),
        }));
        setClients(mappedClients);
      } else {
        toast.error(clientsRes.error || "Failed to load clients.");
      }

      const accountsRes = await listAccountsAction();
      if (accountsRes.success && accountsRes.data) {
        setAdAccountsList(accountsRes.data);
      }

      const settingsRes = await getOnboardingSettingsAction();
      if (settingsRes.success && settingsRes.data) {
        setOnboardingSettings(settingsRes.data);
      }
    } catch (err: any) {
      console.error(err);
      toast.error("An error occurred loading dashboard data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // GHL Autocomplete lookup
  useEffect(() => {
    const delayDebounce = setTimeout(async () => {
      if (ghlSearchQuery.trim().length >= 2) {
        setLoadingGhl(true);
        try {
          const res = await fetch(
            `/api/gohighlevel/search?query=${encodeURIComponent(ghlSearchQuery)}`,
          );
          const data = await res.json();
          if (res.ok && data.success) {
            setGhlResults(data.contacts || []);
          } else {
            const errMsg = data.error || `Status code ${res.status}`;
            toast.error(`GoHighLevel Search Error: ${errMsg}`);
            setGhlResults([]);
          }
        } catch (err: any) {
          console.error("GHL Autocomplete fetch failed", err);
          toast.error(
            `GoHighLevel Connection Error: ${err.message || String(err)}`,
          );
          setGhlResults([]);
        } finally {
          setLoadingGhl(false);
        }
      } else {
        setGhlResults([]);
      }
    }, 400);

    return () => clearTimeout(delayDebounce);
  }, [ghlSearchQuery]);

  // Open detail panel & prefill link fields
  const handleOpenDetails = (client: ClientRecord) => {
    setSelectedClient(client);
    setEditDrive(client.driveFolderLink || "");
    setEditNotion(client.notionDashboardLink || "");
    setEditSignal(client.signalGroupLink || "");

    const subject =
      onboardingSettings?.welcomeEmailSubject ||
      "Welcome to Uprise Digital - Let's get started!";
    setEmailSubject(subject);

    const bodyTemplate = onboardingSettings?.welcomeEmailTemplate || "";
    setEmailBody(bodyTemplate);

    const linkedAcc = client.adAccounts?.[0];
    setSelectedAdAccountId(linkedAcc ? String(linkedAcc.id) : "");
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

      if (res.success) {
        toast.success("Client added successfully! Automation triggered.");
        setIsNewClientOpen(false);
        setFormClientName("");
        setFormContactName("");
        setFormEmail("");
        setFormGoogleAds(true);
        setFormMetaAds(true);
        setSelectedGhlContact(null);
        loadData();
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

  const handleSaveLinks = async () => {
    if (!selectedClient) return;
    setIsUpdatingLinks(true);
    try {
      const res = await updateClientOnboardingAction(selectedClient.id, {
        driveFolderLink: editDrive || null,
        notionDashboardLink: editNotion || null,
        signalGroupLink: editSignal || null,
      });

      if (res.success) {
        toast.success("Links updated successfully.");
        setSelectedClient({
          ...selectedClient,
          driveFolderLink: editDrive || null,
          notionDashboardLink: editNotion || null,
          signalGroupLink: editSignal || null,
        });
        loadData();
      } else {
        toast.error(res.error || "Failed to save links.");
      }
    } catch (err: any) {
      toast.error("Error updating links.");
    } finally {
      setIsUpdatingLinks(false);
    }
  };

  const handleSendEmail = async () => {
    if (!selectedClient) return;
    setIsSendingEmail(true);
    try {
      const emailContent = compileOnboardingEmail({
        primaryContactName: selectedClient.primaryContactName,
        clientName: selectedClient.clientName,
        driveFolderLink: editDrive,
        notionDashboardLink: editNotion,
        signalGroupLink: editSignal,
        googleAdsAccess: selectedClient.googleAdsAccess,
        metaAdsAccess: selectedClient.metaAdsAccess,
        customTemplate: emailBody || undefined,
      });

      const res = await sendOnboardingEmailAction(
        selectedClient.id,
        emailSubject,
        emailContent.html,
        emailContent.text,
      );

      if (res.success) {
        toast.success("Onboarding email dispatched via Resend!");
        handleOpenDetails({
          ...selectedClient,
          status: "email_sent",
        });
        loadData();
      } else {
        toast.error(res.error || "Failed to send email.");
      }
    } catch (err: any) {
      toast.error("Error sending onboarding email.");
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handleFinalize = async () => {
    if (!selectedClient) return;
    setIsFinalizing(true);
    try {
      const res = await finalizeOnboardingAction(selectedClient.id);
      if (res.success) {
        toast.success(
          "Client onboarding completed & GoHighLevel pipeline updated!",
        );
        setSelectedClient(null);
        loadData();
      } else {
        toast.error(res.error || "Failed to complete onboarding.");
      }
    } catch (err: any) {
      toast.error("Error finalizing onboarding.");
    } finally {
      setIsFinalizing(false);
    }
  };

  const handleLinkAdAccount = async () => {
    if (!selectedClient || !selectedAdAccountId) return;
    setIsLinkingAccount(true);
    try {
      const res = await associateAdAccountAction(
        selectedClient.id,
        Number(selectedAdAccountId),
      );
      if (res.success) {
        toast.success("Ad Account linked to client successfully!");
        loadData();
      } else {
        toast.error(res.error || "Failed to link ad account.");
      }
    } catch (err: any) {
      toast.error("Error linking ad account.");
    } finally {
      setIsLinkingAccount(false);
    }
  };

  const handleDeleteClient = async (clientId: number) => {
    if (
      !confirm(
        "Are you sure you want to delete this client onboarding entry? This cannot be undone.",
      )
    )
      return;
    try {
      const res = await deleteClientOnboardingAction(clientId);
      if (res.success) {
        toast.success("Client deleted successfully.");
        if (selectedClient?.id === clientId) setSelectedClient(null);
        loadData();
      } else {
        toast.error(res.error || "Failed to delete client.");
      }
    } catch (err: any) {
      toast.error("Error deleting client.");
    }
  };

  const filteredClients = clients.filter((client) => {
    const matchesSearch =
      client.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.primaryContactName
        .toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      client.contactEmail.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    if (activeTab === "onboarding") {
      return client.status !== "completed";
    }
    if (activeTab === "active") {
      return client.status === "completed";
    }
    return true;
  });

  const renderStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; class: string }> = {
      draft: {
        label: "Draft",
        class: "bg-slate-100 text-slate-700 border-slate-200",
      },
      generating: {
        label: "Duplicating Assets...",
        class: "bg-indigo-50 text-indigo-600 border-indigo-200 animate-pulse",
      },
      ready_to_review: {
        label: "Ready to Review",
        class: "bg-amber-50 text-amber-700 border-amber-200",
      },
      email_sent: {
        label: "Email Sent",
        class: "bg-sky-50 text-sky-700 border-sky-200",
      },
      completed: {
        label: "Active Client",
        class: "bg-emerald-50 text-emerald-700 border-emerald-200",
      },
    };
    const config = statusMap[status] || {
      label: status,
      class: "bg-slate-100 text-slate-700",
    };
    return (
      <span
        className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${config.class}`}
      >
        {config.label}
      </span>
    );
  };

  return (
    <div className="space-y-6 text-slate-800 max-w-7xl mx-auto">
      {/* 1. Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 pb-6">
        <div>
          <h1 className="text-2xl font-black text-slate-900">
            Clients Directory & Onboarding
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Automate onboarding link creation, resend guides, and map ad account
            portfolios.
          </p>
        </div>
        <Button
          onClick={() => setIsNewClientOpen(true)}
          className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs py-2.5 px-4 rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
        >
          <UserPlus className="h-4 w-4" /> Onboard New Client
        </Button>
      </div>

      {/* 2. Overview Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-slate-200 shadow-sm bg-white">
          <CardContent className="pt-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Total Clients
              </p>
              <h3 className="text-xl font-bold text-slate-900 mt-1">
                {clients.length}
              </h3>
            </div>
            <Users className="h-8 w-8 text-slate-400 opacity-20" />
          </CardContent>
        </Card>
        <Card className="border-slate-200 shadow-sm bg-white">
          <CardContent className="pt-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Active Clients
              </p>
              <h3 className="text-xl font-bold text-emerald-600 mt-1">
                {clients.filter((c) => c.status === "completed").length}
              </h3>
            </div>
            <CheckCircle2 className="h-8 w-8 text-emerald-500 opacity-20" />
          </CardContent>
        </Card>
        <Card className="border-slate-200 shadow-sm bg-white">
          <CardContent className="pt-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                In Onboarding
              </p>
              <h3 className="text-xl font-bold text-amber-600 mt-1">
                {clients.filter((c) => c.status !== "completed").length}
              </h3>
            </div>
            <Loader2 className="h-8 w-8 text-amber-500 opacity-20 animate-spin-slow" />
          </CardContent>
        </Card>
        <Card className="border-slate-200 shadow-sm bg-white">
          <CardContent className="pt-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Awaiting Access
              </p>
              <h3 className="text-xl font-bold text-sky-600 mt-1">
                {
                  clients.filter(
                    (c) =>
                      c.googleAdsStatus === "pending" ||
                      c.metaAdsStatus === "pending",
                  ).length
                }
              </h3>
            </div>
            <LinkIcon className="h-8 w-8 text-sky-500 opacity-20" />
          </CardContent>
        </Card>
      </div>

      {/* 3. Controls & Directory Table */}
      <div className="border border-slate-200 rounded-2xl p-4 space-y-4 bg-white shadow-sm">
        {/* Navigation Tabs & Search */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setActiveTab("onboarding")}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold tracking-wide transition-all cursor-pointer ${
                activeTab === "onboarding"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Onboarding Queue
            </button>
            <button
              onClick={() => setActiveTab("active")}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold tracking-wide transition-all cursor-pointer ${
                activeTab === "active"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Active Clients
            </button>
            <button
              onClick={() => setActiveTab("all")}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold tracking-wide transition-all cursor-pointer ${
                activeTab === "all"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              All Records
            </button>
          </div>

          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search by client or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 bg-white border-slate-200 focus:border-indigo-500 rounded-xl text-xs h-9 text-slate-800"
            />
          </div>
        </div>

        {/* Directory Table */}
        <div className="border border-slate-100 rounded-xl overflow-hidden bg-white">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow className="border-slate-100 hover:bg-transparent">
                <TableHead className="text-slate-500 text-xs font-bold py-3.5">
                  Client / Business
                </TableHead>
                <TableHead className="text-slate-500 text-xs font-bold py-3.5">
                  Primary Contact
                </TableHead>
                <TableHead className="text-slate-500 text-xs font-bold py-3.5">
                  Onboarding State
                </TableHead>
                <TableHead className="text-slate-500 text-xs font-bold py-3.5">
                  Google / Meta Ads
                </TableHead>
                <TableHead className="text-slate-500 text-xs font-bold py-3.5">
                  Linked Ad Accounts
                </TableHead>
                <TableHead className="text-slate-500 text-xs font-bold py-3.5 text-right">
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
                    No clients found. Click "Onboard New Client" to start!
                  </TableCell>
                </TableRow>
              ) : (
                filteredClients.map((client) => (
                  <TableRow
                    key={client.id}
                    className="border-slate-100 hover:bg-slate-50 transition-colors"
                  >
                    <TableCell className="font-bold text-slate-900 py-3 text-sm">
                      {client.clientName}
                    </TableCell>
                    <TableCell className="py-3 text-sm">
                      <div>
                        <p className="font-semibold text-slate-800">
                          {client.primaryContactName}
                        </p>
                        <p className="text-xs text-slate-500">
                          {client.contactEmail}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="py-3">
                      {renderStatusBadge(client.status)}
                    </TableCell>
                    <TableCell className="py-3">
                      <div className="flex gap-2">
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
                        <span className="text-slate-400">None linked</span>
                      )}
                    </TableCell>
                    <TableCell className="py-3 text-right">
                      <div className="flex justify-end gap-1.5">
                        <Button
                          variant="ghost"
                          onClick={() => handleOpenDetails(client)}
                          className="text-xs h-8 hover:bg-indigo-50 hover:text-indigo-600 text-slate-600 rounded-lg cursor-pointer"
                        >
                          Review & Setup
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleDeleteClient(client.id)}
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

      {/* 4. Drawer Panel (Onboarding Link editor & Email sender) */}
      {selectedClient && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex justify-end">
          <div className="bg-white border-l border-slate-200 w-full max-w-2xl h-full overflow-y-auto p-6 space-y-6 flex flex-col justify-between shadow-2xl relative text-slate-800">
            <div className="space-y-6">
              {/* Drawer Header */}
              <div className="flex justify-between items-start border-b border-slate-200 pb-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    {selectedClient.clientName}
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Onboarding Workspace setup for{" "}
                    {selectedClient.primaryContactName} (
                    {selectedClient.contactEmail})
                  </p>
                </div>
                <button
                  onClick={() => setSelectedClient(null)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  ✕
                </button>
              </div>

              {/* Resource Links Section */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                  <SlidersHorizontal className="h-3.5 w-3.5" /> Workspace
                  Connections (Generated)
                </h3>

                <div className="grid gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">
                      1. Google Drive Assets Folder
                    </label>
                    <div className="flex gap-2">
                      <Input
                        value={editDrive}
                        onChange={(e) => setEditDrive(e.target.value)}
                        placeholder="Pending generation..."
                        className="bg-white border-slate-200 text-xs flex-1 h-9 rounded-lg text-slate-800"
                      />
                      {editDrive && (
                        <a
                          href={editDrive}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 bg-slate-100 hover:bg-slate-250 rounded-lg flex items-center justify-center text-slate-600 hover:text-slate-900 border border-slate-200 transition-colors"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">
                      2. Notion Client Dashboard
                    </label>
                    <div className="flex gap-2">
                      <Input
                        value={editNotion}
                        onChange={(e) => setEditNotion(e.target.value)}
                        placeholder="Pending generation..."
                        className="bg-white border-slate-200 text-xs flex-1 h-9 rounded-lg text-slate-800"
                      />
                      {editNotion && (
                        <a
                          href={editNotion}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 bg-slate-100 hover:bg-slate-250 rounded-lg flex items-center justify-center text-slate-600 hover:text-slate-900 border border-slate-200 transition-colors"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">
                      3. Signal Group Chat Invite Link
                    </label>
                    <div className="flex gap-2">
                      <Input
                        value={editSignal}
                        onChange={(e) => setEditSignal(e.target.value)}
                        placeholder="Pending generation..."
                        className="bg-white border-slate-200 text-xs flex-1 h-9 rounded-lg text-slate-800"
                      />
                      {editSignal && (
                        <a
                          href={editSignal}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 bg-slate-100 hover:bg-slate-250 rounded-lg flex items-center justify-center text-slate-600 hover:text-slate-900 border border-slate-200 transition-colors"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button
                    onClick={handleSaveLinks}
                    disabled={isUpdatingLinks}
                    className="bg-slate-100 border border-slate-200 hover:bg-slate-200 text-slate-800 font-bold text-xs py-1.5 px-3 rounded-lg cursor-pointer"
                  >
                    {isUpdatingLinks ? "Saving..." : "Save Link Adjustments"}
                  </Button>
                </div>
              </div>

              {/* Link Ad Account Section */}
              <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-3">
                <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <LinkIcon className="h-4 w-4 text-indigo-600" /> Link
                  Portfolio Ad Account
                </h4>
                <p className="text-[11px] text-slate-500">
                  Assign this client onboarding workspace to an imported Google
                  Ads account to display performance data.
                </p>
                <div className="flex gap-2">
                  <select
                    value={selectedAdAccountId}
                    onChange={(e) => setSelectedAdAccountId(e.target.value)}
                    className="flex-1 bg-white border border-slate-200 text-xs rounded-lg px-3 py-1.5 text-slate-800 outline-none focus:border-indigo-500"
                  >
                    <option value="">-- Select connected ad account --</option>
                    {adAccountsList.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} ({acc.googleAccountId})
                      </option>
                    ))}
                  </select>
                  <Button
                    onClick={handleLinkAdAccount}
                    disabled={isLinkingAccount || !selectedAdAccountId}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-3 rounded-lg cursor-pointer"
                  >
                    {isLinkingAccount ? "Linking..." : "Link Account"}
                  </Button>
                </div>
              </div>

              {/* Email Outbox & Live Preview */}
              <div className="border-t border-slate-200 pt-4 space-y-4">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5" /> Email Onboarding Outbox
                </h3>

                <div className="space-y-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">
                      Email Subject
                    </label>
                    <Input
                      value={emailSubject}
                      onChange={(e) => setEmailSubject(e.target.value)}
                      className="bg-white border-slate-200 text-xs h-9 rounded-lg text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">
                      Email Body Template
                    </label>
                    <textarea
                      value={emailBody}
                      onChange={(e) => setEmailBody(e.target.value)}
                      className="w-full min-h-[160px] text-xs font-mono p-3 bg-white border border-slate-200 rounded-xl focus:border-indigo-500 outline-none leading-relaxed text-slate-700 resize-y"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">
                      Dynamic Template Preview
                    </label>
                    <div className="border border-slate-200 rounded-xl bg-slate-50 p-4 h-64 overflow-y-auto text-xs text-slate-800 space-y-3 select-none">
                      <div className="border-b border-slate-200 pb-2 mb-2">
                        <p className="text-[10px] text-slate-500">
                          To: {selectedClient.contactEmail}
                        </p>
                        <p className="text-[10px] text-slate-500">
                          Subject: {emailSubject}
                        </p>
                      </div>
                      <div
                        // biome-ignore lint/security/noDangerouslySetInnerHtml: rendering email preview
                        dangerouslySetInnerHTML={{
                          __html: compileOnboardingEmail({
                            primaryContactName:
                              selectedClient.primaryContactName,
                            clientName: selectedClient.clientName,
                            driveFolderLink: editDrive || "#",
                            notionDashboardLink: editNotion || "#",
                            signalGroupLink: editSignal || "#",
                            googleAdsAccess: selectedClient.googleAdsAccess,
                            metaAdsAccess: selectedClient.metaAdsAccess,
                            customTemplate: emailBody || undefined,
                          }).html,
                        }}
                        className="bg-white text-slate-800 p-4 rounded-lg shadow scale-[0.95] origin-top border border-slate-200"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={handleSendEmail}
                    disabled={
                      isSendingEmail || !editDrive || !editNotion || !editSignal
                    }
                    className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-300 text-white font-bold text-xs py-2 px-4 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    {isSendingEmail ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />{" "}
                        Dispatching...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4" /> Send Onboarding Email
                      </>
                    )}
                  </Button>
                </div>
                {(!editDrive || !editNotion || !editSignal) && (
                  <p className="text-[10px] text-amber-600 flex items-center gap-1">
                    <Info className="h-3.5 w-3.5" /> Please wait for links to
                    finish generating (or input manually) before sending.
                  </p>
                )}
              </div>
            </div>

            {/* Bottom Actions (Finalize Onboarding) */}
            <div className="border-t border-slate-200 pt-4 mt-6 flex gap-2">
              <Button
                variant="ghost"
                onClick={() => setSelectedClient(null)}
                className="w-1/3 hover:bg-slate-100 text-slate-500 hover:text-slate-800 rounded-xl text-xs py-2.5"
              >
                Close View
              </Button>
              <Button
                onClick={handleFinalize}
                disabled={isFinalizing || selectedClient.status === "completed"}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-300 text-white font-bold text-xs py-2.5 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {isFinalizing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Finalizing...
                  </>
                ) : selectedClient.status === "completed" ? (
                  <>
                    <CheckCircle2 className="h-4 w-4" /> Onboarding Finalized
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" /> Finalize Client
                    Onboarding
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Create Client Drawer Modal */}
      {isNewClientOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 w-full max-w-md p-6 rounded-2xl space-y-6 shadow-2xl relative max-h-[90vh] overflow-y-auto text-slate-800">
            {/* Header */}
            <div className="flex justify-between items-start border-b border-slate-200 pb-3">
              <div>
                <h2 className="text-md font-bold text-slate-900 flex items-center gap-1.5">
                  <UserPlus className="h-5 w-5 text-indigo-600" /> Onboard New
                  Client
                </h2>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Import details directly from GoHighLevel or enter details
                  manually.
                </p>
              </div>
              <button
                onClick={() => setIsNewClientOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                ✕
              </button>
            </div>

            {/* GHL Search bar */}
            <div className="space-y-2 relative">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                Search GHL Contacts (Auto-fill)
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Type name, email, or business to search..."
                  value={ghlSearchQuery}
                  onChange={(e) => setGhlSearchQuery(e.target.value)}
                  className="pl-9 bg-white border-slate-200 focus:border-indigo-500 text-xs h-9 rounded-xl text-slate-800"
                />
              </div>

              {/* Autocomplete suggestions */}
              {loadingGhl && (
                <div className="absolute w-full mt-1 bg-white border border-slate-200 p-3 rounded-lg z-10 text-xs text-slate-400 text-center shadow-lg">
                  <Loader2 className="h-4 w-4 animate-spin mx-auto text-indigo-500 mb-1" />{" "}
                  Searching CRM...
                </div>
              )}
              {ghlResults.length > 0 && (
                <ul className="absolute w-full mt-1 bg-white border border-slate-200 rounded-xl z-10 max-h-48 overflow-y-auto divide-y divide-slate-100 shadow-xl">
                  {ghlResults.map((contact) => (
                    <li key={contact.id}>
                      <button
                        type="button"
                        onClick={() => handleSelectGhlContact(contact)}
                        className="w-full text-left p-2.5 hover:bg-slate-50 text-xs transition-colors flex items-start justify-between gap-2"
                      >
                        <div>
                          <p className="font-bold text-slate-800">
                            {contact.name}
                          </p>
                          <p className="text-[10px] text-slate-500 mt-0.5">
                            {contact.email}
                          </p>
                        </div>
                        {contact.companyName && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-100 truncate max-w-[120px]">
                            {contact.companyName}
                          </span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {selectedGhlContact && (
              <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl text-[11px] text-slate-600 flex items-center justify-between">
                <div>
                  <p className="font-bold text-indigo-800">
                    LinkedIn CRM Record:
                  </p>
                  <p className="text-slate-500 mt-0.5">
                    {selectedGhlContact.name} ({selectedGhlContact.id})
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedGhlContact(null)}
                  className="text-rose-600 hover:text-rose-800 font-bold"
                >
                  Unlink
                </button>
              </div>
            )}

            {/* Manual form */}
            <form onSubmit={handleCreateClient} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1">
                  Client Business Name *
                </label>
                <Input
                  required
                  placeholder="e.g. KGN Homes"
                  value={formClientName}
                  onChange={(e) => setFormClientName(e.target.value)}
                  className="bg-white border-slate-200 text-xs h-9 rounded-xl text-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1">
                    Contact Name *
                  </label>
                  <Input
                    required
                    placeholder="e.g. Sultan"
                    value={formContactName}
                    onChange={(e) => setFormContactName(e.target.value)}
                    className="bg-white border-slate-200 text-xs h-9 rounded-xl text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1">
                    Contact Email *
                  </label>
                  <Input
                    required
                    type="email"
                    placeholder="e.g. sultan@gmail.com"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    className="bg-white border-slate-200 text-xs h-9 rounded-xl text-slate-800"
                  />
                </div>
              </div>

              {/* Service packages */}
              <div className="space-y-2 border-t border-slate-200 pt-3">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Service Package Inclusions
                </label>

                <div className="flex gap-6">
                  <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formGoogleAds}
                      onChange={(e) => setFormGoogleAds(e.target.checked)}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 bg-white h-4 w-4 animate-none"
                    />
                    Google Ads Access Instructions
                  </label>

                  <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formMetaAds}
                      onChange={(e) => setFormMetaAds(e.target.checked)}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 bg-white h-4 w-4 animate-none"
                    />
                    Meta Ads Access Instructions
                  </label>
                </div>
              </div>

              {/* Actions */}
              <div className="border-t border-slate-200 pt-4 flex gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setIsNewClientOpen(false)}
                  className="w-1/3 hover:bg-slate-100 text-slate-500 hover:text-slate-800 rounded-xl text-xs py-2"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs py-2 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Adding...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 text-indigo-300" /> Start
                      Onboarding
                    </>
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
