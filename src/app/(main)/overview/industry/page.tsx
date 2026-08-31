import type { Metadata } from "next";
import IndustryAnalyticsClient from "./pageClient";

export const metadata: Metadata = {
  title: "Industry & Vertical Analytics | Uprise Tools",
  description:
    "Cross-client industry benchmarks, peer group comparisons, and vertical market share.",
};

export default function IndustryAnalyticsPage() {
  return <IndustryAnalyticsClient />;
}
