"use client";

import {
  Check,
  Clock,
  Copy,
  ExternalLink,
  Eye,
  KeyRound,
  Loader2,
  Palette,
  RefreshCw,
  Share2,
  Sliders,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  getAdAccountShareLinkAction,
  regenerateShareTokenAction,
  type ShareLinkConfig,
  saveShareLinkSettingsAction,
  toggleShareLinkActiveAction,
} from "@/actions/share-dashboard.actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";

interface ShareSettingsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  adAccountId: number;
  clientName: string;
}

const COLOR_SWATCHES = [
  { id: "violet", label: "Violet", hex: "#7c3aed", bgClass: "bg-violet-600" },
  { id: "ocean", label: "Ocean Blue", hex: "#2563eb", bgClass: "bg-blue-600" },
  {
    id: "emerald",
    label: "Emerald",
    hex: "#059669",
    bgClass: "bg-emerald-600",
  },
  { id: "amber", label: "Amber", hex: "#d97706", bgClass: "bg-amber-600" },
  { id: "rose", label: "Rose", hex: "#e11d48", bgClass: "bg-rose-600" },
  { id: "slate", label: "Slate", hex: "#334155", bgClass: "bg-slate-700" },
];

export function ShareSettingsSheet({
  open,
  onOpenChange,
  adAccountId,
  clientName,
}: ShareSettingsSheetProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isTogglingStatus, setIsTogglingStatus] = useState(false);
  const [hasCopied, setHasCopied] = useState(false);
  const [config, setConfig] = useState<ShareLinkConfig | null>(null);

  // Form states
  const [themeColor, setThemeColor] = useState("violet");
  const [allowedChannels, setAllowedChannels] = useState("all");
  const [visibleCharts, setVisibleCharts] = useState<string[]>([
    "spend",
    "cpc",
    "ctr",
    "conversions",
  ]);
  const [isPinRequired, setIsPinRequired] = useState(false);
  const [pinCode, setPinCode] = useState("");
  const [expirationOption, setExpirationOption] = useState("never");

  // Load config when sheet opens
  useEffect(() => {
    if (!open) return;
    setIsLoading(true);
    getAdAccountShareLinkAction(adAccountId)
      .then((res) => {
        if (res.success && res.data) {
          setConfig(res.data);
          setThemeColor(res.data.themeColor || "violet");
          setAllowedChannels(res.data.allowedChannels || "all");
          setVisibleCharts(
            res.data.visibleCharts || ["spend", "cpc", "ctr", "conversions"],
          );
          setIsPinRequired(res.data.isPinRequired);
          setPinCode(res.data.pinCode || "");

          if (!res.data.expiresAt) {
            setExpirationOption("never");
          } else {
            const expDate = new Date(res.data.expiresAt);
            const now = new Date();
            const daysLeft = Math.round(
              (expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
            );
            if (daysLeft <= 7) setExpirationOption("7");
            else if (daysLeft <= 30) setExpirationOption("30");
            else if (daysLeft <= 90) setExpirationOption("90");
            else setExpirationOption("never");
          }
        } else {
          toast.error(res.error || "Failed to load share settings.");
        }
      })
      .catch((err) => {
        toast.error("An error occurred loading share settings.");
      })
      .finally(() => setIsLoading(false));
  }, [open, adAccountId]);

  const origin =
    typeof window !== "undefined"
      ? window.location.origin
      : "https://app.uprise-digital.com";
  const shareUrl = config?.token ? `${origin}/share/ad/${config.token}` : "";

  const handleCopyLink = () => {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl);
    setHasCopied(true);
    toast.success("Share link copied to clipboard!");
    setTimeout(() => setHasCopied(false), 2000);
  };

  const handleRegenerate = async () => {
    if (
      !confirm(
        "Are you sure? Anyone with the existing link will immediately lose access.",
      )
    ) {
      return;
    }
    setIsRegenerating(true);
    try {
      const res = await regenerateShareTokenAction(adAccountId);
      if (res.success && res.token) {
        setConfig((prev) => (prev ? { ...prev, token: res.token! } : null));
        toast.success(`Generated new token: ${res.token}`);
      } else {
        toast.error(res.error || "Failed to regenerate token.");
      }
    } catch {
      toast.error("Failed to regenerate token.");
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!config) return;
    const nextState = !config.isActive;
    setIsTogglingStatus(true);
    try {
      const res = await toggleShareLinkActiveAction(adAccountId, nextState);
      if (res.success) {
        setConfig((prev) => (prev ? { ...prev, isActive: nextState } : null));
        toast.success(
          nextState
            ? "Share link reactivated."
            : "Share link revoked. Access is now blocked.",
        );
      } else {
        toast.error(res.error || "Failed to update link status.");
      }
    } catch {
      toast.error("Failed to update link status.");
    } finally {
      setIsTogglingStatus(false);
    }
  };

  const toggleChart = (chartId: string) => {
    setVisibleCharts((prev) =>
      prev.includes(chartId)
        ? prev.filter((c) => c !== chartId)
        : [...prev, chartId],
    );
  };

  const handleSave = async () => {
    if (isPinRequired && (!pinCode || pinCode.trim().length < 4)) {
      toast.error("Please enter a PIN code with at least 4 characters.");
      return;
    }
    if (visibleCharts.length === 0) {
      toast.error("Please select at least one chart to display.");
      return;
    }

    setIsSaving(true);
    try {
      let expiresAt: string | null = null;
      if (expirationOption !== "never") {
        const days = parseInt(expirationOption, 10);
        const exp = new Date();
        exp.setDate(exp.getDate() + days);
        expiresAt = exp.toISOString();
      }

      const res = await saveShareLinkSettingsAction(adAccountId, {
        themeColor,
        allowedChannels,
        visibleCharts,
        isPinRequired,
        pinCode: isPinRequired ? pinCode : null,
        expiresAt,
      });

      if (res.success) {
        toast.success("Share settings saved successfully!");
        onOpenChange(false);
      } else {
        toast.error(res.error || "Failed to save share settings.");
      }
    } catch {
      toast.error("An error occurred while saving.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl overflow-y-auto flex flex-col p-6 space-y-6"
      >
        <SheetHeader className="text-left space-y-1 border-b pb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <Share2 className="w-4 h-4" />
            </div>
            <div>
              <SheetTitle className="text-lg font-semibold">
                Share Client Dashboard
              </SheetTitle>
              <SheetDescription className="text-xs text-muted-foreground">
                Public live reporting link for{" "}
                <span className="font-medium text-foreground">
                  {clientName}
                </span>
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        {isLoading ? (
          <div className="flex-1 flex flex-col items-center justify-center py-16 space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">
              Loading share settings...
            </p>
          </div>
        ) : (
          <div className="flex-1 space-y-6 text-sm">
            {/* Live Link Card */}
            <div className="rounded-xl border bg-muted/30 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-medium text-xs uppercase tracking-wider text-muted-foreground">
                  Public Share Link
                </span>
                <Badge
                  variant={config?.isActive ? "default" : "destructive"}
                  className="text-[11px] px-2 py-0.5 font-normal"
                >
                  {config?.isActive ? "Active" : "Revoked"}
                </Badge>
              </div>

              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={shareUrl}
                  className="font-mono text-xs bg-background select-all"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCopyLink}
                  className="shrink-0"
                >
                  {hasCopied ? (
                    <Check className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                  <span className="ml-1.5 hidden sm:inline">Copy</span>
                </Button>
                {config?.isActive && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="shrink-0 px-2"
                    asChild
                  >
                    <a
                      href={shareUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </Button>
                )}
              </div>

              <div className="flex items-center justify-between pt-1 text-xs">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleRegenerate}
                  disabled={isRegenerating}
                  className="h-8 text-xs text-muted-foreground hover:text-foreground px-2"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 mr-1.5 ${
                      isRegenerating ? "animate-spin" : ""
                    }`}
                  />
                  Regenerate Token
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleToggleStatus}
                  disabled={isTogglingStatus}
                  className={`h-8 text-xs px-2 ${
                    config?.isActive
                      ? "text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/20"
                      : "text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
                  }`}
                >
                  {config?.isActive ? "Revoke Access" : "Reactivate Link"}
                </Button>
              </div>
            </div>

            {/* Access & Security */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 font-medium text-foreground">
                <KeyRound className="w-4 h-4 text-primary" />
                <span>Access & Security</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">
                    Link Expiration
                  </Label>
                  <Select
                    value={expirationOption}
                    onValueChange={setExpirationOption}
                  >
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="Select duration" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="never">Never expires</SelectItem>
                      <SelectItem value="7">Expires in 7 days</SelectItem>
                      <SelectItem value="30">Expires in 30 days</SelectItem>
                      <SelectItem value="90">Expires in 90 days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground">
                      Require PIN Code
                    </Label>
                    <Switch
                      checked={isPinRequired}
                      onCheckedChange={setIsPinRequired}
                    />
                  </div>
                  {isPinRequired ? (
                    <Input
                      type="text"
                      placeholder="e.g. 8492"
                      maxLength={8}
                      value={pinCode}
                      onChange={(e) => setPinCode(e.target.value)}
                      className="h-9 text-xs font-mono"
                    />
                  ) : (
                    <p className="text-[11px] text-muted-foreground pt-2">
                      Anyone with the URL can view without a password.
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Branding & Accent Color */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-2 font-medium text-foreground">
                <Palette className="w-4 h-4 text-primary" />
                <span>Theme Accent Swatch</span>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {COLOR_SWATCHES.map((swatch) => {
                  const isSelected = themeColor === swatch.id;
                  return (
                    <button
                      key={swatch.id}
                      type="button"
                      onClick={() => setThemeColor(swatch.id)}
                      className={`flex flex-col items-center gap-1.5 p-2 rounded-lg border text-xs transition-all ${
                        isSelected
                          ? "border-primary bg-primary/5 shadow-xs font-medium"
                          : "border-border hover:bg-muted/50 text-muted-foreground"
                      }`}
                    >
                      <span
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-white shadow-xs ${swatch.bgClass}`}
                      >
                        {isSelected && <Check className="w-3.5 h-3.5" />}
                      </span>
                      <span className="text-[11px] truncate">
                        {swatch.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Display & Channel Controls */}
            <div className="space-y-4 pt-2">
              <div className="flex items-center gap-2 font-medium text-foreground">
                <Sliders className="w-4 h-4 text-primary" />
                <span>Channels & Visuals</span>
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">
                  Allowed Platform Views
                </Label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "all", label: "Blended & All" },
                    { id: "google", label: "Google Ads Only" },
                    { id: "meta", label: "Meta Ads Only" },
                  ].map((chan) => (
                    <button
                      key={chan.id}
                      type="button"
                      onClick={() => setAllowedChannels(chan.id)}
                      className={`py-2 px-3 rounded-lg border text-xs text-center transition-all ${
                        allowedChannels === chan.id
                          ? "border-primary bg-primary/10 text-primary font-medium"
                          : "border-border hover:bg-muted/50 text-muted-foreground"
                      }`}
                    >
                      {chan.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">
                  Visible Trend Charts
                </Label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: "spend", label: "Cost / Spend" },
                    { id: "cpc", label: "Avg. CPC" },
                    { id: "ctr", label: "Click-Through Rate (CTR)" },
                    { id: "conversions", label: "Conversions" },
                  ].map((chart) => {
                    const isChecked = visibleCharts.includes(chart.id);
                    return (
                      <button
                        key={chart.id}
                        type="button"
                        onClick={() => toggleChart(chart.id)}
                        className={`flex items-center justify-between p-2.5 rounded-lg border text-xs transition-all ${
                          isChecked
                            ? "border-primary/50 bg-primary/5 text-foreground"
                            : "border-border hover:bg-muted/40 text-muted-foreground"
                        }`}
                      >
                        <span>{chart.label}</span>
                        <div
                          className={`w-4 h-4 rounded-sm border flex items-center justify-center ${
                            isChecked
                              ? "bg-primary border-primary text-primary-foreground"
                              : "border-muted-foreground/30"
                          }`}
                        >
                          {isChecked && <Check className="w-3 h-3" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Analytics Stats */}
            <div className="rounded-xl border bg-muted/20 p-3.5 flex items-center justify-between text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <Eye className="w-4 h-4 text-primary" />
                <span>
                  Total Views:{" "}
                  <strong className="text-foreground">
                    {config?.viewCount ?? 0}
                  </strong>
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                <span>
                  {config?.lastViewedAt
                    ? `Last viewed ${new Date(config.lastViewedAt).toLocaleDateString()}`
                    : "Not viewed yet"}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="pt-4 border-t flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={isSaving || isLoading}
          >
            {isSaving && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
            Save Settings
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
