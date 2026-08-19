"use client";

import { useState } from "react";
import { OnboardingStepper } from "@/components/onboarding-stepper";
import { Button } from "@/components/ui/button";

interface ConnectAdsClientProps {
  orgId: string;
  initialError?: string;
}

export default function ConnectAdsClient({
  orgId,
  initialError,
}: ConnectAdsClientProps) {
  const [showChecklist, setShowChecklist] = useState(false);

  const handleConnectOAuth = () => {
    // Redirect browser to the connect endpoint
    window.location.href = `/api/auth/google-ads/connect?orgId=${orgId}`;
  };

  return (
    <div className="space-y-6">
      <OnboardingStepper currentStep={2} />

      {!showChecklist ? (
        <div className="space-y-6">
          <div className="text-center">
            <div className="h-12 w-12 bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center mx-auto mb-4 border border-indigo-500/20">
              <svg
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Connect Google Ads
            </h2>
            <p className="mt-4 text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed text-left">
              To pull performance data and run audits, Uprise needs access to
              your Google Ads account. We recommend creating a dedicated Google
              account just for this — it keeps access stable even if staff
              change, and you can revoke it anytime with one click.
            </p>
          </div>

          {initialError && (
            <div className="p-3.5 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-500/20 text-red-700 dark:text-red-200 text-sm rounded-xl">
              <strong>Connection Failed:</strong>{" "}
              {decodeURIComponent(initialError)}
            </div>
          )}

          <div className="flex flex-col gap-3 mt-8">
            <Button
              onClick={handleConnectOAuth}
              className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/10 hover:shadow-indigo-600/20 transition-all text-sm cursor-pointer"
            >
              Connect with Google Ads OAuth →
            </Button>

            <Button
              onClick={() => setShowChecklist(true)}
              variant="outline"
              className="w-full py-3.5 bg-slate-100 dark:bg-slate-900/50 hover:bg-slate-200 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 font-semibold rounded-xl transition-all text-sm cursor-pointer"
            >
              View Recommended 5-Minute Setup Guide
            </Button>

            <Button
              type="button"
              onClick={() => (window.location.href = "/overview")}
              variant="ghost"
              className="w-full py-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white font-semibold text-xs cursor-pointer transition-colors"
            >
              Skip for now → Continue to Dashboard
            </Button>
          </div>

          <div className="text-center mt-6">
            <a
              href="/docs"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline transition-all font-medium"
            >
              Why dedicated OAuth access? Read our integration security details.
            </a>
          </div>
        </div>
      ) : (
        // Guided Checklist setup screen
        <div className="space-y-6">
          <div>
            <button
              onClick={() => setShowChecklist(false)}
              className="text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all flex items-center gap-1.5 cursor-pointer"
            >
              ← Go Back
            </button>
            <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white mt-3">
              Set up a dedicated account
            </h2>
            <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mt-1">
              5 minutes, one-time setup
            </p>
          </div>

          <ol className="space-y-4 text-sm text-slate-700 dark:text-slate-300">
            <li className="flex gap-3 items-start">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700">
                1
              </span>
              <p className="pt-0.5">
                <strong>Create a new Google account</strong> — e.g.{" "}
                <code className="text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/40 px-1.5 py-0.5 rounded border border-indigo-200 dark:border-indigo-900/30">
                  ads-tools@youragency.com
                </code>
                .
              </p>
            </li>
            <li className="flex gap-3 items-start">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700">
                2
              </span>
              <p className="pt-0.5">
                Go to your <strong>Google Ads manager account</strong> →{" "}
                <strong>Admin</strong> → <strong>Access and security</strong>.
              </p>
            </li>
            <li className="flex gap-3 items-start">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700">
                3
              </span>
              <p className="pt-0.5">
                Click <strong>Invite others</strong>, enter the new account's
                email, and set access level to <strong>Standard</strong>.
              </p>
            </li>
            <li className="flex gap-3 items-start">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700">
                4
              </span>
              <p className="pt-0.5">
                <strong>Accept the invite</strong> in that account's inbox.
              </p>
            </li>
            <li className="flex gap-3 items-start">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700">
                5
              </span>
              <p className="pt-0.5">
                <strong>Click Connect below</strong> to sign in with that
                account.
              </p>
            </li>
          </ol>

          <div className="flex flex-col gap-3 mt-8 pt-4 border-t border-slate-200 dark:border-slate-800">
            <a
              href="https://ads.google.com/aw/users"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-white font-semibold rounded-xl transition-all text-sm flex items-center justify-center gap-2 border border-slate-300 dark:border-slate-700/50"
            >
              Open Google Ads Access & Security ↗
            </a>

            <Button
              onClick={handleConnectOAuth}
              className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/10 hover:shadow-indigo-600/20 transition-all text-sm cursor-pointer"
            >
              I've completed these steps → Connect OAuth
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
