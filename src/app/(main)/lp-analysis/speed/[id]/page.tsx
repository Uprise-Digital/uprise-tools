import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getLandingPageSpeedDataAction } from "@/actions/lp-speed.actions";
import { auth } from "@/lib/auth";
import SpeedTestingClientPage from "./pageClient";

interface SpeedTestingPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function SpeedTestingPage({
  params,
}: SpeedTestingPageProps) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/login");
  }

  const { id } = await params;
  const campaignLpId = parseInt(id, 10);

  if (Number.isNaN(campaignLpId)) {
    redirect("/lp-analysis");
  }

  const res = await getLandingPageSpeedDataAction(campaignLpId);

  if (!res.success || !res.data) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
        <div className="max-w-md w-full bg-white p-8 rounded-2xl border border-slate-200 text-center space-y-4 shadow-sm">
          <div className="h-12 w-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto text-xl font-bold">
            !
          </div>
          <h2 className="text-lg font-bold text-slate-900">
            Unable to Load Speed Test
          </h2>
          <p className="text-sm text-slate-500">
            {res.error ||
              "The requested campaign landing page record could not be found."}
          </p>
          <div className="pt-2">
            <Link
              href="/lp-analysis"
              className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2.5 rounded-lg transition-colors"
            >
              Return to Landing Pages
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <SpeedTestingClientPage initialData={res.data} />;
}
