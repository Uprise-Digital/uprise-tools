import type { Metadata } from "next";
import AgencyReportsClient from "./pageClient";

export const metadata: Metadata = {
  title: "Agency God View | Uprise Tools",
  description: "Macro portfolio performance and critical alerts.",
};

export default async function AgencyReportsPage() {
  // You can add server-side auth checks here if needed:
  // const session = await auth();
  // if (!session) redirect('/login');

  return <AgencyReportsClient />;
}
