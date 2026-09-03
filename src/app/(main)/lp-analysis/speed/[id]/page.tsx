import { headers } from "next/headers";
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
    redirect("/lp-analysis");
  }

  return <SpeedTestingClientPage initialData={res.data} />;
}
