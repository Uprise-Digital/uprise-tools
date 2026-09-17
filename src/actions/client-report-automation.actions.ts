"use server";

import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { db } from "@/db";
import { adAccounts, clientReportSettings, reportSchedules } from "@/db/schema";
import { logAction } from "@/lib/audit";
import { auth } from "@/lib/auth";
import { getAuthOrgContext } from "@/lib/auth-helpers";

export interface ClientReportAutomationOverview {
  isGloballyActive: boolean;
  summary: {
    totalAccounts: number;
    configuredSchedules: number;
    activeSchedules: number;
    pausedSchedules: number;
    lastDispatchedAt: string | null;
  };
  items: ClientReportAccountItem[];
}

export interface ClientReportAccountItem {
  adAccountId: number;
  accountName: string;
  googleAccountId: string;
  hasSchedule: boolean;
  scheduleId: number | null;
  frequency: string;
  dayOfMonth: number | null;
  recipientEmail: string | null;
  ccEmails: string | null;
  useAiSummary: boolean;
  isActive: boolean;
  lastRunAt: string | null;
  createdAt: string | null;
  rawRules: any[];
}

let hasEnsuredSchema = false;

export async function ensureClientReportSettingsSchema() {
  if (hasEnsuredSchema) return;
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "client_report_settings" (
        "id" serial PRIMARY KEY NOT NULL,
        "organization_id" text NOT NULL DEFAULT 'default-org',
        "is_globally_active" boolean NOT NULL DEFAULT true,
        "updated_at" timestamp NOT NULL DEFAULT now()
      );
    `);
    hasEnsuredSchema = true;
  } catch (e) {
    console.warn("ensureClientReportSettingsSchema warning:", e);
  }
}

/**
 * Fetches the overview of client report automations:
 * Global pause state, total counts, and per-account schedules.
 */
export async function getClientReportAutomationOverviewAction(): Promise<{
  success: boolean;
  data: ClientReportAutomationOverview | null;
  error?: string;
}> {
  try {
    await ensureClientReportSettingsSchema();
    let orgId = "default-org";
    try {
      const ctx = await getAuthOrgContext();
      if (ctx?.orgId) {
        orgId = ctx.orgId;
      }
    } catch {
      // Fallback if called outside Next.js request scope
    }

    // 1. Fetch or initialize global settings
    let globalSetting = await db.query.clientReportSettings.findFirst({
      where: eq(clientReportSettings.organizationId, orgId),
    });

    if (!globalSetting) {
      // Create default if not present
      try {
        const [created] = await db
          .insert(clientReportSettings)
          .values({
            organizationId: orgId,
            isGloballyActive: true,
          })
          .returning();
        globalSetting = created;
      } catch {
        // In case of concurrency, re-fetch
        globalSetting = await db.query.clientReportSettings.findFirst({
          where: eq(clientReportSettings.organizationId, orgId),
        });
      }
    }

    const isGloballyActive = globalSetting?.isGloballyActive ?? true;

    // 2. Fetch all active Google Accounts for current org
    const accounts = await db.query.adAccounts.findMany({
      where: eq(adAccounts.isActive, true),
      with: {
        reportSchedules: true,
      },
      orderBy: (acc, { asc }) => [asc(acc.name)],
    });

    // 3. Transform accounts into structured items
    const items: ClientReportAccountItem[] = [];
    let configuredCount = 0;
    let activeCount = 0;
    let pausedCount = 0;
    let latestRunTimestamp: number | null = null;

    for (const acc of accounts) {
      const schedules = (acc as any).reportSchedules || [];
      const primarySchedule = schedules[0] || null;

      const hasSchedule = Boolean(primarySchedule);
      const isActive = hasSchedule ? primarySchedule.isActive : false;

      if (hasSchedule) {
        configuredCount++;
        if (isActive) {
          activeCount++;
        } else {
          pausedCount++;
        }

        if (primarySchedule.lastRunAt) {
          const runTime = new Date(primarySchedule.lastRunAt).getTime();
          if (!latestRunTimestamp || runTime > latestRunTimestamp) {
            latestRunTimestamp = runTime;
          }
        }
      }

      items.push({
        adAccountId: acc.id,
        accountName: acc.name,
        googleAccountId: acc.googleAccountId,
        hasSchedule,
        scheduleId: primarySchedule?.id || null,
        frequency: primarySchedule?.frequency || "MONTHLY",
        dayOfMonth: primarySchedule?.dayOfMonth ?? 1,
        recipientEmail: primarySchedule?.recipientEmail || null,
        ccEmails: primarySchedule?.ccEmails || null,
        useAiSummary: primarySchedule?.useAiSummary ?? true,
        isActive,
        lastRunAt: primarySchedule?.lastRunAt
          ? new Date(primarySchedule.lastRunAt).toISOString()
          : null,
        createdAt: primarySchedule?.createdAt
          ? new Date(primarySchedule.createdAt).toISOString()
          : null,
        rawRules: schedules,
      });
    }

    return {
      success: true,
      data: {
        isGloballyActive,
        summary: {
          totalAccounts: accounts.length,
          configuredSchedules: configuredCount,
          activeSchedules: activeCount,
          pausedSchedules: pausedCount,
          lastDispatchedAt: latestRunTimestamp
            ? new Date(latestRunTimestamp).toISOString()
            : null,
        },
        items,
      },
    };
  } catch (error: any) {
    console.error("getClientReportAutomationOverviewAction error:", error);
    return { success: false, data: null, error: error.message };
  }
}

/**
 * Globally pause or resume all automated client report sending.
 */
export async function toggleGlobalClientReportAction(
  isGloballyActive: boolean,
): Promise<{ success: boolean; error?: string }> {
  try {
    await ensureClientReportSettingsSchema();
    const session = await auth.api.getSession({
      headers: await headers(),
    });
    if (!session) throw new Error("Unauthorized");

    const ctx = await getAuthOrgContext();
    const orgId = ctx?.orgId || "default-org";

    const existing = await db.query.clientReportSettings.findFirst({
      where: eq(clientReportSettings.organizationId, orgId),
    });

    if (existing) {
      await db
        .update(clientReportSettings)
        .set({
          isGloballyActive,
          updatedAt: new Date(),
        })
        .where(eq(clientReportSettings.id, existing.id));
    } else {
      await db.insert(clientReportSettings).values({
        organizationId: orgId,
        isGloballyActive,
      });
    }

    await logAction(
      session.user.id,
      isGloballyActive
        ? "GLOBAL_CLIENT_REPORTS_RESUMED"
        : "GLOBAL_CLIENT_REPORTS_PAUSED",
      "client_report_settings",
      orgId,
      { isGloballyActive },
    );

    revalidatePath("/reports");
    return { success: true };
  } catch (error: any) {
    console.error("toggleGlobalClientReportAction error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Toggle an individual client report schedule on/off.
 */
export async function toggleClientScheduleActiveAction(
  scheduleId: number,
  isActive: boolean,
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });
    if (!session) throw new Error("Unauthorized");

    await db
      .update(reportSchedules)
      .set({
        isActive,
      })
      .where(eq(reportSchedules.id, scheduleId));

    await logAction(
      session.user.id,
      isActive
        ? "CLIENT_REPORT_SCHEDULE_RESUMED"
        : "CLIENT_REPORT_SCHEDULE_PAUSED",
      "report_schedules",
      scheduleId.toString(),
      { scheduleId, isActive },
    );

    revalidatePath("/reports");
    revalidatePath("/accounts");
    return { success: true };
  } catch (error: any) {
    console.error("toggleClientScheduleActiveAction error:", error);
    return { success: false, error: error.message };
  }
}
