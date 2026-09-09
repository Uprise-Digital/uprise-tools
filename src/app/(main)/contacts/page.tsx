import type { Metadata } from "next";
import ContactsDirectoryClient from "./pageClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Contacts & Leads | Uprise Tools",
  description:
    "Manage individual contacts, track GHL pipeline stages, call intelligence, and client assignments.",
};

export default async function ContactsPage() {
  return <ContactsDirectoryClient />;
}
