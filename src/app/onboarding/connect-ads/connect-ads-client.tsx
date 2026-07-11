"use client";

import { useState } from "react";
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

  if (!showChecklist) {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <div className="h-12 w-12 bg-indigo-600/10 text-indigo-400 rounded-full flex items-center justify-center mx-auto mb-4 border border-indigo-500/20">
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
          <h2 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-slate-100 to-slate-300 bg-clip-text text-transparent">
            Connect Google Ads
          </h2>
          <p className="mt-4 text-base text-slate-300 leading-relaxed text-left">
            To pull performance data and run audits, Uprise needs access to your
            Google Ads account. We recommend creating a dedicated Google account
            just for this — it keeps access stable even if staff change, and you
            can revoke it anytime with one click.
          </p>
        </div>

        {initialError && (
          <div className="p-3.5 bg-red-900/30 border border-red-500/20 text-red-200 text-sm rounded-xl">
            <strong>Connection Failed:</strong>{" "}
            {decodeURIComponent(initialError)}
          </div>
        )}

        <div className="flex flex-col gap-3 mt-8">
          <Button
            onClick={() => setShowChecklist(true)}
            className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/10 hover:shadow-indigo-600/20 transition-all text-sm"
          >
            Set up access →
          </Button>

          <Button
            onClick={handleConnectOAuth}
            variant="outline"
            className="w-full py-3.5 bg-slate-900/50 hover:bg-slate-800/80 border-slate-800 text-slate-200 font-semibold rounded-xl transition-all text-sm"
          >
            I already have a dedicated account →
          </Button>
        </div>

        <div className="text-center mt-6">
          <a
            href="https://uprise.digital"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-indigo-400 hover:underline transition-all"
          >
            Why a dedicated account? Read our integration security details.
          </a>
        </div>
      </div>
    );
  }

  // Guided Checklist setup screen
  return (
    <div className="space-y-6">
      <div>
        <button
          onClick={() => setShowChecklist(false)}
          className="text-xs font-semibold text-slate-400 hover:text-white transition-all flex items-center gap-1.5"
        >
          ← Go Back
        </button>
        <h2 className="text-2xl font-extrabold tracking-tight bg-gradient-to-r from-slate-100 to-slate-300 bg-clip-text text-transparent mt-3">
          Set up a dedicated account
        </h2>
        <p className="text-xs font-medium text-indigo-400 uppercase tracking-wider mt-1">
          5 minutes, one-time setup
        </p>
      </div>

      <ol className="space-y-4 text-sm text-slate-300">
        <li className="flex gap-3 items-start">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-800 text-xs font-bold text-slate-200 border border-slate-700/60">
            1
          </span>
          <p className="pt-0.5">
            <strong>Create a new Google account</strong> — don't use a personal
            or founder email. Something like{" "}
            <code className="text-indigo-300 bg-indigo-950/40 px-1.5 py-0.5 rounded border border-indigo-900/30">
              ads-tools@youragency.com
            </code>{" "}
            works well.
          </p>
        </li>
        <li className="flex gap-3 items-start">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-800 text-xs font-bold text-slate-200 border border-slate-700/60">
            2
          </span>
          <p className="pt-0.5">
            Go to your <strong>Google Ads manager account</strong> →{" "}
            <strong>Admin</strong> → <strong>Access and security</strong>.
          </p>
        </li>
        <li className="flex gap-3 items-start">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-800 text-xs font-bold text-slate-200 border border-slate-700/60">
            3
          </span>
          <p className="pt-0.5">
            Click <strong>Invite others</strong>, enter the new account's email,
            and set access level to <strong>Standard</strong>.
          </p>
        </li>
        <li className="flex gap-3 items-start">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-800 text-xs font-bold text-slate-200 border border-slate-700/60">
            4
          </span>
          <p className="pt-0.5">
            <strong>Accept the invite</strong> by signing into that new account
            once (check its inbox).
          </p>
        </li>
        <li className="flex gap-3 items-start">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-800 text-xs font-bold text-slate-200 border border-slate-700/60">
            5
          </span>
          <p className="pt-0.5">
            <strong>Come back here</strong> and click Connect — you'll sign in
            with that same account.
          </p>
        </li>
      </ol>

      <div className="flex flex-col gap-3 mt-8 pt-4 border-t border-slate-800/80">
        <a
          href="https://ads.google.com/aw/users"
          target="_blank"
          rel="noopener noreferrer"
          className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-xl transition-all text-sm flex items-center justify-center gap-2 border border-slate-700/50"
        >
          Open Google Ads Access & Security ↗
        </a>

        <Button
          onClick={handleConnectOAuth}
          className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/10 hover:shadow-indigo-600/20 transition-all text-sm"
        >
          I've completed these steps →
        </Button>
      </div>
    </div>
  );
}
