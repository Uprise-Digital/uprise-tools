import { Activity, CheckCircle2 } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { OnboardingStepper } from "@/components/onboarding-stepper";
import { auth } from "@/lib/auth";

export default async function ConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/login");
  }

  const { email } = await searchParams;

  const connectedEmail = email
    ? decodeURIComponent(email)
    : "ads-tools@youragency.com";

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 text-white relative overflow-hidden">
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-indigo-900/10 rounded-full blur-3xl -z-10" />
      <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-violet-900/10 rounded-full blur-3xl -z-10" />

      <div className="max-w-xl w-full space-y-8 bg-slate-900/40 border border-slate-800/80 backdrop-blur-xl p-8 rounded-2xl shadow-2xl relative text-center">
        <OnboardingStepper currentStep={4} />

        <div className="space-y-6">
          <div className="h-16 w-16 bg-emerald-500/10 text-emerald-400 rounded-full flex items-center justify-center mx-auto border border-emerald-500/20 shadow-lg shadow-emerald-500/10">
            <CheckCircle2 className="h-8 w-8 text-emerald-400" />
          </div>

          <div className="space-y-2">
            <h2 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-slate-100 to-slate-300 bg-clip-text text-transparent">
              Onboarding Complete!
            </h2>
            <p className="text-indigo-400 font-semibold text-sm">
              ✅ Connected as {connectedEmail}
            </p>
          </div>

          {/* Sync Status Banner */}
          <div className="p-4 bg-indigo-950/40 border border-indigo-500/30 rounded-xl text-left flex items-start gap-3">
            <Activity className="h-5 w-5 text-indigo-400 shrink-0 mt-0.5 animate-pulse" />
            <div className="text-xs space-y-1">
              <span className="font-bold text-white block">
                Syncing 30-Day Historical Google Ads Data
              </span>
              <p className="text-slate-300">
                Your selected client accounts are importing in the background.
                Metrics, campaign triage settings, and AI threat audits will
                populate automatically in your dashboard.
              </p>
            </div>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed text-left">
            Uprise Tools can now monitor accounts linked to your Google Ads
            manager account. You can manage or revoke access anytime from your{" "}
            <a
              href="https://myaccount.google.com/permissions"
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-400 hover:underline inline-flex items-center gap-0.5"
            >
              Google Account Security page ↗
            </a>
            .
          </p>

          <div className="pt-4">
            <Link
              href="/overview"
              className="w-full py-3.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/20 hover:shadow-indigo-600/40 transition-all text-sm flex items-center justify-center gap-2"
            >
              Launch Agency Command Center →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
