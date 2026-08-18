"use server";

import { desc, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { after } from "next/server";
import { db } from "@/db";
import {
  adAccounts,
  backgroundTasks,
  clientOnboardings,
  member,
  organization,
  organizationOnboardingSettings,
} from "@/db/schema";
import { logAction, logEmail } from "@/lib/audit";
import { auth } from "@/lib/auth";
import { decryptToken } from "@/lib/crypto";
import { compileOnboardingEmail } from "@/lib/onboarding-email";
import {
  addGhlContactTag,
  createContactNote,
  createGhlContact,
  createGhlSubAccount,
  createGhlTask,
  updateGhlOpportunityStage,
} from "@/service/gohighlevel-service";

import { createClientDriveFolder } from "@/service/google-drive-service";
import { createClientNotionDashboard } from "@/service/notion-service";

function getActiveWorkflowChain(edges: any[]): string[] {
  if (!Array.isArray(edges)) return ["trigger"];
  const activeIds: string[] = ["trigger"];
  let currentId = "trigger";
  const visited = new Set<string>([currentId]);

  while (true) {
    const outgoing = edges.filter((e: any) => e.source === currentId);
    if (outgoing.length === 0) {
      break;
    }
    const nextId = outgoing[0].target;
    if (!nextId || visited.has(nextId)) {
      break;
    }
    visited.add(nextId);
    activeIds.push(nextId);
    currentId = nextId;
  }
  return activeIds;
}

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

    // Auto-migrate new GHL columns if missing in Postgres DB schema
    try {
      await db.execute(
        sql`ALTER TABLE "client_onboardings" ADD COLUMN IF NOT EXISTS "ghl_sub_account_id" text;
            ALTER TABLE "client_onboardings" ADD COLUMN IF NOT EXISTS "ghl_status" text DEFAULT 'pending';
            ALTER TABLE "client_onboardings" ADD COLUMN IF NOT EXISTS "ghl_error" text;`,
      );
    } catch (migErr) {
      console.warn("GHL columns migration check warning:", migErr);
    }

    let records: any[] = [];
    try {
      records = await db.query.clientOnboardings.findMany({
        where: eq(clientOnboardings.organizationId, orgId),
        orderBy: [desc(clientOnboardings.createdAt)],
        with: {
          adAccounts: true,
        },
      });
    } catch (queryErr) {
      console.warn("Retrying clientOnboardings query fallback:", queryErr);
      records = await db.query.clientOnboardings.findMany({
        where: eq(clientOnboardings.organizationId, orgId),
        orderBy: [desc(clientOnboardings.createdAt)],
      });
    }

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
      after(() => {
        triggerOnboardingAutomation(inserted.id).catch((err) => {
          console.error("Auto trigger failed:", err);
        });
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
/**
 * Shared engine that executes the onboarding pipeline steps synchronously.
 */
async function executeOnboardingPipeline(
  onboardingId: number,
  taskRecordId?: number,
) {
  const record = await db.query.clientOnboardings.findFirst({
    where: eq(clientOnboardings.id, onboardingId),
  });
  if (!record) throw new Error("Onboarding record not found.");

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

    let driveFolderLink = "";
    let notionDashboardLink = "";

    const rawEdges = (settings?.workflowConfig as any)?.edges || [];
    const activeChain = getActiveWorkflowChain(rawEdges);

    // 2. Google Drive folder duplication/creation
    const driveEnabled = settings?.workflowConfig
      ? activeChain.includes("google-drive")
      : settings
        ? settings.googleDriveEnabled
        : true;
    if (driveEnabled) {
      if (settings?.googleDriveStatus === "invalid") {
        throw new Error(
          `Google Drive integration has invalid credentials: ${settings.googleDriveError}`,
        );
      }

      const driveNode = (settings?.workflowConfig as any)?.nodes?.find(
        (n: any) => n.id === "google-drive",
      );
      const driveData = driveNode?.data || {};

      const mode = driveData.mode || "empty-folder";
      const parentFolderId =
        driveData.parentFolderId ||
        settings?.googleDriveParentFolderId ||
        undefined;
      const templateFolderId =
        driveData.templateFolderId ||
        settings?.googleDriveTemplateFolderId ||
        undefined;

      const options = {
        mode,
        folderNamePattern: driveData.folderNamePattern,
        subfolders: driveData.subfolders,
        shareEmails: driveData.shareEmails ?? "{{contact_email}}",
        shareRole: driveData.shareRole ?? "writer",
        docRules: driveData.docRules,
        clientEmail: record.contactEmail,
      };

      try {
        driveFolderLink = await createClientDriveFolder(
          record.clientName,
          parentFolderId,
          templateFolderId,
          record.organizationId,
          options,
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
      ? activeChain.includes("notion")
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

      const notionNode = (settings?.workflowConfig as any)?.nodes?.find(
        (n: any) => n.id === "notion",
      );
      const notionData = notionNode?.data || {};

      const mode = notionData.mode || "create-blank-page";
      const parentPageId =
        notionData.parentPageId || settings?.notionParentPageId || undefined;
      const templatePageId =
        notionData.templatePageId ||
        settings?.notionTemplatePageId ||
        undefined;

      const options = {
        mode,
        pageNamePattern: notionData.pageNamePattern,
        pageIcon: notionData.pageIcon,
      };

      try {
        notionDashboardLink = await createClientNotionDashboard(
          record.clientName,
          decryptedKey,
          parentPageId,
          templatePageId,
          options,
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

    // 4. GoHighLevel CRM Automation Execution
    const ghlEnabled = settings?.workflowConfig
      ? activeChain.includes("ghl")
      : false;
    if (ghlEnabled) {
      const ghlIntegrations =
        (settings?.workflowConfig as any)?.integrations || {};
      let ghlApiKey = ghlIntegrations.ghlApiKey;
      if (settings?.ghlApiKey) {
        try {
          ghlApiKey = decryptToken(settings.ghlApiKey);
        } catch (err) {
          console.error("Failed to decrypt GHL API key from settings:", err);
        }
      }
      const ghlLocationId =
        settings?.ghlLocationId || ghlIntegrations.ghlLocationId;
      const ghlCompanyId =
        settings?.ghlCompanyId || ghlIntegrations.ghlCompanyId;

      const ghlNode = (settings?.workflowConfig as any)?.nodes?.find(
        (n: any) => n.id === "ghl",
      );
      const ghlData = ghlNode?.data || {};
      const mode = ghlData.mode || "update-opportunity-stage";

      try {
        await db
          .update(clientOnboardings)
          .set({ ghlStatus: "in_progress", ghlError: null })
          .where(eq(clientOnboardings.id, onboardingId));

        if (
          mode === "create-sub-account" ||
          mode === "create-sub-account-from-template"
        ) {
          const subAcc = await createGhlSubAccount({
            name: record.clientName,
            timezone: ghlData.timezone || "Australia/Sydney",
            country: ghlData.country || "AU",
            address: ghlData.address || "",
            city: ghlData.city || "",
            snapshotId: ghlData.snapshotId || undefined,
            apiKey: ghlApiKey,
            companyId: ghlCompanyId,
          });
          await db
            .update(clientOnboardings)
            .set({
              ghlSubAccountId: subAcc.id,
              ghlStatus: "success",
              ghlError: null,
            })
            .where(eq(clientOnboardings.id, onboardingId));
          console.log(
            `[GHL Automation] Created Sub-Account ${subAcc.id} (${subAcc.name})${
              ghlData.snapshotId ? ` from Snapshot ${ghlData.snapshotId}` : ""
            }`,
          );
        } else if (mode === "create-contact") {
          const createdContact = await createGhlContact({
            name: record.primaryContactName || record.clientName,
            email: record.contactEmail,
            tags: ghlData.tagNaming
              ? [ghlData.tagNaming]
              : ["onboarded-client"],
            locationId: ghlLocationId,
            apiKey: ghlApiKey,
          });
          await db
            .update(clientOnboardings)
            .set({
              ghlContactId: createdContact?.id || record.ghlContactId,
              ghlStatus: "success",
              ghlError: null,
            })
            .where(eq(clientOnboardings.id, onboardingId));
        } else if (mode === "add-tag") {
          const contactId = record.ghlContactId;
          const tag = ghlData.tagNaming || "onboarded-client";
          if (contactId) {
            await addGhlContactTag(contactId, tag, ghlApiKey);
            await db
              .update(clientOnboardings)
              .set({ ghlStatus: "success", ghlError: null })
              .where(eq(clientOnboardings.id, onboardingId));
          } else {
            throw new Error(
              "No ghlContactId found on client onboarding record",
            );
          }
        } else if (mode === "create-contact-note") {
          const contactId = record.ghlContactId;
          let body =
            ghlData.noteTemplate ||
            "Client {{client_name}} onboarded via Uprise Tools.";
          body = body
            .replace(/\{\{\s*client_name\s*\}\}/g, record.clientName)
            .replace(
              /\{\{\s*primary_contact_name\s*\}\}/g,
              record.primaryContactName,
            )
            .replace(/\{\{\s*contact_email\s*\}\}/g, record.contactEmail);
          if (contactId) {
            await createContactNote(contactId, body, ghlApiKey);
            await db
              .update(clientOnboardings)
              .set({ ghlStatus: "success", ghlError: null })
              .where(eq(clientOnboardings.id, onboardingId));
          } else {
            throw new Error(
              "No ghlContactId found on client onboarding record",
            );
          }
        } else if (mode === "create-task") {
          const contactId = record.ghlContactId;
          let title =
            ghlData.taskTitle || "Onboarding Task for {{client_name}}";
          let body =
            ghlData.taskBody ||
            "Complete onboarding setup for {{client_name}}.";
          title = title.replace(
            /\{\{\s*client_name\s*\}\}/g,
            record.clientName,
          );
          body = body
            .replace(/\{\{\s*client_name\s*\}\}/g, record.clientName)
            .replace(
              /\{\{\s*primary_contact_name\s*\}\}/g,
              record.primaryContactName,
            );

          const dueDays = parseInt(ghlData.dueDays || "7", 10);
          const dueDate = new Date(
            Date.now() + (isNaN(dueDays) ? 7 : dueDays) * 24 * 60 * 60 * 1000,
          ).toISOString();

          if (contactId) {
            await createGhlTask(
              contactId,
              {
                title,
                body,
                dueDate,
              },
              ghlApiKey,
            );
            await db
              .update(clientOnboardings)
              .set({ ghlStatus: "success", ghlError: null })
              .where(eq(clientOnboardings.id, onboardingId));
          } else {
            throw new Error(
              "No ghlContactId found on client onboarding record",
            );
          }
        } else if (mode === "update-opportunity-stage") {
          const opportunityId = record.ghlOpportunityId;
          const stageId = ghlData.targetStageId;
          if (opportunityId && stageId) {
            await updateGhlOpportunityStage(opportunityId, stageId, ghlApiKey);
            await db
              .update(clientOnboardings)
              .set({ ghlStatus: "success", ghlError: null })
              .where(eq(clientOnboardings.id, onboardingId));
          }
        }
      } catch (ghlErr: any) {
        console.error(`[GHL Automation Error]: ${ghlErr.message}`);
        await db
          .update(clientOnboardings)
          .set({
            ghlStatus: "failed",
            ghlError: ghlErr.message || String(ghlErr),
          })
          .where(eq(clientOnboardings.id, onboardingId));
      }
    }

    // 5. Signal Link
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

    if (taskRecordId) {
      await db
        .update(backgroundTasks)
        .set({ status: "completed", updatedAt: new Date() })
        .where(eq(backgroundTasks.id, taskRecordId));
    }
    revalidatePath("/clients");
  } catch (err: any) {
    console.error("Onboarding automation error:", err);
    try {
      await db
        .update(clientOnboardings)
        .set({
          status: "failed",
          driveFolderLink: "",
          notionDashboardLink: "",
          signalGroupLink: "",
          updatedAt: new Date(),
        })
        .where(eq(clientOnboardings.id, onboardingId));
    } catch (dbErr) {
      console.error(
        "Failed to update client onboarding status to failed:",
        dbErr,
      );
    }
    if (taskRecordId) {
      await db
        .update(backgroundTasks)
        .set({
          status: "failed",
          error: err.message || String(err),
          updatedAt: new Date(),
        })
        .where(eq(backgroundTasks.id, taskRecordId));
    }
    revalidatePath("/clients");
    throw err;
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

  // Run in background unawaited and decoupled from request store
  after(() => {
    executeOnboardingPipeline(onboardingId, taskRecord.id).catch((err) => {
      console.error("Pipeline background execution failed:", err);
    });
  });
}

/**
 * Manually executes the onboarding pipeline synchronously.
 */
export async function runOnboardingPipelineAction(onboardingId: number) {
  try {
    const { orgId } = await getSessionOrgId();
    if (!orgId) return { success: false, error: "No active organization" };

    const record = await db.query.clientOnboardings.findFirst({
      where: eq(clientOnboardings.id, onboardingId),
    });
    if (!record)
      return { success: false, error: "Onboarding record not found." };

    // Update status to "generating"
    await db
      .update(clientOnboardings)
      .set({ status: "generating", updatedAt: new Date() })
      .where(eq(clientOnboardings.id, onboardingId));

    // Execute synchronously
    await executeOnboardingPipeline(onboardingId);

    // Fetch the updated record
    const updated = await db.query.clientOnboardings.findFirst({
      where: eq(clientOnboardings.id, onboardingId),
    });

    return {
      success: true,
      driveFolderLink: updated?.driveFolderLink || "",
      notionDashboardLink: updated?.notionDashboardLink || "",
      signalGroupLink: updated?.signalGroupLink || "",
      status: updated?.status || "ready_to_review",
    };
  } catch (err: any) {
    console.error("runOnboardingPipelineAction error:", err);
    return { success: false, error: err.message || "Failed to run pipeline." };
  }
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
        const orgRecord = await db.query.organization.findFirst({
          where: eq(organization.id, record.organizationId),
        });
        const orgName = orgRecord?.brandName || orgRecord?.name || "Agency";

        const generated = compileOnboardingEmail({
          primaryContactName: record.primaryContactName,
          clientName: record.clientName,
          driveFolderLink: record.driveFolderLink || "",
          notionDashboardLink: record.notionDashboardLink || "",
          signalGroupLink: record.signalGroupLink || "",
          googleAdsAccess: record.googleAdsAccess,
          metaAdsAccess: record.metaAdsAccess,
          orgName,
          emailSignature: orgRecord?.emailSignature || undefined,
          websiteUrl: orgRecord?.websiteUrl || undefined,
          logoUrl: orgRecord?.logoUrl || orgRecord?.logo || undefined,
        });
        html = html || generated.html;
        text = text || generated.text;
      }
    }

    const { sendSystemEmail } = await import("@/lib/email-service");

    console.log(
      `[Onboarding] Dispatching onboarding email to ${record.contactEmail}`,
    );

    const emailResult = await sendSystemEmail({
      organizationId: record.organizationId,
      templateKey: "onboarding_welcome",
      to: record.contactEmail,
      replyTo: settings?.welcomeEmailReplyTo || undefined,
      customSubject: subject,
      customHtml: html,
      variables: {
        primary_contact_name: record.primaryContactName,
        client_name: record.clientName,
        drive_link: record.driveFolderLink || "",
        notion_link: record.notionDashboardLink || "",
        signal_link: record.signalGroupLink || "",
      },
    });

    if (!emailResult.success) {
      return { success: false, error: emailResult.error };
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

    await logAction(
      userId,
      "SEND_ONBOARDING_EMAIL",
      "client_onboardings",
      onboardingId,
      {
        recipient: record.contactEmail,
        resendId: emailResult.resendId,
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

/**
 * Retries the configured GHL automation task for a client onboarding record.
 */
export async function retryGhlAutomationAction(onboardingId: number) {
  try {
    const record = await db.query.clientOnboardings.findFirst({
      where: eq(clientOnboardings.id, onboardingId),
    });
    if (!record) return { success: false, error: "Client record not found" };

    const settings = await db.query.organizationOnboardingSettings.findFirst({
      where: eq(
        organizationOnboardingSettings.organizationId,
        record.organizationId,
      ),
    });
    if (!settings)
      return { success: false, error: "Onboarding settings not found" };

    await db
      .update(clientOnboardings)
      .set({ ghlStatus: "in_progress", ghlError: null })
      .where(eq(clientOnboardings.id, onboardingId));

    const ghlIntegrations =
      (settings.workflowConfig as any)?.integrations || {};
    const ghlApiKey = ghlIntegrations.ghlApiKey;
    const ghlLocationId = ghlIntegrations.ghlLocationId;
    const ghlCompanyId = ghlIntegrations.ghlCompanyId;

    const ghlNode = (settings.workflowConfig as any)?.nodes?.find(
      (n: any) => n.id === "ghl",
    );
    const ghlData = ghlNode?.data || {};
    const mode = ghlData.mode || "update-opportunity-stage";

    if (
      mode === "create-sub-account" ||
      mode === "create-sub-account-from-template"
    ) {
      const subAcc = await createGhlSubAccount({
        name: record.clientName,
        timezone: ghlData.timezone || "Australia/Sydney",
        country: ghlData.country || "AU",
        address: ghlData.address || "",
        city: ghlData.city || "",
        snapshotId: ghlData.snapshotId || undefined,
        apiKey: ghlApiKey,
        companyId: ghlCompanyId,
      });
      await db
        .update(clientOnboardings)
        .set({
          ghlSubAccountId: subAcc.id,
          ghlStatus: "success",
          ghlError: null,
        })
        .where(eq(clientOnboardings.id, onboardingId));
    } else if (mode === "create-contact") {
      const createdContact = await createGhlContact({
        name: record.primaryContactName || record.clientName,
        email: record.contactEmail,
        tags: ghlData.tagNaming ? [ghlData.tagNaming] : ["onboarded-client"],
        locationId: ghlLocationId,
        apiKey: ghlApiKey,
      });
      await db
        .update(clientOnboardings)
        .set({
          ghlContactId: createdContact?.id || record.ghlContactId,
          ghlStatus: "success",
          ghlError: null,
        })
        .where(eq(clientOnboardings.id, onboardingId));
    } else if (mode === "add-tag") {
      const contactId = record.ghlContactId;
      const tag = ghlData.tagNaming || "onboarded-client";
      if (!contactId)
        throw new Error("No GHL Contact ID found for client record");
      await addGhlContactTag(contactId, tag, ghlApiKey);
      await db
        .update(clientOnboardings)
        .set({ ghlStatus: "success", ghlError: null })
        .where(eq(clientOnboardings.id, onboardingId));
    } else if (mode === "create-contact-note") {
      const contactId = record.ghlContactId;
      if (!contactId)
        throw new Error("No GHL Contact ID found for client record");
      let body =
        ghlData.noteTemplate ||
        "Client {{client_name}} onboarded via Uprise Tools.";
      body = body
        .replace(/\{\{\s*client_name\s*\}\}/g, record.clientName)
        .replace(
          /\{\{\s*primary_contact_name\s*\}\}/g,
          record.primaryContactName,
        )
        .replace(/\{\{\s*contact_email\s*\}\}/g, record.contactEmail);
      await createContactNote(contactId, body, ghlApiKey);
      await db
        .update(clientOnboardings)
        .set({ ghlStatus: "success", ghlError: null })
        .where(eq(clientOnboardings.id, onboardingId));
    } else if (mode === "create-task") {
      const contactId = record.ghlContactId;
      if (!contactId)
        throw new Error("No GHL Contact ID found for client record");
      let title = ghlData.taskTitle || "Onboarding Task for {{client_name}}";
      let body =
        ghlData.taskBody || "Complete onboarding setup for {{client_name}}.";
      title = title.replace(/\{\{\s*client_name\s*\}\}/g, record.clientName);
      body = body
        .replace(/\{\{\s*client_name\s*\}\}/g, record.clientName)
        .replace(
          /\{\{\s*primary_contact_name\s*\}\}/g,
          record.primaryContactName,
        );

      const dueDays = parseInt(ghlData.dueDays || "7", 10);
      const dueDate = new Date(
        Date.now() + (isNaN(dueDays) ? 7 : dueDays) * 24 * 60 * 60 * 1000,
      ).toISOString();

      await createGhlTask(contactId, { title, body, dueDate }, ghlApiKey);
      await db
        .update(clientOnboardings)
        .set({ ghlStatus: "success", ghlError: null })
        .where(eq(clientOnboardings.id, onboardingId));
    } else if (mode === "update-opportunity-stage") {
      const oppId = record.ghlOpportunityId;
      if (!oppId)
        throw new Error("No GHL Opportunity ID found for client record");
      const stageId = ghlData.targetStageId || ghlData.stageId;
      await updateGhlOpportunityStage(oppId, stageId, ghlApiKey);
      await db
        .update(clientOnboardings)
        .set({ ghlStatus: "success", ghlError: null })
        .where(eq(clientOnboardings.id, onboardingId));
    }

    revalidatePath("/clients");
    return { success: true };
  } catch (err: any) {
    console.error("retryGhlAutomationAction error:", err);
    await db
      .update(clientOnboardings)
      .set({
        ghlStatus: "failed",
        ghlError: err.message || String(err),
      })
      .where(eq(clientOnboardings.id, onboardingId));
    revalidatePath("/clients");
    return { success: false, error: err.message || String(err) };
  }
}
