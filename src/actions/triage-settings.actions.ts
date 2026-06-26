"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { db } from "@/db";
import { accountTriageSettings, orgTriageDefaults } from "@/db/schema";
import { logAction } from "@/lib/audit";
import { auth } from "@/lib/auth";

export interface TriageThresholds {
  criticalSpendThreshold: number;
  criticalConversionsThreshold: number;
  ctrHighThreshold: number;
  ctrHighSpendThreshold: number;
  cpcHighThreshold: number;
  anomalySpendChangeThreshold: number;
  anomalyConversionsChangeThreshold: number;
}

export interface AccountTriageOverrides {
  criticalSpendThreshold: number | null;
  criticalConversionsThreshold: number | null;
  ctrHighThreshold: number | null;
  ctrHighSpendThreshold: number | null;
  cpcHighThreshold: number | null;
  anomalySpendChangeThreshold: number | null;
  anomalyConversionsChangeThreshold: number | null;
}

const DEFAULT_THRESHOLDS: TriageThresholds = {
  criticalSpendThreshold: 70.0,
  criticalConversionsThreshold: 0,
  ctrHighThreshold: 7.0,
  ctrHighSpendThreshold: 50.0,
  cpcHighThreshold: 30.0,
  anomalySpendChangeThreshold: -30.0,
  anomalyConversionsChangeThreshold: -25.0,
};

/**
 * Fetch or initialize organization-wide triage defaults
 */
export async function getOrgTriageDefaultsAction() {
  try {
    const defaults = await db.query.orgTriageDefaults.findFirst();

    if (!defaults) {
      return {
        success: true,
        data: {
          id: null,
          ...DEFAULT_THRESHOLDS,
        },
      };
    }

    return {
      success: true,
      data: {
        id: defaults.id,
        criticalSpendThreshold: Number(defaults.criticalSpendThreshold),
        criticalConversionsThreshold: defaults.criticalConversionsThreshold,
        ctrHighThreshold: Number(defaults.ctrHighThreshold),
        ctrHighSpendThreshold: Number(defaults.ctrHighSpendThreshold),
        cpcHighThreshold: Number(defaults.cpcHighThreshold),
        anomalySpendChangeThreshold: Number(defaults.anomalySpendChangeThreshold),
        anomalyConversionsChangeThreshold: Number(defaults.anomalyConversionsChangeThreshold),
      },
    };
  } catch (error: any) {
    console.error("Failed to fetch org triage defaults:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Save or insert organization-wide triage defaults
 */
export async function saveOrgTriageDefaultsAction(data: {
  id?: number | null;
  criticalSpendThreshold: number;
  criticalConversionsThreshold: number;
  ctrHighThreshold: number;
  ctrHighSpendThreshold: number;
  cpcHighThreshold: number;
  anomalySpendChangeThreshold: number;
  anomalyConversionsChangeThreshold: number;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  try {
    const payload = {
      criticalSpendThreshold: data.criticalSpendThreshold,
      criticalConversionsThreshold: data.criticalConversionsThreshold,
      ctrHighThreshold: data.ctrHighThreshold,
      ctrHighSpendThreshold: data.ctrHighSpendThreshold,
      cpcHighThreshold: data.cpcHighThreshold,
      anomalySpendChangeThreshold: data.anomalySpendChangeThreshold,
      anomalyConversionsChangeThreshold: data.anomalyConversionsChangeThreshold,
      updatedAt: new Date(),
    };

    let savedId = data.id;

    if (data.id) {
      await db
        .update(orgTriageDefaults)
        .set(payload)
        .where(eq(orgTriageDefaults.id, data.id));
    } else {
      const [newDefaults] = await db
        .insert(orgTriageDefaults)
        .values(payload)
        .returning();
      savedId = newDefaults.id;
    }

    await logAction(
      session.user.id,
      "SAVE_ORG_TRIAGE_DEFAULTS",
      "org_triage_defaults",
      savedId?.toString() || "NEW",
      payload,
    );

    revalidatePath("/settings");
    return { success: true };
  } catch (error: any) {
    console.error("Failed to save org triage defaults:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Fetch overrides for a specific ad account
 */
export async function getAccountTriageSettingsAction(accountId: number) {
  try {
    const settings = await db.query.accountTriageSettings.findFirst({
      where: eq(accountTriageSettings.adAccountId, accountId),
    });

    if (!settings) {
      return {
        success: true,
        data: null,
      };
    }

    return {
      success: true,
      data: {
        id: settings.id,
        adAccountId: settings.adAccountId,
        criticalSpendThreshold: settings.criticalSpendThreshold !== null ? Number(settings.criticalSpendThreshold) : null,
        criticalConversionsThreshold: settings.criticalConversionsThreshold,
        ctrHighThreshold: settings.ctrHighThreshold !== null ? Number(settings.ctrHighThreshold) : null,
        ctrHighSpendThreshold: settings.ctrHighSpendThreshold !== null ? Number(settings.ctrHighSpendThreshold) : null,
        cpcHighThreshold: settings.cpcHighThreshold !== null ? Number(settings.cpcHighThreshold) : null,
        anomalySpendChangeThreshold: settings.anomalySpendChangeThreshold !== null ? Number(settings.anomalySpendChangeThreshold) : null,
        anomalyConversionsChangeThreshold: settings.anomalyConversionsChangeThreshold !== null ? Number(settings.anomalyConversionsChangeThreshold) : null,
      },
    };
  } catch (error: any) {
    console.error(`Failed to fetch account triage settings for account ${accountId}:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Save overrides for a specific ad account
 */
export async function saveAccountTriageSettingsAction(
  accountId: number,
  data: {
    id?: number | null;
    criticalSpendThreshold: number | null;
    criticalConversionsThreshold: number | null;
    ctrHighThreshold: number | null;
    ctrHighSpendThreshold: number | null;
    cpcHighThreshold: number | null;
    anomalySpendChangeThreshold: number | null;
    anomalyConversionsChangeThreshold: number | null;
  },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  try {
    const payload = {
      adAccountId: accountId,
      criticalSpendThreshold: data.criticalSpendThreshold,
      criticalConversionsThreshold: data.criticalConversionsThreshold,
      ctrHighThreshold: data.ctrHighThreshold,
      ctrHighSpendThreshold: data.ctrHighSpendThreshold,
      cpcHighThreshold: data.cpcHighThreshold,
      anomalySpendChangeThreshold: data.anomalySpendChangeThreshold,
      anomalyConversionsChangeThreshold: data.anomalyConversionsChangeThreshold,
      updatedAt: new Date(),
    };

    let savedId = data.id;

    if (data.id) {
      await db
        .update(accountTriageSettings)
        .set(payload)
        .where(eq(accountTriageSettings.id, data.id));
    } else {
      // Check if it already exists to avoid unique constraint violation on adAccountId
      const existing = await db.query.accountTriageSettings.findFirst({
        where: eq(accountTriageSettings.adAccountId, accountId),
      });

      if (existing) {
        await db
          .update(accountTriageSettings)
          .set(payload)
          .where(eq(accountTriageSettings.id, existing.id));
        savedId = existing.id;
      } else {
        const [newSettings] = await db
          .insert(accountTriageSettings)
          .values(payload)
          .returning();
        savedId = newSettings.id;
      }
    }

    await logAction(
      session.user.id,
      "SAVE_ACCOUNT_TRIAGE_SETTINGS",
      "account_triage_settings",
      savedId?.toString() || "NEW",
      payload,
    );

    revalidatePath(`/accounts/${accountId}`);
    return { success: true };
  } catch (error: any) {
    console.error(`Failed to save account triage settings for account ${accountId}:`, error);
    return { success: false, error: error.message };
  }
}
