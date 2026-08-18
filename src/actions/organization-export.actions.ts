"use server";

import { eq, inArray } from "drizzle-orm";
import { headers } from "next/headers";
import { db } from "@/db";
import {
  adAccounts,
  adPerformanceDaily,
  auditLogs,
  clientOnboardings,
  emailLogs,
  member,
  organization,
  organizationEmailTemplates,
  organizationOnboardingSettings,
  reportSchedules,
  user,
} from "@/db/schema";
import { auth } from "@/lib/auth";
import { getAuthOrgContext } from "@/lib/auth-helpers";

export interface ExportOrganizationDataResult {
  success: boolean;
  filename?: string;
  data?: string; // Pretty JSON string payload
  error?: string;
}

/**
 * Compiles and exports all tenant data associated with an organization in compliance
 * with GDPR Article 20 (Right to Data Portability).
 *
 * Access Control: Requires authenticated session with 'owner' or 'admin' role.
 */
export async function exportOrganizationDataAction(): Promise<ExportOrganizationDataResult> {
  try {
    // 1. Verify User Authentication & Active Session Context
    const authCtx = await getAuthOrgContext();
    if (!authCtx) {
      return {
        success: false,
        error: "Unauthorized. Active session not found.",
      };
    }

    const { userId, orgId, role, user: sessionUser } = authCtx;

    // 2. Verify Caller Permissions ('owner' or 'admin')
    if (role.toLowerCase() !== "owner" && role.toLowerCase() !== "admin") {
      return {
        success: false,
        error:
          "Forbidden. Only an Organization Owner or Admin can export tenant data.",
      };
    }

    // 3. Fetch Organization Metadata
    const targetOrg = await db.query.organization.findFirst({
      where: eq(organization.id, orgId),
    });

    if (!targetOrg) {
      return { success: false, error: "Organization not found." };
    }

    // 4. Fetch Onboarding & Integration Settings (Sanitizing raw secret tokens)
    const onboardingSettings =
      await db.query.organizationOnboardingSettings.findFirst({
        where: eq(organizationOnboardingSettings.organizationId, orgId),
      });

    const sanitizedSettings = onboardingSettings
      ? {
          id: onboardingSettings.id,
          ghlLocationId: onboardingSettings.ghlLocationId,
          ghlCompanyId: onboardingSettings.ghlCompanyId,
          notionParentPageId: onboardingSettings.notionParentPageId,
          googleDriveEnabled: onboardingSettings.googleDriveEnabled,
          googleDriveParentFolderId:
            onboardingSettings.googleDriveParentFolderId,
          workflowConfig: onboardingSettings.workflowConfig,
          createdAt: onboardingSettings.createdAt,
          updatedAt: onboardingSettings.updatedAt,
          // Redacted secret indicators
          hasGhlKeyConfigured: !!onboardingSettings.ghlApiKey,
          hasNotionKeyConfigured: !!onboardingSettings.notionApiKey,
          hasGoogleDriveTokenConfigured:
            !!onboardingSettings.googleDriveRefreshToken,
        }
      : null;

    // 5. Fetch Team Members
    const membersList = await db
      .select({
        id: member.id,
        userId: member.userId,
        userName: user.name,
        userEmail: user.email,
        role: member.role,
        createdAt: member.createdAt,
      })
      .from(member)
      .leftJoin(user, eq(member.userId, user.id))
      .where(eq(member.organizationId, orgId));

    // 6. Fetch Client Onboardings
    const clientRecords = await db
      .select()
      .from(clientOnboardings)
      .where(eq(clientOnboardings.organizationId, orgId));

    // 7. Fetch Ad Accounts & Ad Performance Datasets
    const adAccountRecords = await db
      .select()
      .from(adAccounts)
      .where(eq(adAccounts.organizationId, orgId));

    const adAccountIds = adAccountRecords.map((a) => a.id);
    let adPerformanceRecords: any[] = [];

    if (adAccountIds.length > 0) {
      adPerformanceRecords = await db
        .select()
        .from(adPerformanceDaily)
        .where(inArray(adPerformanceDaily.adAccountId, adAccountIds));
    }

    // 8. Fetch Scheduled Reports & Email Delivery Logs
    const schedulesList = await db
      .select()
      .from(reportSchedules)
      .where(eq(reportSchedules.organizationId, orgId));

    const emailLogsList = await db
      .select()
      .from(emailLogs)
      .where(eq(emailLogs.organizationId, orgId));

    // 9. Fetch Custom Email Templates & Audit Logs
    const emailTemplatesList = await db
      .select()
      .from(organizationEmailTemplates)
      .where(eq(organizationEmailTemplates.organizationId, orgId));

    const auditLogsList = await db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.organizationId, orgId));

    // 10. Assemble Complete Data Portability Export Object
    const exportDataPayload = {
      $schema: "https://schema.uprise.tools/v1/tenant-export.json",
      metadata: {
        exportVersion: "1.0.0",
        exportTimestamp: new Date().toISOString(),
        exportedByUserId: userId,
        exportedByUserEmail: sessionUser.email,
        organizationId: targetOrg.id,
        organizationName: targetOrg.name,
        organizationSlug: targetOrg.slug,
      },
      organization: {
        id: targetOrg.id,
        name: targetOrg.name,
        slug: targetOrg.slug,
        logoUrl: targetOrg.logoUrl,
        emailSignature: targetOrg.emailSignature,
        websiteUrl: targetOrg.websiteUrl,
        supportEmail: targetOrg.supportEmail,
        createdAt: targetOrg.createdAt,
      },
      onboardingAndIntegrations: sanitizedSettings,
      teamMembers: membersList,
      clients: clientRecords,
      adAccounts: adAccountRecords,
      adPerformanceDaily: adPerformanceRecords,
      scheduledReports: schedulesList,
      emailLogs: emailLogsList,
      emailTemplates: emailTemplatesList,
      auditLogs: auditLogsList,
    };

    const cleanOrgName = targetOrg.name.replace(/[^a-zA-Z0-9_-]/g, "_");
    const dateStr = new Date().toISOString().split("T")[0];
    const filename = `uprise_data_export_${cleanOrgName}_${dateStr}.json`;

    return {
      success: true,
      filename,
      data: JSON.stringify(exportDataPayload, null, 2),
    };
  } catch (error: any) {
    console.error(
      "[Data Export Error] Failed to export organization data:",
      error,
    );
    return {
      success: false,
      error:
        error.message || "An unexpected error occurred during data export.",
    };
  }
}
