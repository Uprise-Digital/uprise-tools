"use client";

import { Check, Copy, Link2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function CopyMetaIdButton() {
  const metaId = "283748293748923";
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(metaId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy text:", err);
    }
  };

  return (
    <div className="flex items-center gap-2 max-w-sm p-3 bg-slate-900 border border-slate-800/80 rounded-xl mb-4 mt-2">
      <span className="font-mono text-sm text-indigo-400 font-semibold tracking-wider">
        {metaId}
      </span>
      <Button
        size="icon"
        variant="ghost"
        onClick={handleCopy}
        className="ml-auto hover:bg-slate-850 text-slate-400 hover:text-white rounded-lg h-8 w-8"
      >
        {copied ? (
          <Check className="h-4 w-4 text-emerald-400" />
        ) : (
          <Copy className="h-4 w-4" />
        )}
      </Button>
    </div>
  );
}

export function GoogleAdsIdForm() {
  const [googleId, setGoogleId] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = googleId.replace(/[^0-9]/g, "");
    if (cleanId.length !== 10) {
      setError("Please enter a valid 10-Digit Google Ads Customer ID.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Fetch dynamic query params to preserve security context if accessed via portal links
      const urlParams = new URLSearchParams(window.location.search);
      const token = urlParams.get("token") || "";
      const onboardingId = urlParams.get("id") || "";

      const res = await fetch("/api/onboard/submit-ads-id", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ googleAccountId: cleanId, token, onboardingId }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSuccess(true);
      } else {
        setError(
          data.error ||
            "Failed to submit link request. Please verify your ID and try again.",
        );
      }
    } catch (err: any) {
      setError("A connection error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="p-4 bg-indigo-950/20 border border-indigo-500/20 rounded-xl my-4 text-slate-300">
        <p className="font-bold text-white mb-2 flex items-center gap-2 text-sm">
          <Check className="h-4.5 w-4.5 text-indigo-400" /> Connection
          Invitation Sent!
        </p>
        <p className="text-xs leading-relaxed">
          We have successfully sent a linking request to Google Ads account{" "}
          <strong className="text-white font-mono">{googleId}</strong>.<br />
          Please log into your Google Ads dashboard, navigate to{" "}
          <strong>Admin &gt; Access and security &gt; Managers</strong>, and
          accept the pending request from <strong>Uprise Digital</strong>.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="max-w-md p-4 bg-slate-900 border border-slate-800/80 rounded-xl my-4 space-y-3"
    >
      <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
        Google Ads Customer ID
      </label>
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="e.g. 123-456-7890"
          value={googleId}
          onChange={(e) => setGoogleId(e.target.value)}
          className="flex-1 px-3 py-2 bg-slate-950 border border-slate-850 focus:border-indigo-500 text-white rounded-lg text-sm transition-all outline-none"
        />
        <Button
          type="submit"
          disabled={loading}
          className="px-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 text-white font-semibold rounded-lg text-sm flex items-center gap-1.5 cursor-pointer"
        >
          {loading ? (
            <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              <Link2 className="h-4 w-4" /> Link Account
            </>
          )}
        </Button>
      </div>
      {error && <p className="text-xs text-rose-400 font-medium">{error}</p>}
    </form>
  );
}
