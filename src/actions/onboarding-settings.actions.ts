"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { db } from "@/db";
import { member, organizationOnboardingSettings } from "@/db/schema";
import { auth } from "@/lib/auth";
import { decryptToken, encryptToken } from "@/lib/crypto";
import { verifyDriveFolderAccess } from "@/service/google-drive-service";
import { verifyNotionConnection } from "@/service/notion-service";

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
  return { orgId, userId: session.user.id };
}

const defaultWorkflow = {
  nodes: [
    {
      id: "trigger",
      type: "input",
      data: { label: "Client Onboarded (Start)" },
      position: { x: 50, y: 150 },
    },
    {
      id: "google-drive",
      type: "default",
      data: { label: "Google Drive Automation" },
      position: { x: 300, y: 50 },
    },
    {
      id: "notion",
      type: "default",
      data: { label: "Notion Dashboard Automation" },
      position: { x: 300, y: 250 },
    },
    {
      id: "email",
      type: "output",
      data: { label: "Send Welcome Email" },
      position: { x: 550, y: 150 },
    },
  ],
  edges: [
    { id: "e-trig-drive", source: "trigger", target: "google-drive" },
    { id: "e-trig-notion", source: "trigger", target: "notion" },
    { id: "e-drive-email", source: "google-drive", target: "email" },
    { id: "e-notion-email", source: "notion", target: "email" },
  ],
};

export async function getOnboardingSettingsAction() {
  try {
    const { orgId } = await getSessionOrgId();
    if (!orgId) return { success: false, error: "No active organization" };

    let record = await db.query.organizationOnboardingSettings.findFirst({
      where: eq(organizationOnboardingSettings.organizationId, orgId),
    });

    if (!record) {
      const [newRecord] = await db
        .insert(organizationOnboardingSettings)
        .values({
          organizationId: orgId,
          googleDriveEnabled: false,
          notionEnabled: false,
          googleDriveStatus: "unconfigured",
          notionStatus: "unconfigured",
          workflowConfig: defaultWorkflow,
        })
        .returning();
      record = newRecord;
    }

    let decryptedNotionKey = "";
    if (record.notionApiKey) {
      try {
        decryptedNotionKey = decryptToken(record.notionApiKey);
      } catch (err) {
        console.error("Failed to decrypt Notion API key:", err);
      }
    }

    return {
      success: true,
      data: {
        id: record.id,
        googleDriveEnabled: record.googleDriveEnabled,
        googleDriveParentFolderId: record.googleDriveParentFolderId || "",
        googleDriveTemplateFolderId: record.googleDriveTemplateFolderId || "",
        googleDriveRefreshToken: record.googleDriveRefreshToken || "",
        googleDriveEmail: record.googleDriveEmail || "",
        googleDriveStatus: record.googleDriveStatus,
        googleDriveError: record.googleDriveError || "",
        notionEnabled: record.notionEnabled,
        notionApiKey: decryptedNotionKey ? "••••••••••••••••" : "",
        notionParentPageId: record.notionParentPageId || "",
        notionTemplatePageId: record.notionTemplatePageId || "",
        notionStatus: record.notionStatus,
        notionError: record.notionError || "",
        welcomeEmailSubject: record.welcomeEmailSubject || "",
        welcomeEmailTemplate: record.welcomeEmailTemplate || "",
        workflowConfig: record.workflowConfig || defaultWorkflow,
      },
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Failed to load onboarding settings",
    };
  }
}

export async function disconnectGoogleDriveAction() {
  try {
    const { orgId } = await getSessionOrgId();
    if (!orgId) return { success: false, error: "No active organization" };

    await db
      .update(organizationOnboardingSettings)
      .set({
        googleDriveEmail: null,
        googleDriveRefreshToken: null,
        googleDriveStatus: "unconfigured",
        googleDriveError: null,
        updatedAt: new Date(),
      })
      .where(eq(organizationOnboardingSettings.organizationId, orgId));

    return { success: true };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Failed to disconnect Google Drive",
    };
  }
}

export async function saveOnboardingSettingsAction(data: {
  googleDriveEnabled: boolean;
  googleDriveParentFolderId: string;
  googleDriveTemplateFolderId: string;
  notionEnabled: boolean;
  notionApiKey: string;
  notionParentPageId: string;
  notionTemplatePageId: string;
  welcomeEmailSubject: string;
  welcomeEmailTemplate: string;
  workflowConfig?: any;
}) {
  try {
    const { orgId } = await getSessionOrgId();
    if (!orgId) return { success: false, error: "No active organization" };

    const existing = await db.query.organizationOnboardingSettings.findFirst({
      where: eq(organizationOnboardingSettings.organizationId, orgId),
    });

    let encryptedNotionKey = existing?.notionApiKey || null;
    let actualNotionKey = "";

    if (data.notionApiKey && data.notionApiKey !== "••••••••••••••••") {
      encryptedNotionKey = encryptToken(data.notionApiKey);
      actualNotionKey = data.notionApiKey;
    } else if (existing?.notionApiKey) {
      try {
        actualNotionKey = decryptToken(existing.notionApiKey);
      } catch (err) {
        console.error("Failed to decrypt existing Notion key:", err);
      }
    }

    let notionStatus = "unconfigured";
    let notionError = null;
    if (data.notionEnabled) {
      if (!actualNotionKey || !data.notionParentPageId) {
        notionStatus = "invalid";
        notionError = "Missing Notion API Token or Parent Page ID.";
      } else {
        try {
          await verifyNotionConnection(
            actualNotionKey,
            data.notionParentPageId,
          );
          if (data.notionTemplatePageId) {
            await verifyNotionConnection(
              actualNotionKey,
              data.notionTemplatePageId,
            );
          }
          notionStatus = "valid";
        } catch (err: any) {
          notionStatus = "invalid";
          notionError = err.message || "Notion verification failed.";
        }
      }
    }

    let googleDriveStatus = "unconfigured";
    let googleDriveError = null;
    if (data.googleDriveEnabled) {
      if (!data.googleDriveParentFolderId) {
        googleDriveStatus = "invalid";
        googleDriveError = "Missing Google Drive Parent Folder ID.";
      } else {
        try {
          await verifyDriveFolderAccess(data.googleDriveParentFolderId, orgId);
          if (data.googleDriveTemplateFolderId) {
            await verifyDriveFolderAccess(
              data.googleDriveTemplateFolderId,
              orgId,
            );
          }
          googleDriveStatus = "valid";
        } catch (err: any) {
          googleDriveStatus = "invalid";
          googleDriveError = err.message || "Google Drive verification failed.";
        }
      }
    }

    if (existing) {
      await db
        .update(organizationOnboardingSettings)
        .set({
          googleDriveEnabled: data.googleDriveEnabled,
          googleDriveParentFolderId: data.googleDriveParentFolderId || null,
          googleDriveTemplateFolderId: data.googleDriveTemplateFolderId || null,
          googleDriveStatus,
          googleDriveError,
          notionEnabled: data.notionEnabled,
          notionApiKey: encryptedNotionKey,
          notionParentPageId: data.notionParentPageId || null,
          notionTemplatePageId: data.notionTemplatePageId || null,
          notionStatus,
          notionError,
          welcomeEmailSubject: data.welcomeEmailSubject || null,
          welcomeEmailTemplate: data.welcomeEmailTemplate || null,
          workflowConfig: data.workflowConfig || null,
          updatedAt: new Date(),
        })
        .where(eq(organizationOnboardingSettings.organizationId, orgId));
    } else {
      await db.insert(organizationOnboardingSettings).values({
        organizationId: orgId,
        googleDriveEnabled: data.googleDriveEnabled,
        googleDriveParentFolderId: data.googleDriveParentFolderId || null,
        googleDriveTemplateFolderId: data.googleDriveTemplateFolderId || null,
        googleDriveStatus,
        googleDriveError,
        notionEnabled: data.notionEnabled,
        notionApiKey: encryptedNotionKey,
        notionParentPageId: data.notionParentPageId || null,
        notionTemplatePageId: data.notionTemplatePageId || null,
        notionStatus,
        notionError,
        welcomeEmailSubject: data.welcomeEmailSubject || null,
        welcomeEmailTemplate: data.welcomeEmailTemplate || null,
        workflowConfig: data.workflowConfig || defaultWorkflow,
      });
    }

    revalidatePath("/settings");

    return {
      success: true,
      validation: {
        notionStatus,
        notionError,
        googleDriveStatus,
        googleDriveError,
      },
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Failed to save onboarding settings",
    };
  }
}
