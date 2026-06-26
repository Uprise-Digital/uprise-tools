import { getOrgTriageDefaultsAction } from "@/actions/triage-settings.actions";
import SettingsClient from "./pageClient";

export default async function SettingsPage() {
  const res = await getOrgTriageDefaultsAction();

  if (!res.success || !res.data) {
    return <div className="p-8 text-rose-500 font-medium">Error loading settings configuration.</div>;
  }

  return <SettingsClient initialDefaults={res.data} />;
}
