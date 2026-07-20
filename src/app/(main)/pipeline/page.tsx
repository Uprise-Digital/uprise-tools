import type { Metadata } from "next";
import { getPipelineDashboardDataAction } from "@/actions/pipeline.actions";
import PipelineClient from "./pageClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sales Pipeline Dashboard | Uprise Tools",
  description:
    "Monitor sales opportunities, identify stalled prospects, and review AI revival strategies.",
};

export default async function PipelinePage() {
  const result = await getPipelineDashboardDataAction();

  return (
    <PipelineClient
      initialData={
        result.success && "pipelines" in result
          ? (result as any)
          : {
              pipelines: [],
              selectedPipelineId: "",
              stages: [],
              opportunities: [],
              metrics: {
                totalValue: 0,
                activeCount: 0,
                stalledCount: 0,
                stalledValue: 0,
              },
            }
      }
      error={!result.success ? (result as any).error : null}
    />
  );
}
