import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { member } from "@/db/schema";
import { eq } from "drizzle-orm";
import OnboardingClient from "./onboarding-client";

export default async function OnboardingPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/login");
  }

  // Check if they already have an organization
  const userMemberships = await db
    .select()
    .from(member)
    .where(eq(member.userId, session.user.id))
    .limit(1);

  if (userMemberships.length > 0) {
    redirect("/overview");
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 text-white relative overflow-hidden">
      {/* Background gradients */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-900/10 rounded-full blur-3xl -z-10" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-violet-900/10 rounded-full blur-3xl -z-10" />

      <div className="max-w-md w-full space-y-8 bg-slate-900/40 border border-slate-800/80 backdrop-blur-xl p-8 rounded-2xl shadow-2xl relative">
        <div className="text-center">
          <div className="inline-flex items-center justify-center p-2.5 bg-indigo-600/10 text-indigo-400 rounded-xl border border-indigo-500/20 mb-4">
            <span className="text-xl font-bold tracking-wider uppercase">Uprise</span>
          </div>
          <h2 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-slate-100 to-slate-300 bg-clip-text text-transparent">
            Let's setup your agency
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            Welcome, {session.user.name}. Let's create your workspace.
          </p>
        </div>

        <OnboardingClient
          initialUser={{
            name: session.user.name,
            email: session.user.email,
          }}
        />
      </div>
    </div>
  );
}
