import type { Metadata } from "next";
import ClientDetailPageClient from "./pageClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Client Intelligence & Workspace | Uprise Tools",
  description:
    "View client onboarding workspace, call intelligence recordings, transcripts, and account metrics.",
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ClientDetailPage({ params }: PageProps) {
  const { id } = await params;
  const clientId = parseInt(id, 10);

  return <ClientDetailPageClient clientId={clientId} />;
}
