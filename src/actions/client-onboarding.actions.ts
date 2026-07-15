"use server";

import { desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { db } from "@/db";
import {
  adAccounts,
  backgroundTasks,
  clientOnboardings,
  member,
  organizationOnboardingSettings,
} from "@/db/schema";
import { logAction, logEmail } from "@/lib/audit";
import { auth } from "@/lib/auth";
import { decryptToken } from "@/lib/crypto";
import { compileOnboardingEmail } from "@/lib/onboarding-email";
import { updateGhlOpportunityStage } from "@/service/gohighlevel-service";
import { createClientDriveFolder } from "@/service/google-drive-service";
import { createClientNotionDashboard } from "@/service/notion-service";

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
  return { orgId, userId: session.user.id };
}

/**
 * Gets all client onboardings for the active organization.
 */
export async function getClientOnboardingsAction() {
  try {
    const { orgId } = await getSessionOrgId();
    if (!orgId) return { success: false, error: "No active organization" };

    const records = await db.query.clientOnboardings.findMany({
      where: eq(clientOnboardings.organizationId, orgId),
      orderBy: [desc(clientOnboardings.createdAt)],
      with: {
        adAccounts: true,
      },
    });

    return { success: true, clients: records };
  } catch (error: any) {
    console.error("getClientOnboardingsAction error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Creates a new client onboarding entry manually.
 */
export async function createClientOnboardingAction(data: {
  clientName: string;
  primaryContactName: string;
  contactEmail: string;
  googleAdsAccess: boolean;
  metaAdsAccess: boolean;
  ghlContactId?: string;
  ghlOpportunityId?: string;
}) {
  try {
    const { orgId, userId } = await getSessionOrgId();
    if (!orgId) return { success: false, error: "No active organization" };

    const [inserted] = await db
      .insert(clientOnboardings)
      .values({
        organizationId: orgId,
        clientName: data.clientName,
        primaryContactName: data.primaryContactName,
        contactEmail: data.contactEmail,
        googleAdsAccess: data.googleAdsAccess,
        metaAdsAccess: data.metaAdsAccess,
        ghlContactId: data.ghlContactId || null,
        ghlOpportunityId: data.ghlOpportunityId || null,
        status: "draft",
      })
      .returning({ id: clientOnboardings.id });

    if (inserted) {
      await logAction(
        userId,
        "CREATE_CLIENT_ONBOARDING",
        "client_onboardings",
        inserted.id,
        {
          clientName: data.clientName,
        },
      );

      // Auto-trigger folder/link automation in the background
      triggerOnboardingAutomation(inserted.id).catch((err) => {
        console.error("Auto trigger failed:", err);
      });

      revalidatePath("/clients");
      return { success: true, onboardingId: inserted.id };
    }

    return { success: false, error: "Failed to create client" };
  } catch (error: any) {
    console.error("createClientOnboardingAction error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Updates details of an onboarding record.
 */
export async function updateClientOnboardingAction(
  id: number,
  data: Partial<typeof clientOnboardings.$inferInsert>,
) {
  try {
    const { userId } = await getSessionOrgId();

    await db
      .update(clientOnboardings)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(clientOnboardings.id, id));

    await logAction(
      userId,
      "UPDATE_CLIENT_ONBOARDING",
      "client_onboardings",
      id,
      data,
    );

    revalidatePath("/clients");
    return { success: true };
  } catch (error: any) {
    console.error("updateClientOnboardingAction error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Deletes a client onboarding record.
 */
export async function deleteClientOnboardingAction(id: number) {
  try {
    const { userId } = await getSessionOrgId();

    await db.delete(clientOnboardings).where(eq(clientOnboardings.id, id));
    await logAction(
      userId,
      "DELETE_CLIENT_ONBOARDING",
      "client_onboardings",
      id,
    );

    revalidatePath("/clients");
    return { success: true };
  } catch (error: any) {
    console.error("deleteClientOnboardingAction error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Links a connected Ad Account to a client record.
 */
export async function associateAdAccountAction(
  clientId: number,
  adAccountId: number,
) {
  try {
    const { userId } = await getSessionOrgId();

    await db
      .update(adAccounts)
      .set({ clientOnboardingId: clientId })
      .where(eq(adAccounts.id, adAccountId));

    await logAction(
      userId,
      "ASSOCIATE_AD_ACCOUNT",
      "ad_accounts",
      adAccountId,
      { clientId },
    );

    revalidatePath("/clients");
    return { success: true };
  } catch (error: any) {
    console.error("associateAdAccountAction error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Simulates duplicating templates and setting up directories in the background.
 */
export async function triggerOnboardingAutomation(onboardingId: number) {
  const record = await db.query.clientOnboardings.findFirst({
    where: eq(clientOnboardings.id, onboardingId),
  });
  if (!record) throw new Error("Onboarding record not found.");

  // Register in Background Tasks
  const [taskRecord] = await db
    .insert(backgroundTasks)
    .values({
      organizationId: record.organizationId,
      name: `Onboarding Asset Duplication: ${record.clientName}`,
      status: "running",
    })
    .returning({ id: backgroundTasks.id });

  const runTask = async () => {
    try {
      // Simulate creation logs and API delays
      await new Promise((resolve) => setTimeout(resolve, 3000));

      const slug = record.clientName.toLowerCase().replace(/[^a-z0-9]+/g, "-");

      // 1. Fetch organization onboarding settings
      const settings = await db.query.organizationOnboardingSettings.findFirst({
        where: eq(
          organizationOnboardingSettings.organizationId,
          record.organizationId,
        ),
      });

      let driveFolderLink = `https://drive.google.com/drive/folders/mock-folder-${slug}`;
      let notionDashboardLink = `https://notion.so/uprisedigital/Uprise-Digital-x-${slug}-mock-dashboard`;

      // 2. Google Drive folder duplication/creation
      const driveEnabled = settings?.workflowConfig
        ? (settings.workflowConfig as any).nodes?.some(
            (n: any) => n.id === "google-drive",
          )
        : settings
          ? settings.googleDriveEnabled
          : true;
      if (driveEnabled) {
        if (settings?.googleDriveStatus === "invalid") {
          throw new Error(
            `Google Drive integration has invalid credentials: ${settings.googleDriveError}`,
          );
        }
        try {
          driveFolderLink = await createClientDriveFolder(
            record.clientName,
            settings?.googleDriveParentFolderId || undefined,
            settings?.googleDriveTemplateFolderId || undefined,
            record.organizationId,
          );
        } catch (err: any) {
          console.warn(
            `[Onboarding Automation] Live Google Drive folder creation failed: ${err.message}`,
          );
          if (settings) {
            throw new Error(
              `Google Drive folder creation failed: ${err.message}`,
            );
          }
        }
      } else {
        driveFolderLink = "";
      }

      // 3. Notion dashboard creation
      const notionEnabled = settings?.workflowConfig
        ? (settings.workflowConfig as any).nodes?.some(
            (n: any) => n.id === "notion",
          )
        : settings
          ? settings.notionEnabled
          : true;
      if (notionEnabled) {
        if (settings?.notionStatus === "invalid") {
          throw new Error(
            `Notion integration has invalid credentials: ${settings.notionError}`,
          );
        }
        let decryptedKey: string | undefined;
        if (settings?.notionApiKey) {
          try {
            decryptedKey = decryptToken(settings.notionApiKey);
          } catch (err) {
            console.error("Failed to decrypt Notion API key:", err);
          }
        }
        try {
          notionDashboardLink = await createClientNotionDashboard(
            record.clientName,
            decryptedKey,
            settings?.notionParentPageId || undefined,
            settings?.notionTemplatePageId || undefined,
          );
        } catch (err: any) {
          console.warn(
            `[Onboarding Automation] Live Notion dashboard creation failed: ${err.message}`,
          );
          if (settings) {
            throw new Error(`Notion dashboard creation failed: ${err.message}`);
          }
        }
      } else {
        notionDashboardLink = "";
      }

      // 4. Signal Link
      const signalGroupLink = `https://signal.group/#CjVKB-${slug}-mock-chat`;

      await db
        .update(clientOnboardings)
        .set({
          driveFolderLink,
          notionDashboardLink,
          signalGroupLink,
          status: "ready_to_review",
          updatedAt: new Date(),
        })
        .where(eq(clientOnboardings.id, onboardingId));

      if (taskRecord) {
        await db
          .update(backgroundTasks)
          .set({ status: "completed", updatedAt: new Date() })
          .where(eq(backgroundTasks.id, taskRecord.id));
      }
    } catch (err: any) {
      console.error("Onboarding automation error:", err);
      try {
        await db
          .update(clientOnboardings)
          .set({
            status: "failed",
            updatedAt: new Date(),
          })
          .where(eq(clientOnboardings.id, onboardingId));
      } catch (dbErr) {
        console.error(
          "Failed to update client onboarding status to failed:",
          dbErr,
        );
      }
      if (taskRecord) {
        await db
          .update(backgroundTasks)
          .set({
            status: "failed",
            error: err.message || String(err),
            updatedAt: new Date(),
          })
          .where(eq(backgroundTasks.id, taskRecord.id));
      }
    }
  };

  // Run in background unawaited
  runTask();
}

/**
 * Dispatches the customized email via Resend and updates DB state.
 */
export async function sendOnboardingEmailAction(
  onboardingId: number,
  customSubject?: string,
  customHtml?: string,
  customText?: string,
) {
  try {
    const { userId } = await getSessionOrgId();

    const record = await db.query.clientOnboardings.findFirst({
      where: eq(clientOnboardings.id, onboardingId),
    });
    if (!record) return { success: false, error: "Client not found" };

    const settings = await db.query.organizationOnboardingSettings.findFirst({
      where: eq(
        organizationOnboardingSettings.organizationId,
        record.organizationId,
      ),
    });

    const subject =
      customSubject ||
      settings?.welcomeEmailSubject ||
      "Welcome to Uprise Digital - Let's get started!";

    let html = customHtml;
    let text = customText;

    if (!html || !text) {
      if (settings?.welcomeEmailTemplate) {
        // Parse placeholders in custom template
        const variables: Record<string, string> = {
          primary_contact_name: record.primaryContactName,
          client_name: record.clientName,
          drive_link: record.driveFolderLink || "",
          notion_link: record.notionDashboardLink || "",
          signal_link: record.signalGroupLink || "",
        };

        let parsedBody = settings.welcomeEmailTemplate;
        for (const [key, val] of Object.entries(variables)) {
          const regex = new RegExp(`{{\\s*${key}\\s*}}`, "g");
          parsedBody = parsedBody.replace(regex, val);
        }

        text = parsedBody;
        // Simple markdown-to-html conversion for newlines
        html = parsedBody
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/\n/g, "<br />");
      } else {
        const generated = compileOnboardingEmail({
          primaryContactName: record.primaryContactName,
          clientName: record.clientName,
          driveFolderLink: record.driveFolderLink || "",
          notionDashboardLink: record.notionDashboardLink || "",
          signalGroupLink: record.signalGroupLink || "",
          googleAdsAccess: record.googleAdsAccess,
          metaAdsAccess: record.metaAdsAccess,
        });
        html = html || generated.html;
        text = text || generated.text;
      }
    }

    const { Resend } = await import("resend");
    const resend = new Resend(process.env.RESEND_API_KEY!);

    console.log(
      `[Onboarding] Dispatching onboarding email to ${record.contactEmail}`,
    );

    const emailResult = await resend.emails.send({
      from: "Uprise Digital <reports@uprisedigital.com.au>",
      to: [record.contactEmail],
      subject,
      text,
      html,
    });

    if (emailResult.error) {
      await logEmail({
        recipient: record.contactEmail,
        subject,
        emailType: "client_onboarding",
        status: "failed",
        error: emailResult.error.message,
      });
      return { success: false, error: emailResult.error.message };
    }

    // Update Onboarding status to email_sent
    await db
      .update(clientOnboardings)
      .set({
        status: "email_sent",
        emailSentAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(clientOnboardings.id, onboardingId));

    await logEmail({
      recipient: record.contactEmail,
      subject,
      emailType: "client_onboarding",
      status: "success",
      resendId: emailResult.data?.id,
    });

    await logAction(
      userId,
      "SEND_ONBOARDING_EMAIL",
      "client_onboardings",
      onboardingId,
      {
        recipient: record.contactEmail,
        resendId: emailResult.data?.id,
      },
    );

    revalidatePath("/clients");
    return { success: true };
  } catch (error: any) {
    console.error("sendOnboardingEmailAction error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Changes client status to 'completed' and syncs GHL opportunity pipeline.
 */
export async function finalizeOnboardingAction(onboardingId: number) {
  try {
    const { userId } = await getSessionOrgId();

    const record = await db.query.clientOnboardings.findFirst({
      where: eq(clientOnboardings.id, onboardingId),
    });
    if (!record) return { success: false, error: "Client not found" };

    // Update database status to completed
    await db
      .update(clientOnboardings)
      .set({
        status: "completed",
        googleAdsStatus: record.googleAdsAccess ? "pending" : "skipped",
        metaAdsStatus: record.metaAdsAccess ? "pending" : "skipped",
        updatedAt: new Date(),
      })
      .where(eq(clientOnboardings.id, onboardingId));

    // Update GHL Pipeline Stage if opportunity ID exists
    if (record.ghlOpportunityId) {
      // In production we would pass the "Active Client" stage ID (e.g. from environment variable or DB triage settings)
      const activeStageId =
        process.env.GHL_ACTIVE_STAGE_ID || "active_client_stage";
      await updateGhlOpportunityStage(record.ghlOpportunityId, activeStageId);
    }

    await logAction(
      userId,
      "FINALIZE_ONBOARDING",
      "client_onboardings",
      onboardingId,
    );

    revalidatePath("/clients");
    return { success: true };
  } catch (error: any) {
    console.error("finalizeOnboardingAction error:", error);
    return { success: false, error: error.message };
  }
}
