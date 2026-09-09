import type { Metadata } from "next";
import { redirect } from "next/navigation";
import ClientsDirectoryClient from "./pageClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Clients Directory | Uprise Tools",
  description:
    "Manage agency clients, track onboardings, and configure integrations.",
};

export default async function ClientsPage({
  searchParams,
}: {
  searchParams?: Promise<{ view?: string }>;
}) {
  const params = await searchParams;
  if (params?.view === "contacts") {
    redirect("/contacts");
  }
  return <ClientsDirectoryClient />;
}
