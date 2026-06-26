import type { Metadata } from "next";
import { getBriefingSettingsAction } from "@/actions/briefing-settings.actions";
import { getTeamMembers } from "@/actions/team.actions";
import ReportsClient from "./pageClient";

export const metadata: Metadata = {
  title: "Reports Configuration | Uprise Tools",
  description:
    "Configure daily report automation, recipients, schedules, and metrics.",
};

export default async function ReportsPage() {
  const [settingsRes, teamMembers] = await Promise.all([
    getBriefingSettingsAction(),
    getTeamMembers(),
  ]);

  return (
    <ReportsClient
      initialSettings={
        settingsRes.success && settingsRes.data ? settingsRes.data : null
      }
      teamMembers={teamMembers || []}
    />
  );
}
