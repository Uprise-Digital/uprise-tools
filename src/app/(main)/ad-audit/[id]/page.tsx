import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAdCopyAuditDetailsAction } from "@/actions/ad-audit.actions";
import { auth } from "@/lib/auth";
import AdAuditDetailClientPage from "./pageClient";

interface AuditPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function AdAuditDetailPage({ params }: AuditPageProps) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/login");
  }

  const { id } = await params;
  const auditId = parseInt(id, 10);

  if (Number.isNaN(auditId)) {
    redirect("/ad-audit");
  }

  const res = await getAdCopyAuditDetailsAction(auditId);

  if (!res.success || !res.data) {
    redirect("/ad-audit");
  }

  return <AdAuditDetailClientPage audit={res.data as any} />;
}
