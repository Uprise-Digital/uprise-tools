import type { Metadata } from "next";
import { getBriefingSettingsAction } from "@/actions/briefing-settings.actions";
import { getClientReportAutomationOverviewAction } from "@/actions/client-report-automation.actions";
import { getTeamMembers } from "@/actions/team.actions";
import { getWeeklyClientReportSettingsAction } from "@/actions/weekly-client-report.actions";
import ReportsClient from "./pageClient";

export const metadata: Metadata = {
  title: "Reports Configuration | Uprise Tools",
  description:
    "Configure daily report automation, recipients, schedules, and metrics.",
};

export default async function ReportsPage() {
  const [settingsRes, weeklySettingsRes, teamMembers, clientReportOverviewRes] =
    await Promise.all([
      getBriefingSettingsAction(),
      getWeeklyClientReportSettingsAction(),
      getTeamMembers(),
      getClientReportAutomationOverviewAction(),
    ]);

  return (
    <ReportsClient
      initialSettings={
        settingsRes.success && settingsRes.data ? settingsRes.data : null
      }
      initialWeeklySettings={
        weeklySettingsRes.success && weeklySettingsRes.data
          ? weeklySettingsRes.data
          : null
      }
      initialClientReportOverview={
        clientReportOverviewRes.success && clientReportOverviewRes.data
          ? clientReportOverviewRes.data
          : null
      }
      teamMembers={teamMembers || []}
    />
  );
}
