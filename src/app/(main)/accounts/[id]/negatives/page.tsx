import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { adAccounts } from "@/db/schema";
import NegativesClientWorkspace from "./pageClient";

interface PageProps {
  params: { id: string };
}

export default async function NegativeKeywordsPage({ params }: PageProps) {
  const accountId = parseInt((await params).id, 10);

  if (Number.isNaN(accountId)) {
    return notFound();
  }

  // Fetch target account details
  const account = await db.query.adAccounts.findFirst({
    where: eq(adAccounts.id, accountId),
  });

  if (!account) {
    return notFound();
  }

  const accountData = {
    id: account.id,
    googleAccountId: account.googleAccountId,
    name: account.name,
    negativeKeywordTurboMode: account.negativeKeywordTurboMode,
    targetNotes: account.targetNotes,
  };

  return <NegativesClientWorkspace account={accountData} />;
}
