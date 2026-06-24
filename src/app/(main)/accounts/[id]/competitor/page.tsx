import { db } from "@/db";
import { adAccounts } from "@/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import CompetitorClient from "./pageClient";

export default async function CompetitorThreatPage({ params }: { params: { id: string } }) {
    const accountId = parseInt((await params).id, 10);

    if (isNaN(accountId)) {
        return notFound();
    }

    // Verify the account exists before rendering the page
    const account = await db.query.adAccounts.findFirst({
        where: eq(adAccounts.id, accountId)
    });

    if (!account) {
        return notFound();
    }

    return <CompetitorClient account={account} />;
}