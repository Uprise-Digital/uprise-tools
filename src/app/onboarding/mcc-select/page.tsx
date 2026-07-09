import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getAccessibleManagerAccountsAction } from "@/actions/onboarding.actions";
import MccSelectClient from "./mcc-select-client";
import { db } from "@/db";
import { googleAdsConnections } from "@/db/schema";
import { eq } from "drizzle-orm";

export default async function MccSelectPage({
  searchParams,
}: {
  searchParams: Promise<{ connectionId?: string; orgId?: string }>;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/login");
  }

  const { connectionId, orgId } = await searchParams;

  if (!connectionId || !orgId) {
    redirect("/onboarding");
  }

  const connId = parseInt(connectionId, 10);
  if (isNaN(connId)) {
    redirect("/onboarding");
  }

  // Fetch connection record to retrieve email
  const conn = await db.query.googleAdsConnections.findFirst({
    where: eq(googleAdsConnections.id, connId),
  });

  if (!conn) {
    redirect("/onboarding");
  }

  // Fetch accessible accounts from Google Ads API
  const res = await getAccessibleManagerAccountsAction(connId);

  const accounts = res.success && res.accounts ? res.accounts : [];
  const errorMsg = !res.success ? res.error : null;

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 text-white relative overflow-hidden">
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-900/10 rounded-full blur-3xl -z-10" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-violet-900/10 rounded-full blur-3xl -z-10" />

      <div className="w-full max-w-5xl bg-slate-900/40 border border-slate-800/80 backdrop-blur-xl p-6 sm:p-8 rounded-2xl shadow-2xl relative transition-all duration-300">
        <MccSelectClient
          connectionId={connId}
          orgId={orgId}
          connectedEmail={conn.connectedEmail}
          initialAccounts={accounts}
          fetchError={errorMsg}
        />
      </div>
    </div>
  );
}
