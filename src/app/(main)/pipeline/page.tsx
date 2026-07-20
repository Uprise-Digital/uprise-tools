import type { Metadata } from "next";
import {
  getPipelineDashboardDataAction,
  getSalesReminderSettingsAction,
  getTeamMembersAction,
} from "@/actions/pipeline.actions";
import PipelineClient from "./pageClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sales Pipeline Dashboard | Uprise Tools",
  description:
    "Monitor sales opportunities, identify stalled prospects, and review AI revival strategies.",
};

export default async function PipelinePage() {
  const [result, settingsRes, teamRes] = await Promise.all([
    getPipelineDashboardDataAction(),
    getSalesReminderSettingsAction(),
    getTeamMembersAction(),
  ]);

  const defaultSettings = {
    id: 0,
    recipients: [],
    sendTime: "08:00",
    isActive: true,
  };

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
      initialSettings={
        settingsRes.success && settingsRes.data
          ? settingsRes.data
          : defaultSettings
      }
      teamMembers={teamRes.success && teamRes.data ? teamRes.data : []}
      error={!result.success ? (result as any).error : null}
    />
  );
}
