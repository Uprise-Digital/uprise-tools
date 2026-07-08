import { db } from "@/db";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import LpAnalysisClientPage from "./pageClient";

export default async function LpAnalysisPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/login");
  }

  // Fetch ad accounts ordered by name
  const accounts = await db.query.adAccounts.findMany({
    where: (table, { eq }) => eq(table.isActive, true),
    orderBy: (table, { asc }) => asc(table.name),
  });

  return <LpAnalysisClientPage accounts={accounts} />;
}
