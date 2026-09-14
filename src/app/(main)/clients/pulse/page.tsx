import type { Metadata } from "next";
import StandupPulseBoardClient from "./pageClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Client Retention | Uprise Tools",
  description:
    "Weekly client churn risk, team sentiment consensus, and automated lead performance board for agency retention.",
};

export default function StandupPulsePage() {
  return <StandupPulseBoardClient />;
}
