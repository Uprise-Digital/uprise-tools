"use server";

// actions/account-targets.actions.ts
//
// Writes client-agreed KPI targets to the adAccounts table.
// Separate from triage settings — these are client relationship facts,
// not alerting configuration.
//
// Add this import to app/api/mcp/[transport]/route.ts:
//   import { setAccountTargetsAction, getAccountTargetsAction } from "@/actions/account-targets.actions";
//
// Note: getAccountTargetsAction already exists in agency.actions.ts.
// You can either import from there or move it here for co-location.
// The MCP route currently imports it from agency.actions.ts — no change needed there.

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { db } from "@/db";
import { adAccounts, agencyAiInsightsCache } from "@/db/schema";
import { logAction } from "@/lib/audit";
import { auth } from "@/lib/auth";

export interface AccountTargetsPayload {
  targetCpa: number | null;
  targetRoas: number | null;
  monthlyBudgetCap: number | null;
  targetNotes: string | null;
}

export async function saveAccountTargetsAction(
  accountId: number,
  payload: AccountTargetsPayload,
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) throw new Error("Unauthorized");

    const account = await db.query.adAccounts.findFirst({
      where: eq(adAccounts.id, accountId),
    });

    if (!account) {
      return {
        success: false,
        error: `No account found with ID ${accountId}.`,
      };
    }

    await db
      .update(adAccounts)
      .set({
        targetCpa:
          payload.targetCpa !== null ? String(payload.targetCpa) : null,
        targetRoas:
          payload.targetRoas !== null ? String(payload.targetRoas) : null,
        monthlyBudgetCap:
          payload.monthlyBudgetCap !== null
            ? String(payload.monthlyBudgetCap)
            : null,
        targetNotes: payload.targetNotes,
      })
      .where(eq(adAccounts.id, accountId));

    // Invalidate the agency god view cache — target CPA changes affect fire
    // detection logic, so stale cached insights would now be wrong.
    await db.delete(agencyAiInsightsCache);

    await logAction(
      session.user.id,
      "SAVE_ACCOUNT_TARGETS",
      "ad_accounts",
      accountId,
      payload,
    );

    revalidatePath(`/accounts/${accountId}`);

    return { success: true };
  } catch (error: any) {
    console.error("saveAccountTargetsAction error:", error);
    return { success: false, error: error.message };
  }
}

// MCP-facing version — same logic, different actor label for audit log.
// Called by set_account_targets tool in the MCP route.
export async function setAccountTargetsMcpAction(
  accountId: number,
  payload: AccountTargetsPayload,
) {
  try {
    const account = await db.query.adAccounts.findFirst({
      where: eq(adAccounts.id, accountId),
    });

    if (!account) {
      return {
        success: false,
        error: `No account found with ID ${accountId}.`,
      };
    }

    await db
      .update(adAccounts)
      .set({
        targetCpa:
          payload.targetCpa !== null ? String(payload.targetCpa) : null,
        targetRoas:
          payload.targetRoas !== null ? String(payload.targetRoas) : null,
        monthlyBudgetCap:
          payload.monthlyBudgetCap !== null
            ? String(payload.monthlyBudgetCap)
            : null,
        targetNotes: payload.targetNotes,
      })
      .where(eq(adAccounts.id, accountId));

    // Invalidate god view cache — same reason as above.
    await db.delete(agencyAiInsightsCache);

    await logAction(
      "MCP_AGENT",
      "SAVE_ACCOUNT_TARGETS",
      "ad_accounts",
      accountId,
      payload,
    );

    return {
      success: true,
      message: `Targets for ${account.name} (ID: ${accountId}) saved successfully. Agency god view cache invalidated.`,
      data: { accountId, accountName: account.name, ...payload },
    };
  } catch (error: any) {
    console.error("setAccountTargetsMcpAction error:", error);
    return { success: false, error: error.message };
  }
}
