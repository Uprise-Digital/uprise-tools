"use server";

import { eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { db } from "@/db";
import { briefingSettings, user } from "@/db/schema";
import { logAction } from "@/lib/audit";
import { auth } from "@/lib/auth";

const SYSTEM_ACTOR = "SYSTEM_AUTOMATION";

export async function getBriefingSettingsAction() {
  try {
    const settings = await db.query.briefingSettings.findFirst();

    // Return default structure if no settings are configured yet
    if (!settings) {
      // Fetch default recipients (all team members)
      const team = await db
        .select()
        .from(user)
        .where(ne(user.id, SYSTEM_ACTOR));
      const defaultRecipients = team.map((u) => u.email).filter(Boolean);

      return {
        success: true,
        data: {
          id: null,
          isActive: true,
          sendTime: "07:00",
          recipients: defaultRecipients,
          dataPoints: {
            spend: true,
            conversions: true,
            cpa: true,
            clicks: true,
            impressions: true,
            ctr: true,
            cpc: true,
            anomalies: true,
            whaleAnalysis: true,
          },
        },
      };
    }

    return {
      success: true,
      data: {
        id: settings.id,
        isActive: settings.isActive,
        sendTime: settings.sendTime,
        recipients: settings.recipients as string[],
        dataPoints: settings.dataPoints as {
          spend: boolean;
          conversions: boolean;
          cpa: boolean;
          clicks: boolean;
          impressions: boolean;
          ctr: boolean;
          cpc: boolean;
          anomalies: boolean;
          whaleAnalysis: boolean;
        },
      },
    };
  } catch (error: any) {
    console.error("Failed to fetch briefing settings:", error);
    return { success: false, error: error.message };
  }
}

export async function saveBriefingSettingsAction(data: {
  id?: number | null;
  isActive: boolean;
  sendTime: string;
  recipients: string[];
  dataPoints: {
    spend: boolean;
    conversions: boolean;
    cpa: boolean;
    clicks: boolean;
    impressions: boolean;
    ctr: boolean;
    cpc: boolean;
    anomalies: boolean;
    whaleAnalysis: boolean;
  };
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  try {
    const payload = {
      isActive: data.isActive,
      sendTime: data.sendTime,
      recipients: data.recipients,
      dataPoints: data.dataPoints,
      updatedAt: new Date(),
    };

    if (data.id) {
      await db
        .update(briefingSettings)
        .set(payload)
        .where(eq(briefingSettings.id, data.id));
    } else {
      await db.insert(briefingSettings).values(payload);
    }

    await logAction(
      session.user.id,
      "SAVE_BRIEFING_SETTINGS",
      "briefing_settings",
      data.id?.toString() || "NEW",
      payload,
    );

    revalidatePath("/reports");
    return { success: true };
  } catch (error: any) {
    console.error("Failed to save briefing settings:", error);
    return { success: false, error: error.message };
  }
}
