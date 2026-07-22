"use client";

import {
  BookOpen,
  Database,
  History,
  Mail,
  Settings as SettingsIcon,
  SlidersHorizontal,
  Sparkles,
  XCircle,
} from "lucide-react";
import React, { useEffect, useState } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AiUsageTab } from "./components/AiUsageTab";
import { AuditTab } from "./components/AuditTab";
import { EmailsTab } from "./components/EmailsTab";
import { GeneralTab } from "./components/GeneralTab";
import { OnboardingTab } from "./components/OnboardingTab";
import { TriageTab } from "./components/TriageTab";

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

interface AuditLogData {
  id: number;
  actorId: string | null;
  action: string;
  targetTable: string;
  targetId: string;
  metadata: any;
  createdAt: string;
  actor: {
    id: string;
    name: string;
    email: string;
    image: string | null;
  } | null;
}

interface EmailLogData {
  id: number;
  adAccountId: number | null;
  recipient: string;
  subject: string;
  emailType: string;
  status: string;
  error: string | null;
  resendId: string | null;
  sentAt: string;
  accountName: string | null;
}

interface SettingsClientProps {
  initialDefaults: TriageDefaultsData;
  accounts: AccountSyncData[];
  auditLogs: AuditLogData[];
  emailLogs: EmailLogData[];
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
  orgName: string;
  userEmail: string;
  userRole: string;
  initialAutoJoinDomainEnabled: boolean;
  orgId: string;
  onboardingSettings: {
    id: number;
    googleDriveEnabled: boolean;
    googleDriveParentFolderId: string;
    googleDriveTemplateFolderId: string;
    googleDriveEmail: string;
    googleDriveStatus: string;
    googleDriveError: string;
    notionEnabled: boolean;
    notionApiKey: string;
    notionParentPageId: string;
    notionTemplatePageId: string;
    notionStatus: string;
    notionError: string;
    welcomeEmailSubject: string;
    welcomeEmailTemplate: string;
    workflowConfig: any;
  } | null;
  initialAiUsageStats: any;
}

// React Error Boundary to catch hydration and client-side crashes
class SettingsErrorBoundary extends React.Component<
  { children?: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children?: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("SettingsClient Render Error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 bg-rose-50 border border-rose-200 rounded-xl m-6 text-rose-900 font-sans">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <XCircle className="w-5 h-5 text-rose-600 shrink-0" />
            Client-Side Settings Page Crash
          </h2>
          <p className="text-sm mt-2 font-semibold text-rose-800">
            {this.state.error?.message}
          </p>
          {this.state.error?.stack && (
            <pre className="mt-4 p-4 bg-slate-900 text-slate-200 rounded-lg text-xs font-mono overflow-auto max-h-96 whitespace-pre-wrap">
              {this.state.error.stack}
            </pre>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}

export default function SettingsClient({
  initialDefaults,
  accounts,
  auditLogs,
  emailLogs,
  connection,
  orgName,
  userEmail,
  userRole,
  initialAutoJoinDomainEnabled,
  orgId,
  onboardingSettings,
  initialAiUsageStats,
}: SettingsClientProps) {
  const [activeTab, setActiveTab] = useState<
    "general" | "triage" | "onboarding" | "audit" | "emails" | "ai_usage"
  >("general");

  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <span className="text-xs text-slate-400 font-bold">
          Loading settings panel...
        </span>
      </div>
    );
  }

  return (
    <SettingsErrorBoundary>
      <TooltipProvider>
        <div className="w-full h-full p-8 font-sans bg-slate-50/50">
          {/* HEADER */}
          <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
                <SettingsIcon className="w-7 h-7 text-indigo-600" />
                Agency Settings
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                Configure default thresholds, check live sync health, and review
                audit/delivery logs.
              </p>
            </div>
          </div>

          {/* NAVIGATION TABS */}
          <div className="flex border-b border-slate-200 mb-6 gap-6">
            <button
              type="button"
              className={`pb-3 text-sm font-semibold transition-all border-b-2 px-1 flex items-center gap-2 ${
                activeTab === "general"
                  ? "border-indigo-600 text-indigo-600"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
              onClick={() => setActiveTab("general")}
            >
              <Database className="w-4 h-4" />
              General & Connections
            </button>
            <button
              type="button"
              className={`pb-3 text-sm font-semibold transition-all border-b-2 px-1 flex items-center gap-2 ${
                activeTab === "triage"
                  ? "border-indigo-600 text-indigo-600"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
              onClick={() => setActiveTab("triage")}
            >
              <SlidersHorizontal className="w-4 h-4" />
              Triage Defaults
            </button>
            <button
              type="button"
              className={`pb-3 text-sm font-semibold transition-all border-b-2 px-1 flex items-center gap-2 ${
                activeTab === "onboarding"
                  ? "border-indigo-600 text-indigo-600"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
              onClick={() => setActiveTab("onboarding")}
            >
              <BookOpen className="w-4 h-4" />
              Onboarding Pipeline
            </button>
            <button
              type="button"
              className={`pb-3 text-sm font-semibold transition-all border-b-2 px-1 flex items-center gap-2 ${
                activeTab === "ai_usage"
                  ? "border-indigo-600 text-indigo-600"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
              onClick={() => setActiveTab("ai_usage")}
            >
              <Sparkles className="w-4 h-4" />
              AI Usage
            </button>
            <button
              type="button"
              className={`pb-3 text-sm font-semibold transition-all border-b-2 px-1 flex items-center gap-2 ${
                activeTab === "audit"
                  ? "border-indigo-600 text-indigo-600"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
              onClick={() => setActiveTab("audit")}
            >
              <History className="w-4 h-4" />
              Audit Logs
            </button>
            <button
              type="button"
              className={`pb-3 text-sm font-semibold transition-all border-b-2 px-1 flex items-center gap-2 ${
                activeTab === "emails"
                  ? "border-indigo-600 text-indigo-600"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
              onClick={() => setActiveTab("emails")}
            >
              <Mail className="w-4 h-4" />
              Email Logs
            </button>
          </div>

          {/* TAB CONTENTS */}
          {activeTab === "general" && (
            <GeneralTab
              connection={connection}
              accounts={accounts}
              orgName={orgName}
              userEmail={userEmail}
              userRole={userRole}
              initialAutoJoinDomainEnabled={initialAutoJoinDomainEnabled}
            />
          )}

          {activeTab === "triage" && (
            <TriageTab initialDefaults={initialDefaults} accounts={accounts} />
          )}

          {activeTab === "onboarding" && (
            <OnboardingTab
              onboardingSettings={onboardingSettings}
              orgName={orgName}
              orgId={orgId}
            />
          )}

          {activeTab === "audit" && <AuditTab auditLogs={auditLogs} />}

          {activeTab === "emails" && <EmailsTab emailLogs={emailLogs} />}

          {activeTab === "ai_usage" && (
            <AiUsageTab
              initialStats={initialAiUsageStats}
              orgId={orgId}
              userRole={userRole}
            />
          )}
        </div>
      </TooltipProvider>
    </SettingsErrorBoundary>
  );
}
