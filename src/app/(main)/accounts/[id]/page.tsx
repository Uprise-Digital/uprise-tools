// app/admin/accounts/[id]/page.tsx
import { db } from "@/db";
import { adAccounts } from "@/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import ClientDashboard from "./pageClient";

interface PageProps {
    params: { id: string };
}

export default async function AccountDetailPage({ params }: PageProps) {
    const accountId = parseInt((await params).id, 10);

    if (isNaN(accountId)) {
        return notFound();
    }

    const account = await db.query.adAccounts.findFirst({
        where: eq(adAccounts.id, accountId),
    });

    if (!account) {
        return notFound();
    }

    return <ClientDashboard account={account} />;
}