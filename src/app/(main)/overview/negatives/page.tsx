import type { Metadata } from "next";
import AgencyNegativesClient from "./pageClient";

export const metadata: Metadata = {
  title: "Agency Negative Keywords Explorer | Uprise Tools",
  description:
    "Agency-wide command centre for Google Ads negative keyword discovery, cross-client waste prevention, and portfolio-wide batch triage.",
};

export default function AgencyNegativesPage() {
  return <AgencyNegativesClient />;
}
