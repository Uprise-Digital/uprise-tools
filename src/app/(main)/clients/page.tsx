import type { Metadata } from "next";
import ClientsDirectoryClient from "./pageClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Clients Directory | Uprise Tools",
  description:
    "Manage agency clients, track onboardings, and configure integrations.",
};

export default async function ClientsPage() {
  return <ClientsDirectoryClient />;
}
