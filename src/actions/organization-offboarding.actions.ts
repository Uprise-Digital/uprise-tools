"use server";

import { eq, inArray } from "drizzle-orm";
import { headers } from "next/headers";
import { db } from "@/db";
import { withBypassTenantDb } from "@/db/db-helper";
import {
  adAccounts,
  adPerformanceDaily,
  auditLogs,
  clientOnboardings,
  emailLogs,
  member,
  negativeKeywordSuggestions,
  organization,
  organizationEmailTemplates,
  organizationOnboardingSettings,
  reportSchedules,
} from "@/db/schema";
import { auth } from "@/lib/auth";
import { getAuthOrgContext } from "@/lib/auth-helpers";
import { deleteFileFromR2 } from "@/lib/storage";

export interface DeleteOrganizationResult {
  success: boolean;
  error?: string;
}

/**
 * Permanently deletes an organization and cascades deletion across all associated tenant data
 * for GDPR compliance & tenant offboarding.
 *
 * Requirements:
 * 1. Must be authenticated.
 * 2. Caller must have 'owner' role in the active organization.
 * 3. Requires confirmation string matching "DELETE MY ORGANIZATION".
 */
export async function deleteOrganizationAction(
  confirmationText: string,
): Promise<DeleteOrganizationResult> {
  try {
    // 1. Verify User Authentication & Session Org Context
    const authCtx = await getAuthOrgContext();
    if (!authCtx) {
      return {
        success: false,
        error: "Unauthorized. Active session not found.",
      };
    }

    const { userId, orgId, role } = authCtx;

    // 2. Validate Confirmation String
    if (confirmationText.trim() !== "DELETE MY ORGANIZATION") {
      return {
        success: false,
        error:
          'Confirmation failed. Please type "DELETE MY ORGANIZATION" exactly.',
      };
    }

    // 3. Verify User is an 'owner' of the Organization
    if (role.toLowerCase() !== "owner") {
      return {
        success: false,
        error:
          "Forbidden. Only an Organization Owner can delete the organization.",
      };
    }

    // 4. Fetch Organization Branding to clean up S3/R2 storage assets
    const targetOrg = await db.query.organization.findFirst({
      where: eq(organization.id, orgId),
    });

    if (!targetOrg) {
      return { success: false, error: "Organization not found." };
    }

    // Clean up uploaded logo asset from R2 if present
    if (targetOrg.logoUrl) {
      try {
        await deleteFileFromR2(targetOrg.logoUrl);
      } catch (err) {
        console.warn(
          "[Offboarding Warning] Failed to delete logo asset from R2:",
          err,
        );
      }
    }

    // 5. Execute Cascading Database Erasure via bypass helper
    await withBypassTenantDb(async (tx) => {
      // 5a. Find all Ad Accounts owned by this Organization
      const orgAdAccounts = await tx
        .select({ id: adAccounts.id })
        .from(adAccounts)
        .where(eq(adAccounts.organizationId, orgId));

      const adAccountIds = orgAdAccounts.map((a) => a.id);

      // 5b. Delete Ad Account Dependent Child Tables
      if (adAccountIds.length > 0) {
        await tx
          .delete(adPerformanceDaily)
          .where(inArray(adPerformanceDaily.adAccountId, adAccountIds));

        await tx
          .delete(negativeKeywordSuggestions)
          .where(inArray(negativeKeywordSuggestions.adAccountId, adAccountIds));
      }

      // 5c. Delete Ad Accounts
      await tx.delete(adAccounts).where(eq(adAccounts.organizationId, orgId));

      // 5d. Delete Scheduled Reports
      await tx
        .delete(reportSchedules)
        .where(eq(reportSchedules.organizationId, orgId));

      // 5e. Delete Client Onboardings
      await tx
        .delete(clientOnboardings)
        .where(eq(clientOnboardings.organizationId, orgId));

      // 5f. Delete Onboarding Settings
      await tx
        .delete(organizationOnboardingSettings)
        .where(eq(organizationOnboardingSettings.organizationId, orgId));

      // 5g. Delete Email Templates & Delivery Logs
      await tx
        .delete(organizationEmailTemplates)
        .where(eq(organizationEmailTemplates.organizationId, orgId));

      await tx.delete(emailLogs).where(eq(emailLogs.organizationId, orgId));

      // 5h. Delete Audit Logs
      await tx.delete(auditLogs).where(eq(auditLogs.organizationId, orgId));

      // 5i. Delete Member Junction Records
      await tx.delete(member).where(eq(member.organizationId, orgId));

      // 5j. Delete Organization Record
      await tx.delete(organization).where(eq(organization.id, orgId));
    });

    console.log(
      `[GDPR Offboarding] Permanently deleted organization ${orgId} (${targetOrg.name}) requested by owner ${userId}.`,
    );

    return { success: true };
  } catch (error: any) {
    console.error("[Offboarding Error] Failed to delete organization:", error);
    return {
      success: false,
      error:
        error.message ||
        "An unexpected error occurred during organization offboarding.",
    };
  }
}
