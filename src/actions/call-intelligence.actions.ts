"use server";

import { and, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { db } from "@/db";
import { callRecords, member } from "@/db/schema";
import { auth } from "@/lib/auth";
import {
  analyzeCallAudioWithGemini,
  fetchGhlCallAudioBuffer,
  syncCallInsightsToGhl,
  syncClientCallHistory,
} from "@/service/call-intelligence-service";
import { getGhlCredentials } from "@/service/gohighlevel-service";

/**
 * Retrieves the active organization context for the current session.
 */
async function getSessionOrgId() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session) throw new Error("Unauthorized");

  let orgId = session.session?.activeOrganizationId;
  if (!orgId) {
    const userMember = await db.query.member.findFirst({
      where: eq(member.userId, session.user.id),
    });
    orgId = userMember?.organizationId;
  }
  return { orgId: orgId || "default-org", userId: session.user.id };
}

/**
 * Fetches all call records for a specific client onboarding.
 */
export async function getClientCallRecordsAction(clientId: number) {
  try {
    const { orgId } = await getSessionOrgId();

    const records = await db
      .select()
      .from(callRecords)
      .where(
        and(
          eq(callRecords.organizationId, orgId),
          eq(callRecords.clientOnboardingId, clientId),
        ),
      )
      .orderBy(desc(callRecords.callStartedAt), desc(callRecords.id));

    return { success: true as const, calls: records };
  } catch (error: any) {
    console.error("Error fetching client call records:", error);
    return {
      success: false as const,
      error: error.message || "Failed to fetch call records",
      calls: [],
    };
  }
}

/**
 * Syncs recent call logs from GoHighLevel for a specific client.
 */
export async function syncClientCallsFromGhlAction(clientId: number) {
  try {
    const { orgId } = await getSessionOrgId();
    const result = await syncClientCallHistory(clientId, orgId);

    revalidatePath("/clients");
    return {
      success: true as const,
      totalFound: result.totalFound,
      totalImported: result.totalImported,
    };
  } catch (error: any) {
    console.error("Error syncing calls from GHL:", error);
    return {
      success: false as const,
      error: error.message || "Failed to sync calls from GHL",
    };
  }
}

/**
 * Triggers AI analysis on a specific call record.
 */
export async function analyzeCallAction(callRecordId: number) {
  try {
    const { orgId } = await getSessionOrgId();

    const [record] = await db
      .select()
      .from(callRecords)
      .where(
        and(
          eq(callRecords.id, callRecordId),
          eq(callRecords.organizationId, orgId),
        ),
      )
      .limit(1);

    if (!record) {
      return { success: false as const, error: "Call record not found" };
    }

    const { apiKey } = await getGhlCredentials(orgId);
    const { buffer, contentType } = await fetchGhlCallAudioBuffer(
      record.ghlMessageId,
      record.ghlLocationId,
      apiKey,
    );

    const analysis = await analyzeCallAudioWithGemini(buffer, contentType, {
      contactName: record.contactName || undefined,
      direction: record.direction,
      duration: record.durationSeconds,
    });

    const [updated] = await db
      .update(callRecords)
      .set({
        transcript: analysis.transcript,
        summary: analysis.summary,
        leadScore: analysis.leadScore,
        sentiment: analysis.sentiment,
        serviceRequested: analysis.serviceRequested,
        estimatedBudget: analysis.estimatedBudget,
        urgency: analysis.urgency,
        objections: analysis.objections,
        keyTakeaways: analysis.keyTakeaways,
        actionItems: analysis.actionItems,
        agentFeedback: analysis.agentFeedback,
        analysisError: null,
        updatedAt: new Date(),
      })
      .where(eq(callRecords.id, callRecordId))
      .returning();

    revalidatePath("/clients");
    return { success: true as const, call: updated };
  } catch (error: any) {
    console.error("Error analyzing call with AI:", error);

    // Save error in DB for user visibility
    await db
      .update(callRecords)
      .set({
        analysisError: error.message || "Analysis failed",
        updatedAt: new Date(),
      })
      .where(eq(callRecords.id, callRecordId))
      .catch(() => {});

    return {
      success: false as const,
      error: error.message || "Failed to analyze call audio",
    };
  }
}

/**
 * Pushes the AI call summary note back into GoHighLevel contact notes.
 */
export async function syncCallNoteToGhlAction(callRecordId: number) {
  try {
    const { orgId } = await getSessionOrgId();
    const result = await syncCallInsightsToGhl(callRecordId, orgId);

    revalidatePath("/clients");
    return { success: true as const, noteId: result.noteId };
  } catch (error: any) {
    console.error("Error syncing note to GHL:", error);
    return {
      success: false as const,
      error: error.message || "Failed to sync note to GHL",
    };
  }
}
