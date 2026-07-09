import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import ConnectAdsClient from "./connect-ads-client";

export default async function ConnectAdsPage({
  searchParams,
}: {
  searchParams: Promise<{ orgId?: string; error?: string }>;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/login");
  }

  const { orgId, error } = await searchParams;

  if (!orgId) {
    redirect("/onboarding");
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 text-white relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-indigo-900/10 rounded-full blur-3xl -z-10" />
      <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-violet-900/10 rounded-full blur-3xl -z-10" />

      <div className="max-w-xl w-full space-y-8 bg-slate-900/40 border border-slate-800/80 backdrop-blur-xl p-8 rounded-2xl shadow-2xl relative">
        <ConnectAdsClient orgId={orgId} initialError={error} />
      </div>
    </div>
  );
}
