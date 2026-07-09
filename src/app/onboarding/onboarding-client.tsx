"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createOrganizationAction } from "@/actions/onboarding.actions";
import { Button } from "@/components/ui/button";

interface OnboardingClientProps {
  initialUser: {
    name: string;
    email: string;
  };
}

export default function OnboardingClient({ initialUser }: OnboardingClientProps) {
  const router = useRouter();
  const [agencyName, setAgencyName] = useState("");
  const [description, setDescription] = useState("");
  const [autoJoinDomain, setAutoJoinDomain] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const domain = initialUser.email.split("@")[1] || "";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agencyName.trim()) {
      setError("Agency name is required");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await createOrganizationAction({
        name: agencyName,
        description: description,
        autoJoinDomain: autoJoinDomain,
      });

      if (res.success && res.organizationId) {
        router.push(`/onboarding/connect-ads?orgId=${res.organizationId}`);
      } else {
        setError("Failed to create workspace. Please try again.");
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-6">
      {error && (
        <div className="p-3 bg-red-900/30 border border-red-500/20 text-red-200 text-sm rounded-lg">
          {error}
        </div>
      )}

      <div className="space-y-4">
        {/* User Info (Pre-filled from google login) */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Name
            </label>
            <input
              type="text"
              disabled
              value={initialUser.name}
              className="mt-1 block w-full px-3 py-2 bg-slate-950 border border-slate-800 text-slate-500 rounded-lg text-sm cursor-not-allowed"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Email
            </label>
            <input
              type="text"
              disabled
              value={initialUser.email}
              className="mt-1 block w-full px-3 py-2 bg-slate-950 border border-slate-800 text-slate-500 rounded-lg text-sm cursor-not-allowed truncate"
            />
          </div>
        </div>

        {/* Agency Name */}
        <div>
          <label htmlFor="agency-name" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
            Agency Name *
          </label>
          <input
            id="agency-name"
            type="text"
            required
            placeholder="e.g. Uprise Digital"
            value={agencyName}
            onChange={(e) => setAgencyName(e.target.value)}
            className="mt-1 block w-full px-3.5 py-2.5 bg-slate-950/80 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-white rounded-xl text-sm transition-all outline-none"
          />
        </div>

        {/* Agency Description */}
        <div>
          <label htmlFor="agency-desc" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
            Agency Description
          </label>
          <textarea
            id="agency-desc"
            rows={3}
            placeholder="e.g. Full-service digital marketing agency..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="mt-1 block w-full px-3.5 py-2.5 bg-slate-950/80 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-white rounded-xl text-sm transition-all outline-none resize-none"
          />
        </div>

        {/* Domain Auto-Join Toggle */}
        <div className="flex items-start gap-3 p-3.5 bg-slate-950/30 border border-slate-800/60 rounded-xl">
          <input
            id="auto-join"
            type="checkbox"
            checked={autoJoinDomain}
            onChange={(e) => setAutoJoinDomain(e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-slate-800 text-indigo-600 focus:ring-indigo-500 bg-slate-950"
          />
          <div className="text-sm">
            <label htmlFor="auto-join" className="font-semibold text-slate-200 cursor-pointer">
              Auto-add team members
            </label>
            <p className="text-xs text-slate-400 mt-0.5">
              Allow anyone with a <strong className="text-indigo-400">@{domain}</strong> email to join this organization automatically.
            </p>
          </div>
        </div>
      </div>

      <div>
        <Button
          type="submit"
          disabled={loading}
          className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800/80 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/10 hover:shadow-indigo-600/20 transition-all text-sm flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Creating workspace...
            </>
          ) : (
            "Create Organization →"
          )}
        </Button>
      </div>
    </form>
  );
}
