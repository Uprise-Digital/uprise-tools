"use client";

import {
  Activity,
  AlertTriangle,
  Loader2,
  Save,
  Settings as SettingsIcon,
  SlidersHorizontal,
} from "lucide-react";
import type React from "react";
import { useState } from "react";
import { toast } from "sonner";
import { saveOrgTriageDefaultsAction } from "@/actions/triage-settings.actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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

interface SettingsClientProps {
  initialDefaults: TriageDefaultsData;
}

export default function SettingsClient({
  initialDefaults,
}: SettingsClientProps) {
  const [isSaving, setIsSaving] = useState(false);

  // Use string formState for inputs to support negative signs and decimal points comfortably
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

  return (
    <div className="w-full h-full p-8 font-sans bg-slate-50/50">
      {/* HEADER */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
          <SettingsIcon className="w-7 h-7 text-indigo-600 animate-spin-slow" />
          Agency Settings
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Configure Uprise Digital global workspace parameters, notification
          rules, and algorithm settings.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-2 space-y-6">
          {/* TRIAGE AND ANOMALY DEFAULTS SUBSECTION */}
          <Card className="py-0 border-slate-200 shadow-sm overflow-hidden">
            <CardHeader className="bg-slate-50 border-b border-slate-100 p-5">
              <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-800">
                <SlidersHorizontal className="w-4 h-4 text-indigo-500" />
                Triage and Anomaly Defaults
              </CardTitle>
              <CardDescription className="text-xs">
                Manage global alert logic thresholds. These values serve as
                agency-wide defaults unless overridden at the individual client
                account level.
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
                      <Label htmlFor="criticalConversions" className="text-xs">
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
                        The upper limit of conversions to classify as a critical
                        conversion leak.
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
                          handleInputChange("ctrHighThreshold", e.target.value)
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
                        Minimum spend required to trigger the CTR anomaly check.
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
                          handleInputChange("cpcHighThreshold", e.target.value)
                        }
                        className="text-xs bg-white"
                        required
                      />
                      <p className="text-[10px] text-slate-400">
                        Flags single clicks exceeding this CPC as a budget leak.
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
                        Trigger warning if spend drops by more than this percent
                        (e.g. -30.0).
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
      </div>
    </div>
  );
}
