"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Database,
  Loader2,
  Plus,
  RefreshCw,
  Trash,
  User as UserIcon,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { fetchSubAccountsForPreviewAction } from "@/actions/onboarding.actions";
import {
  disconnectGoogleAdsAction,
  refreshAdAccountsMetadataAction,
  updateAutoSyncSettingsAction,
  updateLinkedAccountsAction,
  updateNegativeKeywordOptionsAction,
  updateOrganizationNameAction,
} from "@/actions/settings.actions";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

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

interface SubAccount {
  id: string;
  name: string;
  currencyCode: string;
  timeZone: string;
  status: string;
  optimizationScore: number | null;
}

interface GeneralTabProps {
  connection: {
    id: number;
    connectedEmail: string;
    managerCustomerId: string | null;
    status: string;
    autoAddAccounts: boolean;
    autoSyncScope: "ALL" | "ACTIVE_ONLY";
    negativeKeywordBroadEnabled: boolean;
    negativeKeywordPhraseEnabled: boolean;
    negativeKeywordExactEnabled: boolean;
    createdAt: string;
  } | null;
  accounts: AccountSyncData[];
  orgName: string;
  userEmail: string;
  userRole: string;
  initialAutoJoinDomainEnabled: boolean;
}

function formatCustomerId(id: any) {
  if (!id) return "";
  const clean = id.toString().replace(/-/g, "");
  if (clean.length !== 10) return id;
  return `${clean.substring(0, 3)}-${clean.substring(3, 6)}-${clean.substring(6)}`;
}

export function GeneralTab({
  connection,
  accounts,
  orgName,
  userEmail,
  userRole,
  initialAutoJoinDomainEnabled,
}: GeneralTabProps) {
  const [orgNameInput, setOrgNameInput] = useState(orgName);
  const [savingOrgName, setSavingOrgName] = useState(false);
  const [allowDomainAutoJoin, setAllowDomainAutoJoin] = useState(
    initialAutoJoinDomainEnabled,
  );

  const [disconnectDialogOpen, setDisconnectDialogOpen] = useState(false);
  const [deleteSyncedData, setDeleteSyncedData] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const [accountsDialogOpen, setAccountsDialogOpen] = useState(false);
  const [fetchingAccounts, setFetchingAccounts] = useState(false);
  const [previewAccounts, setPreviewAccounts] = useState<SubAccount[]>([]);
  const [selectedAccountIds, setSelectedAccountIds] = useState<Set<string>>(
    new Set(),
  );
  const [modalSearch, setModalSearch] = useState("");
  const [modalStatusFilter, setModalStatusFilter] = useState("ALL");
  const [savingLinkedAccounts, setSavingLinkedAccounts] = useState(false);
  const [refreshingAccounts, setRefreshingAccounts] = useState(false);

  const [autoAddAccounts, setAutoAddAccounts] = useState(
    connection?.autoAddAccounts ?? false,
  );
  const [autoSyncScope, setAutoSyncScope] = useState<"ALL" | "ACTIVE_ONLY">(
    connection?.autoSyncScope ?? "ALL",
  );
  const [updatingAutoSync, setUpdatingAutoSync] = useState(false);

  const [broadEnabled, setBroadEnabled] = useState(
    connection?.negativeKeywordBroadEnabled ?? true,
  );
  const [phraseEnabled, setPhraseEnabled] = useState(
    connection?.negativeKeywordPhraseEnabled ?? true,
  );
  const [exactEnabled, setExactEnabled] = useState(
    connection?.negativeKeywordExactEnabled ?? true,
  );
  const [updatingOptions, setUpdatingOptions] = useState(false);

  const handleToggleKeywordOptions = async (
    type: "broad" | "phrase" | "exact",
    val: boolean,
  ) => {
    if (!connection) return;

    let nextBroad = broadEnabled;
    let nextPhrase = phraseEnabled;
    let nextExact = exactEnabled;

    if (type === "broad") {
      nextBroad = val;
      setBroadEnabled(val);
    } else if (type === "phrase") {
      nextPhrase = val;
      setPhraseEnabled(val);
    } else if (type === "exact") {
      nextExact = val;
      setExactEnabled(val);
    }

    setUpdatingOptions(true);
    const toastId = toast.loading(
      "Updating negative keywording match type options...",
    );
    try {
      const res = await updateNegativeKeywordOptionsAction({
        connectionId: connection.id,
        broadEnabled: nextBroad,
        phraseEnabled: nextPhrase,
        exactEnabled: nextExact,
      });
      if (res.success) {
        toast.success("Negative keywording options successfully updated.", {
          id: toastId,
        });
      } else {
        toast.error(res.error || "Failed to update settings.", { id: toastId });
      }
    } catch (err: any) {
      toast.error(err.message || "An unexpected error occurred.", {
        id: toastId,
      });
    } finally {
      setUpdatingOptions(false);
    }
  };

  const handleToggleAutoSync = async (
    enabled: boolean,
    scope?: "ALL" | "ACTIVE_ONLY",
  ) => {
    if (!connection) return;
    const nextScope = scope ?? autoSyncScope;
    setAutoAddAccounts(enabled);
    if (scope) setAutoSyncScope(scope);

    setUpdatingAutoSync(true);
    const toastId = toast.loading("Updating auto-sync configuration...");
    try {
      const res = await updateAutoSyncSettingsAction({
        connectionId: connection.id,
        autoAddAccounts: enabled,
        autoSyncScope: nextScope,
      });
      if (res.success) {
        toast.success(
          enabled
            ? `Auto-sync enabled (${nextScope === "ALL" ? "Sync All Accounts" : "Sync Active Accounts Only"}).`
            : "Auto-sync disabled. Manual account linking mode active.",
          { id: toastId },
        );
      } else {
        toast.error(res.error || "Failed to update auto-sync settings.", {
          id: toastId,
        });
      }
    } catch (err: any) {
      toast.error(err.message || "An unexpected error occurred.", {
        id: toastId,
      });
    } finally {
      setUpdatingAutoSync(false);
    }
  };

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
        toast.success("Google Ads accounts metadata refreshed successfully!", {
          id: toastId,
        });
        window.location.reload();
      } else {
        toast.error(res.error || "Failed to refresh metadata.", {
          id: toastId,
        });
      }
    } catch (err: any) {
      toast.error(err.message || "An unexpected error occurred.", {
        id: toastId,
      });
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
        const activeIds = accounts
          .filter((a) => a.isActive)
          .map((a) => a.googleAccountId);
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
        toast.success(
          "Accounts selection updated. Background database sync triggered.",
        );
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

  return (
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
              Link and manage your top-level Google Ads Manager (MCC)
              connection.
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
                      Your agency is synchronized with Google Ads.
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
                      {connection.managerCustomerId
                        ? formatCustomerId(connection.managerCustomerId)
                        : "Direct Client Account"}
                    </span>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-100 rounded-lg text-xs">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                    Linked Client Accounts
                  </span>
                  <span className="font-semibold text-slate-800 block mt-1">
                    {accounts.filter((a) => a.isActive).length} active ad
                    accounts synced under this connection.
                  </span>
                </div>

                {connection.managerCustomerId && (
                  <div className="p-4 bg-indigo-50/50 border border-indigo-100 rounded-xl space-y-3">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-indigo-950">
                            Auto-Add & Sync New Accounts
                          </span>
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[10px] px-2 py-0.5 border-none font-semibold",
                              autoAddAccounts
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-slate-200 text-slate-700",
                            )}
                          >
                            {autoAddAccounts ? "Enabled" : "Disabled"}
                          </Badge>
                        </div>
                        <p className="text-[11px] text-slate-600 mt-0.5">
                          Automatically discover and sync client accounts added
                          to your Google Ads Manager (MCC) without manually
                          adding them each time.
                        </p>
                      </div>
                      <Switch
                        checked={autoAddAccounts}
                        disabled={updatingAutoSync}
                        onCheckedChange={(checked) =>
                          handleToggleAutoSync(checked)
                        }
                      />
                    </div>

                    {autoAddAccounts && (
                      <div className="pt-2 border-t border-indigo-100/80 space-y-2">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                          Sync Scope Options
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                          <button
                            type="button"
                            disabled={updatingAutoSync}
                            onClick={() => handleToggleAutoSync(true, "ALL")}
                            className={cn(
                              "p-3 rounded-lg border text-left transition-all cursor-pointer",
                              autoSyncScope === "ALL"
                                ? "bg-white border-indigo-600 ring-2 ring-indigo-600/20 text-indigo-950 shadow-xs"
                                : "bg-slate-50/80 border-slate-200 text-slate-600 hover:bg-white",
                            )}
                          >
                            <div className="font-bold flex items-center justify-between">
                              <span>Auto Sync ALL</span>
                              {autoSyncScope === "ALL" && (
                                <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                              )}
                            </div>
                            <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                              Sync all accounts under your MCC, including paused
                              or inactive accounts.
                            </p>
                          </button>

                          <button
                            type="button"
                            disabled={updatingAutoSync}
                            onClick={() =>
                              handleToggleAutoSync(true, "ACTIVE_ONLY")
                            }
                            className={cn(
                              "p-3 rounded-lg border text-left transition-all cursor-pointer",
                              autoSyncScope === "ACTIVE_ONLY"
                                ? "bg-white border-indigo-600 ring-2 ring-indigo-600/20 text-indigo-950 shadow-xs"
                                : "bg-slate-50/80 border-slate-200 text-slate-600 hover:bg-white",
                            )}
                          >
                            <div className="font-bold flex items-center justify-between">
                              <span>Auto Add & Sync ACTIVE Only</span>
                              {autoSyncScope === "ACTIVE_ONLY" && (
                                <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                              )}
                            </div>
                            <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                              Only automatically sync active (ENABLED) client
                              accounts under your MCC.
                            </p>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Negative Keywording Options */}
                    <div className="pt-4 border-t border-slate-100 space-y-3">
                      <div>
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                          Negative Keywording Options
                        </span>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Configure which match types the AI agent is allowed to
                          suggest. Disabling a match type prevents suggestions
                          of that type from being generated.
                        </p>
                      </div>

                      <div className="flex flex-col sm:flex-row gap-4 pt-1">
                        <label className="flex items-center gap-2.5 text-xs font-semibold text-slate-700 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={broadEnabled}
                            disabled={updatingOptions}
                            onChange={(e) =>
                              handleToggleKeywordOptions(
                                "broad",
                                e.target.checked,
                              )
                            }
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                          />
                          <span>Broad Match</span>
                        </label>

                        <label className="flex items-center gap-2.5 text-xs font-semibold text-slate-700 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={phraseEnabled}
                            disabled={updatingOptions}
                            onChange={(e) =>
                              handleToggleKeywordOptions(
                                "phrase",
                                e.target.checked,
                              )
                            }
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                          />
                          <span>Phrase Match</span>
                        </label>

                        <label className="flex items-center gap-2.5 text-xs font-semibold text-slate-700 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={exactEnabled}
                            disabled={updatingOptions}
                            onChange={(e) =>
                              handleToggleKeywordOptions(
                                "exact",
                                e.target.checked,
                              )
                            }
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                          />
                          <span>Exact Match</span>
                        </label>
                      </div>
                    </div>
                  </div>
                )}

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
                        <RefreshCw
                          className={cn(
                            "w-3.5 h-3.5",
                            refreshingAccounts &&
                              "animate-spin text-indigo-600",
                          )}
                        />
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
                  <p className="font-bold text-slate-800 text-sm">
                    No Connected Google Ads Account
                  </p>
                  <p className="text-xs text-slate-500">
                    Please link a Google Ads account to start monitoring and
                    triaging campaign portfolios.
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
              <Label
                htmlFor="org-name"
                className="text-xs font-bold text-slate-700"
              >
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
                <label
                  htmlFor="auto-join-domain"
                  className="font-semibold text-slate-800 cursor-pointer"
                >
                  Auto-add team members
                </label>
                <p className="text-slate-500 mt-0.5 leading-relaxed">
                  Allow anyone with a{" "}
                  <strong className="text-indigo-600">
                    @{userEmail.split("@")[1] || "domain"}
                  </strong>{" "}
                  email address to automatically join this organization.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-2">
              <div className="space-y-1.5">
                <Label className="text-slate-500 font-bold">
                  Your Email Address
                </Label>
                <Input
                  value={userEmail}
                  disabled
                  className="bg-slate-50 text-slate-500 text-xs h-9 cursor-not-allowed select-none border-slate-100"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-slate-500 font-bold">
                  Membership Role
                </Label>
                <div className="h-9 px-3 border border-slate-100 bg-slate-50 rounded-lg flex items-center">
                  <Badge
                    variant="secondary"
                    className="capitalize text-[10px] rounded-md font-bold px-2 py-0.5"
                  >
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
              <strong>Disconnecting Google Ads</strong> will stop all background
              triages and landing page audits. You can choose to retain imported
              accounts and histories or erase them entirely.
            </p>
            <p>
              Use <strong>Add or Remove Accounts</strong> to link new client
              accounts under your connected manager account or hide accounts you
              no longer want to analyze.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* DISCONNECT CONFIRMATION DIALOG */}
      <Dialog
        open={disconnectDialogOpen}
        onOpenChange={setDisconnectDialogOpen}
      >
        <DialogContent className="max-w-md bg-white border rounded-xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
              Disconnect Google Ads Connection?
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 mt-2">
              This will remove credentials access to Google Ads. All background
              campaign syncing will stop immediately.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <label className="flex items-start gap-3 p-3 bg-slate-50 border rounded-lg cursor-pointer hover:bg-slate-100/50 transition-colors">
              <input
                type="checkbox"
                checked={deleteSyncedData}
                onChange={(e) => setDeleteSyncedData(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-655 focus:ring-indigo-500 cursor-pointer"
              />
              <div className="text-xs">
                <span className="font-bold text-slate-800 block">
                  Delete all synced ad accounts and histories
                </span>
                <span className="text-slate-500 mt-0.5 block">
                  Erases all metric breakdowns, campaign landing pages, audit
                  logs, and keywords permanently.
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
              className="bg-red-650 hover:bg-red-500 text-white font-bold text-xs"
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
              Select which sub-accounts to track. Unchecked accounts will be set
              to inactive and hidden.
            </DialogDescription>
          </DialogHeader>

          {fetchingAccounts ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
              <span className="text-xs">
                Loading sub-accounts from Google Ads...
              </span>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto py-4 space-y-4">
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

              <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950">
                <div className="overflow-x-auto max-h-96">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-900 text-slate-400 uppercase text-[10px] font-bold tracking-wider sticky top-0 border-b border-slate-800 z-10">
                      <tr>
                        <th className="p-3 w-10 text-center">
                          <input
                            type="checkbox"
                            checked={
                              previewAccounts.filter((acc) => {
                                const matchName =
                                  acc.name
                                    .toLowerCase()
                                    .includes(modalSearch.toLowerCase()) ||
                                  acc.id.includes(modalSearch);
                                const matchStatus =
                                  modalStatusFilter === "ALL" ||
                                  (modalStatusFilter === "ACTIVE" &&
                                    acc.status === "ENABLED") ||
                                  (modalStatusFilter === "CANCELLED" &&
                                    acc.status === "CANCELED");
                                return matchName && matchStatus;
                              }).length > 0 &&
                              previewAccounts
                                .filter((acc) => {
                                  const matchName =
                                    acc.name
                                      .toLowerCase()
                                      .includes(modalSearch.toLowerCase()) ||
                                    acc.id.includes(modalSearch);
                                  const matchStatus =
                                    modalStatusFilter === "ALL" ||
                                    (modalStatusFilter === "ACTIVE" &&
                                      acc.status === "ENABLED") ||
                                    (modalStatusFilter === "CANCELLED" &&
                                      acc.status === "CANCELED");
                                  return matchName && matchStatus;
                                })
                                .every((acc) => selectedAccountIds.has(acc.id))
                            }
                            onChange={() => {
                              const filtered = previewAccounts
                                .filter((acc) => {
                                  const matchName =
                                    acc.name
                                      .toLowerCase()
                                      .includes(modalSearch.toLowerCase()) ||
                                    acc.id.includes(modalSearch);
                                  const matchStatus =
                                    modalStatusFilter === "ALL" ||
                                    (modalStatusFilter === "ACTIVE" &&
                                      acc.status === "ENABLED") ||
                                    (modalStatusFilter === "CANCELLED" &&
                                      acc.status === "CANCELED");
                                  return matchName && matchStatus;
                                })
                                .map((acc) => acc.id);
                              const nextSet = new Set(selectedAccountIds);
                              const allSelected = filtered.every((id) =>
                                nextSet.has(id),
                              );
                              if (allSelected) {
                                for (const id of filtered) nextSet.delete(id);
                              } else {
                                for (const id of filtered) nextSet.add(id);
                              }
                              setSelectedAccountIds(nextSet);
                            }}
                            className="h-3.5 w-3.5 rounded border-slate-800 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                          />
                        </th>
                        <th className="p-3 w-28">Status</th>
                        <th className="p-3">Account</th>
                        <th className="p-3 w-44">TZ & Currency</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {previewAccounts.filter((acc) => {
                        const matchName =
                          acc.name
                            .toLowerCase()
                            .includes(modalSearch.toLowerCase()) ||
                          acc.id.includes(modalSearch);
                        const matchStatus =
                          modalStatusFilter === "ALL" ||
                          (modalStatusFilter === "ACTIVE" &&
                            acc.status === "ENABLED") ||
                          (modalStatusFilter === "CANCELLED" &&
                            acc.status === "CANCELED");
                        return matchName && matchStatus;
                      }).length === 0 ? (
                        <tr>
                          <td
                            colSpan={4}
                            className="p-8 text-center text-slate-500 font-medium"
                          >
                            No sub-accounts found.
                          </td>
                        </tr>
                      ) : (
                        previewAccounts
                          .filter((acc) => {
                            const matchName =
                              acc.name
                                .toLowerCase()
                                .includes(modalSearch.toLowerCase()) ||
                              acc.id.includes(modalSearch);
                            const matchStatus =
                              modalStatusFilter === "ALL" ||
                              (modalStatusFilter === "ACTIVE" &&
                                acc.status === "ENABLED") ||
                              (modalStatusFilter === "CANCELLED" &&
                                acc.status === "CANCELED");
                            return matchName && matchStatus;
                          })
                          .map((acc) => {
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
                                <td
                                  className="p-3 text-center"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => {
                                      const nextSet = new Set(
                                        selectedAccountIds,
                                      );
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
                                          ? "text-emerald-400"
                                          : acc.status === "CANCELED"
                                            ? "text-slate-450"
                                            : "text-amber-405"
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
                                <td className="p-3 text-slate-450 leading-normal">
                                  <div className="flex flex-col">
                                    <span className="text-[10px] font-bold text-slate-500">
                                      {acc.currencyCode}
                                    </span>
                                    <span className="text-[10px] truncate max-w-xs">
                                      {acc.timeZone}
                                    </span>
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
              Selected:{" "}
              <strong className="text-indigo-400">
                {selectedAccountIds.size}
              </strong>{" "}
              accounts
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
    </div>
  );
}
