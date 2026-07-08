import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { getAuditDetailAction } from "@/actions/lp-analysis.actions";
import AuditDetailClientPage from "./pageClient";

interface AuditPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function AuditDetailPage({ params }: AuditPageProps) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/login");
  }

  const { id } = await params;
  const auditId = parseInt(id, 10);

  if (Number.isNaN(auditId)) {
    redirect("/lp-analysis");
  }

  const res = await getAuditDetailAction(auditId);

  if (!res.success || !res.data) {
    redirect("/lp-analysis");
  }

  return <AuditDetailClientPage audit={res.data} />;
}
