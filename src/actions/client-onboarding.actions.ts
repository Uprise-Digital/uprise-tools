"use server";

import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { after } from "next/server";
import { db } from "@/db";
import {
  adAccounts,
  backgroundTasks,
  callRecords,
  clientOnboardings,
  clients,
  contacts,
  emailLogs,
  member,
  metaAdAccounts,
  organization,
  organizationOnboardingSettings,
} from "@/db/schema";
import { logAction, logEmail } from "@/lib/audit";
import { auth } from "@/lib/auth";
import { getAuthOrgContext } from "@/lib/auth-helpers";
import { decryptToken } from "@/lib/crypto";
import { compileOnboardingEmail } from "@/lib/onboarding-email";
import {
  addGhlContactTag,
  createContactNote,
  createGhlContact,
  createGhlSubAccount,
  createGhlTask,
  syncAllGhlClients,
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
  const ctx = await getAuthOrgContext();
  if (!ctx || !ctx.orgId) throw new Error("Unauthorized: No active organization");
  return { orgId: ctx.orgId, userId: ctx.userId };
}

/**
 * Gets all client onboardings for the active organization.
 */
export async function getClientOnboardingsAction() {
  try {
    const { orgId } = await getSessionOrgId();
    if (!orgId) return { success: false, error: "No active organization" };

    // Auto-migrate new columns and core clients / contacts tables if missing in Postgres DB schema
    try {
      await db.execute(
        sql`CREATE TABLE IF NOT EXISTS "clients" (
              "id" serial PRIMARY KEY,
              "organization_id" text NOT NULL REFERENCES "organization"("id") ON DELETE CASCADE,
              "name" text NOT NULL,
              "legal_business_name" text,
              "industry" text NOT NULL DEFAULT 'OTHER',
              "sub_niche" text,
              "website_url" text,
              "status" text NOT NULL DEFAULT 'active',
              "drive_folder_link" text,
              "notion_dashboard_link" text,
              "signal_group_link" text,
              "ghl_sub_account_id" text,
              "created_at" timestamp NOT NULL DEFAULT now(),
              "updated_at" timestamp NOT NULL DEFAULT now()
            );
            CREATE TABLE IF NOT EXISTS "contacts" (
              "id" serial PRIMARY KEY,
              "organization_id" text NOT NULL REFERENCES "organization"("id") ON DELETE CASCADE,
              "client_id" integer REFERENCES "clients"("id") ON DELETE SET NULL,
              "ghl_contact_id" text,
              "ghl_opportunity_id" text,
              "first_name" text,
              "last_name" text,
              "name" text NOT NULL,
              "email" text,
              "phone" text,
              "job_title" text,
              "is_primary" boolean NOT NULL DEFAULT false,
              "pipeline_stage" text,
              "status" text NOT NULL DEFAULT 'active',
              "created_at" timestamp NOT NULL DEFAULT now(),
              "updated_at" timestamp NOT NULL DEFAULT now()
            );
            ALTER TABLE "client_onboardings" ADD COLUMN IF NOT EXISTS "ghl_sub_account_id" text;
            ALTER TABLE "client_onboardings" ADD COLUMN IF NOT EXISTS "ghl_status" text DEFAULT 'pending';
            ALTER TABLE "client_onboardings" ADD COLUMN IF NOT EXISTS "ghl_error" text;
            ALTER TABLE "ad_accounts" ADD COLUMN IF NOT EXISTS "client_id" integer REFERENCES "clients"("id") ON DELETE SET NULL;
            ALTER TABLE "meta_ad_accounts" ADD COLUMN IF NOT EXISTS "client_onboarding_id" integer REFERENCES "client_onboardings"("id") ON DELETE SET NULL;
            ALTER TABLE "meta_ad_accounts" ADD COLUMN IF NOT EXISTS "client_id" integer REFERENCES "clients"("id") ON DELETE SET NULL;
            ALTER TABLE "call_records" ADD COLUMN IF NOT EXISTS "client_id" integer REFERENCES "clients"("id") ON DELETE SET NULL;
            ALTER TABLE "call_records" ADD COLUMN IF NOT EXISTS "contact_id" integer REFERENCES "contacts"("id") ON DELETE SET NULL;`,
      );
    } catch (migErr) {
      console.warn("DB columns migration check warning:", migErr);
    }

    let records: any[] = [];
    try {
      records = await db.query.clientOnboardings.findMany({
        where: eq(clientOnboardings.organizationId, orgId),
        orderBy: [desc(clientOnboardings.createdAt)],
        with: {
          adAccounts: true,
          metaAdAccounts: true,
        },
      });
    } catch (queryErr) {
      console.warn("Retrying clientOnboardings query fallback:", queryErr);
      records = await db.query.clientOnboardings.findMany({
        where: eq(clientOnboardings.organizationId, orgId),
        orderBy: [desc(clientOnboardings.createdAt)],
      });
    }

    // Fetch call records to attach call metrics to each client
    let allCalls: any[] = [];
    try {
      allCalls = await db
        .select({
          id: callRecords.id,
          clientOnboardingId: callRecords.clientOnboardingId,
          ghlContactId: callRecords.ghlContactId,
          contactPhone: callRecords.contactPhone,
          contactEmail: callRecords.contactEmail,
          callStartedAt: callRecords.callStartedAt,
          leadScore: callRecords.leadScore,
          sentiment: callRecords.sentiment,
          createdAt: callRecords.createdAt,
        })
        .from(callRecords)
        .where(eq(callRecords.organizationId, orgId))
        .orderBy(desc(callRecords.callStartedAt), desc(callRecords.createdAt));
    } catch (callErr) {
      console.warn("Could not fetch callRecords for client overview:", callErr);
    }

    // Map calls by client identifiers
    const enhancedClients = records.map((client) => {
      const clientPhoneClean = (client.contactPhone || "").replace(/\D/g, "");
      const clientEmailClean = (client.contactEmail || "").toLowerCase().trim();

      const matchingCalls = allCalls.filter((call) => {
        if (call.clientOnboardingId === client.id) return true;
        if (client.ghlContactId && call.ghlContactId === client.ghlContactId)
          return true;
        if (
          clientEmailClean &&
          call.contactEmail?.toLowerCase().trim() === clientEmailClean
        )
          return true;
        if (clientPhoneClean && clientPhoneClean.length >= 6) {
          const callPhoneClean = (call.contactPhone || "").replace(/\D/g, "");
          if (
            callPhoneClean &&
            (callPhoneClean.includes(clientPhoneClean) ||
              clientPhoneClean.includes(callPhoneClean))
          ) {
            return true;
          }
        }
        return false;
      });

      const latestCall = matchingCalls[0];

      return {
        ...client,
        callCount: matchingCalls.length,
        lastCallAt: latestCall
          ? latestCall.callStartedAt || latestCall.createdAt
          : null,
        latestLeadScore: latestCall ? latestCall.leadScore : null,
        latestSentiment: latestCall ? latestCall.sentiment : null,
      };
    });

    return { success: true, clients: enhancedClients };
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
      // Also ensure canonical client and contact are created
      try {
        const nameParts = (data.primaryContactName || "").trim().split(/\s+/);
        const [newClient] = await db
          .insert(clients)
          .values({
            organizationId: orgId,
            name: data.clientName.trim(),
            status: "onboarding",
          })
          .returning();

        if (newClient) {
          await db.insert(contacts).values({
            organizationId: orgId,
            clientId: newClient.id,
            ghlContactId: data.ghlContactId || null,
            ghlOpportunityId: data.ghlOpportunityId || null,
            firstName: nameParts[0] || "",
            lastName: nameParts.slice(1).join(" ") || "",
            name: data.primaryContactName || data.clientName,
            email: data.contactEmail,
            isPrimary: true,
            status: "active",
          });
        }
      } catch (cErr) {
        console.warn("Could not insert into canonical clients/contacts:", cErr);
      }

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
 * Deletes a canonical Client entity from the clients table, unlinking associated ad accounts, contacts, and calls.
 */
export async function deleteClientAction(clientId: number) {
  try {
    const { orgId, userId } = await getSessionOrgId();
    if (!orgId) return { success: false as const, error: "No active organization" };

    // 1. Unlink ad accounts
    await db.update(adAccounts).set({ clientId: null }).where(eq(adAccounts.clientId, clientId));
    await db.update(metaAdAccounts).set({ clientId: null }).where(eq(metaAdAccounts.clientId, clientId));

    // 2. Unlink contacts
    await db.update(contacts).set({ clientId: null }).where(eq(contacts.clientId, clientId));

    // 3. Unlink call records
    await db.update(callRecords).set({ clientId: null }).where(eq(callRecords.clientId, clientId));

    // 4. Delete the client record
    await db.delete(clients).where(and(eq(clients.id, clientId), eq(clients.organizationId, orgId)));

    await logAction(userId, "DELETE_CLIENT", "clients", clientId, {});

    revalidatePath("/clients");
    revalidatePath("/contacts");
    revalidatePath("/accounts");
    return { success: true as const };
  } catch (error: any) {
    console.error("deleteClientAction error:", error);
    return { success: false as const, error: error.message };
  }
}

/**
 * Merges multiple client entities into a single target primary client.
 * Consolidates ad accounts, meta ad accounts, contacts, and call records.
 * Deletes the source client records.
 */
export async function mergeClientsAction({
  targetClientId,
  sourceClientIds,
  finalName,
}: {
  targetClientId: number;
  sourceClientIds: number[];
  finalName?: string;
}) {
  try {
    const { orgId, userId } = await getSessionOrgId();
    if (!orgId) return { success: false as const, error: "No active organization" };

    // Filter out targetClientId from sourceClientIds if accidentally included
    const filteredSourceIds = sourceClientIds.filter((id) => id !== targetClientId);
    if (filteredSourceIds.length === 0) {
      return { success: false as const, error: "No secondary clients selected to merge." };
    }

    // Verify target client belongs to org
    const targetClient = await db.query.clients.findFirst({
      where: and(eq(clients.id, targetClientId), eq(clients.organizationId, orgId)),
    });
    if (!targetClient) {
      return { success: false as const, error: "Target client not found." };
    }

    // 1. Re-assign Google Ad Accounts
    await db
      .update(adAccounts)
      .set({ clientId: targetClientId })
      .where(inArray(adAccounts.clientId, filteredSourceIds));

    // 2. Re-assign Meta Ad Accounts
    await db
      .update(metaAdAccounts)
      .set({ clientId: targetClientId })
      .where(inArray(metaAdAccounts.clientId, filteredSourceIds));

    // 3. Re-assign Contacts
    await db
      .update(contacts)
      .set({ clientId: targetClientId, updatedAt: new Date() })
      .where(inArray(contacts.clientId, filteredSourceIds));

    // 4. Re-assign Call Records
    await db
      .update(callRecords)
      .set({ clientId: targetClientId })
      .where(inArray(callRecords.clientId, filteredSourceIds));

    // 5. Update Target Client name if specified
    if (finalName && finalName.trim() && finalName.trim() !== targetClient.name) {
      await db
        .update(clients)
        .set({ name: finalName.trim(), updatedAt: new Date() })
        .where(eq(clients.id, targetClientId));
    }

    // 6. Delete source clients
    await db
      .delete(clients)
      .where(and(inArray(clients.id, filteredSourceIds), eq(clients.organizationId, orgId)));

    await logAction(userId, "MERGE_CLIENTS", "clients", targetClientId, {
      targetClientId,
      sourceClientIds: filteredSourceIds,
      finalName,
    });

    revalidatePath("/clients");
    revalidatePath("/contacts");
    revalidatePath("/accounts");
    revalidatePath("/overview/industry");

    return { success: true as const };
  } catch (error: any) {
    console.error("mergeClientsAction error:", error);
    return { success: false as const, error: error.message };
  }
}

/**
 * Links or unlinks a connected Google Ad Account to a client record.
 */
export async function associateAdAccountAction(
  clientId: number,
  adAccountId: number | null,
) {
  try {
    const { userId } = await getSessionOrgId();

    if (adAccountId === null) {
      await db
        .update(adAccounts)
        .set({ clientOnboardingId: null })
        .where(eq(adAccounts.clientOnboardingId, clientId));
    } else {
      await db
        .update(adAccounts)
        .set({ clientOnboardingId: clientId })
        .where(eq(adAccounts.id, adAccountId));
    }

    await logAction(
      userId,
      "ASSOCIATE_AD_ACCOUNT",
      "ad_accounts",
      adAccountId || clientId,
      { clientId, adAccountId },
    );

    revalidatePath("/clients");
    revalidatePath("/accounts");
    revalidatePath("/overview/industry");
    return { success: true };
  } catch (error: any) {
    console.error("associateAdAccountAction error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Links or unlinks a connected Meta Ad Account to a client record.
 */
export async function associateMetaAdAccountAction(
  clientId: number,
  metaAdAccountId: number | null,
) {
  try {
    const { userId } = await getSessionOrgId();

    if (metaAdAccountId === null) {
      await db
        .update(metaAdAccounts)
        .set({ clientOnboardingId: null })
        .where(eq(metaAdAccounts.clientOnboardingId, clientId));
    } else {
      await db
        .update(metaAdAccounts)
        .set({ clientOnboardingId: clientId })
        .where(eq(metaAdAccounts.id, metaAdAccountId));
    }

    await logAction(
      userId,
      "ASSOCIATE_META_AD_ACCOUNT",
      "meta_ad_accounts",
      metaAdAccountId || clientId,
      { clientId, metaAdAccountId },
    );

    revalidatePath("/clients");
    revalidatePath("/accounts");
    revalidatePath("/overview/industry");
    return { success: true };
  } catch (error: any) {
    console.error("associateMetaAdAccountAction error:", error);
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

    // 5. Signal Link - Kept empty by default (no mock strings)
    const signalGroupLink = record.signalGroupLink || null;

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

    if (!record.signalGroupLink || !record.signalGroupLink.trim()) {
      return {
        success: false,
        error:
          "Signal Chat Group link is required. Please fill in the Signal Chat Group link before sending the welcome email.",
      };
    }

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

    // Ensure canonical clients record exists and has asset links
    try {
      const existingClient = await db.query.clients.findFirst({
        where: and(
          eq(clients.organizationId, record.organizationId),
          eq(clients.name, record.clientName.trim()),
        ),
      });

      if (existingClient) {
        await db
          .update(clients)
          .set({
            driveFolderLink: record.driveFolderLink || existingClient.driveFolderLink,
            notionDashboardLink: record.notionDashboardLink || existingClient.notionDashboardLink,
            signalGroupLink: record.signalGroupLink || existingClient.signalGroupLink,
            updatedAt: new Date(),
          })
          .where(eq(clients.id, existingClient.id));
      } else {
        const [newClient] = await db
          .insert(clients)
          .values({
            organizationId: record.organizationId,
            name: record.clientName.trim(),
            legalBusinessName: record.clientName.trim(),
            status: "onboarding",
            driveFolderLink: record.driveFolderLink,
            notionDashboardLink: record.notionDashboardLink,
            signalGroupLink: record.signalGroupLink,
          })
          .returning();

        if (newClient && record.contactEmail) {
          const contact = await db.query.contacts.findFirst({
            where: eq(contacts.email, record.contactEmail.trim().toLowerCase()),
          });
          if (contact) {
            await db
              .update(contacts)
              .set({ clientId: newClient.id, updatedAt: new Date() })
              .where(eq(contacts.id, contact.id));
          }
        }
      }
    } catch (clientSyncErr) {
      console.warn("Could not sync canonical client on email send:", clientSyncErr);
    }

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

    // Ensure canonical clients record is marked active and has asset links
    try {
      const existingClient = await db.query.clients.findFirst({
        where: and(
          eq(clients.organizationId, record.organizationId),
          eq(clients.name, record.clientName.trim()),
        ),
      });

      if (existingClient) {
        await db
          .update(clients)
          .set({
            status: "active",
            driveFolderLink: record.driveFolderLink || existingClient.driveFolderLink,
            notionDashboardLink: record.notionDashboardLink || existingClient.notionDashboardLink,
            signalGroupLink: record.signalGroupLink || existingClient.signalGroupLink,
            updatedAt: new Date(),
          })
          .where(eq(clients.id, existingClient.id));
      } else {
        const [newClient] = await db
          .insert(clients)
          .values({
            organizationId: record.organizationId,
            name: record.clientName.trim(),
            legalBusinessName: record.clientName.trim(),
            status: "active",
            driveFolderLink: record.driveFolderLink,
            notionDashboardLink: record.notionDashboardLink,
            signalGroupLink: record.signalGroupLink,
          })
          .returning();

        if (newClient && record.contactEmail) {
          const contact = await db.query.contacts.findFirst({
            where: eq(contacts.email, record.contactEmail.trim().toLowerCase()),
          });
          if (contact) {
            await db
              .update(contacts)
              .set({ clientId: newClient.id, updatedAt: new Date() })
              .where(eq(contacts.id, contact.id));
          }
        }
      }
    } catch (clientSyncErr) {
      console.warn("Could not sync canonical client on finalize:", clientSyncErr);
    }

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

/**
 * Syncs all GoHighLevel clients/contacts into the client directory.
 */
export async function syncAllGhlClientsAction() {
  try {
    const { orgId } = await getSessionOrgId();
    if (!orgId)
      return { success: false as const, error: "No active organization" };

    const result = await syncAllGhlClients(orgId);
    revalidatePath("/clients");
    return {
      success: true as const,
      totalFound: result.totalFound,
      totalImported: result.totalImported,
      totalUpdated: result.totalUpdated,
    };
  } catch (error: any) {
    console.error("Error syncing all GHL clients:", error);
    return {
      success: false as const,
      error: error.message || "Failed to sync GHL clients",
    };
  }
}

/**
 * Fetches a single client onboarding record by its primary ID.
 */
export async function getClientOnboardingByIdAction(clientId: number) {
  try {
    const { orgId } = await getSessionOrgId();
    if (!orgId)
      return { success: false as const, error: "No active organization" };

    // 1. Try finding in canonical clients table first
    let clientRecord = await db.query.clients.findFirst({
      where: and(
        eq(clients.id, clientId),
        eq(clients.organizationId, orgId),
      ),
      with: {
        contacts: true,
        adAccounts: true,
        metaAdAccounts: true,
      },
    });

    let client: any = null;
    let contactEmail = "";

    if (clientRecord) {
      const primaryContact = clientRecord.contacts?.find((ct: any) => ct.isPrimary) || clientRecord.contacts?.[0];
      client = {
        id: clientRecord.id,
        clientName: clientRecord.name,
        primaryContactName: primaryContact ? primaryContact.name : clientRecord.name,
        contactEmail: primaryContact ? primaryContact.email : "",
        contactPhone: primaryContact ? primaryContact.phone : null,
        ghlPipelineStage: primaryContact ? primaryContact.pipelineStage : null,
        googleAdsAccess: true,
        metaAdsAccess: true,
        status: clientRecord.status,
        driveFolderLink: clientRecord.driveFolderLink,
        notionDashboardLink: clientRecord.notionDashboardLink,
        signalGroupLink: clientRecord.signalGroupLink,
        ghlSubAccountId: clientRecord.ghlSubAccountId,
        createdAt: clientRecord.createdAt,
        updatedAt: clientRecord.updatedAt,
        adAccounts: clientRecord.adAccounts || [],
        metaAdAccounts: clientRecord.metaAdAccounts || [],
        contacts: clientRecord.contacts || [],
      };
      contactEmail = client.contactEmail || "";
    } else {
      // 2. Fallback to clientOnboardings table
      const legacyClient = await db.query.clientOnboardings.findFirst({
        where: and(
          eq(clientOnboardings.id, clientId),
          eq(clientOnboardings.organizationId, orgId),
        ),
        with: {
          adAccounts: true,
          metaAdAccounts: true,
        },
      });

      if (!legacyClient) {
        return { success: false as const, error: "Client not found" };
      }
      client = legacyClient;
      contactEmail = legacyClient.contactEmail;
    }

    const logs = await db.query.emailLogs.findMany({
      where: and(
        eq(emailLogs.organizationId, orgId),
        eq(emailLogs.recipient, client.contactEmail),
      ),
      orderBy: [desc(emailLogs.sentAt)],
      limit: 20,
    });

    return { success: true as const, client, emailLogs: logs };
  } catch (error: any) {
    console.error("Error fetching client onboarding by ID:", error);
    return {
      success: false as const,
      error: error.message || "Failed to fetch client details",
    };
  }
}

/**
 * Retrieves delivery logs for emails dispatched to a client.
 */
export async function getClientEmailLogsAction(clientId: number) {
  try {
    const { orgId } = await getSessionOrgId();
    if (!orgId)
      return { success: false as const, error: "No active organization" };

    const client = await db.query.clientOnboardings.findFirst({
      where: and(
        eq(clientOnboardings.id, clientId),
        eq(clientOnboardings.organizationId, orgId),
      ),
    });

    if (!client) {
      return { success: false as const, error: "Client not found" };
    }

    const logs = await db.query.emailLogs.findMany({
      where: and(
        eq(emailLogs.organizationId, orgId),
        eq(emailLogs.recipient, client.contactEmail),
      ),
      orderBy: [desc(emailLogs.sentAt)],
      limit: 20,
    });

    return { success: true as const, logs };
  } catch (error: any) {
    return { success: false as const, error: error.message };
  }
}

/**
 * Scans recent GHL calls, generates 100-word summaries, and pushes notes directly to GHL CRM contacts.
 */
export async function syncGhlCallNotesAction() {
  try {
    const { orgId } = await getSessionOrgId();
    if (!orgId)
      return { success: false as const, error: "No active organization" };

    const { syncAllRecentGhlCallNotes } = await import(
      "@/service/call-intelligence-service"
    );
    const result = await syncAllRecentGhlCallNotes(orgId, 25);

    revalidatePath("/clients");
    return {
      success: true as const,
      totalProcessed: result.totalProcessed,
      totalNotesPosted: result.totalNotesPosted,
    };
  } catch (error: any) {
    console.error("Error in syncGhlCallNotesAction:", error);
    return {
      success: false as const,
      error: error.message || "Failed to sync call notes to GHL",
    };
  }
}

/**
 * Migration routine to organize all GHL records from `client_onboardings`
 * into canonical `clients` (business entities) and `contacts` (people).
 */
export async function migrateGhlRecordsToClientsAndContactsAction() {
  try {
    const { orgId } = await getSessionOrgId();
    if (!orgId) return { success: false, error: "No active organization" };

    // 1. Ensure tables and columns exist
    await db.execute(
      sql`CREATE TABLE IF NOT EXISTS "clients" (
            "id" serial PRIMARY KEY,
            "organization_id" text NOT NULL REFERENCES "organization"("id") ON DELETE CASCADE,
            "name" text NOT NULL,
            "legal_business_name" text,
            "industry" text NOT NULL DEFAULT 'OTHER',
            "sub_niche" text,
            "website_url" text,
            "status" text NOT NULL DEFAULT 'active',
            "drive_folder_link" text,
            "notion_dashboard_link" text,
            "signal_group_link" text,
            "ghl_sub_account_id" text,
            "created_at" timestamp NOT NULL DEFAULT now(),
            "updated_at" timestamp NOT NULL DEFAULT now()
          );
          CREATE TABLE IF NOT EXISTS "contacts" (
            "id" serial PRIMARY KEY,
            "organization_id" text NOT NULL REFERENCES "organization"("id") ON DELETE CASCADE,
            "client_id" integer REFERENCES "clients"("id") ON DELETE SET NULL,
            "ghl_contact_id" text,
            "ghl_opportunity_id" text,
            "first_name" text,
            "last_name" text,
            "name" text NOT NULL,
            "email" text,
            "phone" text,
            "job_title" text,
            "is_primary" boolean NOT NULL DEFAULT false,
            "pipeline_stage" text,
            "status" text NOT NULL DEFAULT 'active',
            "created_at" timestamp NOT NULL DEFAULT now(),
            "updated_at" timestamp NOT NULL DEFAULT now()
          );
          ALTER TABLE "ad_accounts" ADD COLUMN IF NOT EXISTS "client_id" integer REFERENCES "clients"("id") ON DELETE SET NULL;
          ALTER TABLE "meta_ad_accounts" ADD COLUMN IF NOT EXISTS "client_id" integer REFERENCES "clients"("id") ON DELETE SET NULL;
          ALTER TABLE "call_records" ADD COLUMN IF NOT EXISTS "client_id" integer REFERENCES "clients"("id") ON DELETE SET NULL;
          ALTER TABLE "call_records" ADD COLUMN IF NOT EXISTS "contact_id" integer REFERENCES "contacts"("id") ON DELETE SET NULL;`,
    );

    // 2. Fetch all raw onboarding records
    const rawRecords = await db.query.clientOnboardings.findMany({
      where: eq(clientOnboardings.organizationId, orgId),
      with: {
        adAccounts: true,
        metaAdAccounts: true,
      },
      orderBy: [desc(clientOnboardings.createdAt)],
    });

    console.log(`[Migration] Starting migration of ${rawRecords.length} records into Clients and Contacts...`);

    // Fetch existing clients and contacts to prevent duplicates
    const existingClients = await db.query.clients.findMany({
      where: eq(clients.organizationId, orgId),
    });
    const clientByNameMap = new Map<string, typeof existingClients[0]>();
    for (const c of existingClients) {
      clientByNameMap.set(c.name.trim().toLowerCase(), c);
    }

    const existingContacts = await db.query.contacts.findMany({
      where: eq(contacts.organizationId, orgId),
    });
    const contactByGhlIdMap = new Map<string, typeof existingContacts[0]>();
    const contactByEmailMap = new Map<string, typeof existingContacts[0]>();
    for (const ct of existingContacts) {
      if (ct.ghlContactId) contactByGhlIdMap.set(ct.ghlContactId, ct);
      if (ct.email) contactByEmailMap.set(ct.email.trim().toLowerCase(), ct);
    }

    let clientsCreated = 0;
    let contactsCreated = 0;
    let accountsLinked = 0;

    for (const rec of rawRecords) {
      // Determine if this record represents a true business Client
      const hasAds = (rec.adAccounts && rec.adAccounts.length > 0) || (rec.metaAdAccounts && rec.metaAdAccounts.length > 0);
      const rawClientName = (rec.clientName || "").trim();
      const rawContactName = (rec.primaryContactName || "").trim();
      const isPhoneOrEmail = /^[\d\s+()/-]+$/.test(rawClientName) || rawClientName.includes("@");
      const isJustPersonName = rawClientName.toLowerCase() === rawContactName.toLowerCase();
      const isTrueBusinessClient = hasAds || (rawClientName.length > 2 && !isPhoneOrEmail && !isJustPersonName);

      let clientRecord: any = null;
      if (isTrueBusinessClient) {
        const clientName = (rawClientName || rawContactName || "Unnamed Business").trim();
        const normClientName = clientName.toLowerCase();

        // 3. Find or create Client
        clientRecord = clientByNameMap.get(normClientName);
        if (!clientRecord) {
          const [insertedClient] = await db
            .insert(clients)
            .values({
              organizationId: orgId,
              name: clientName,
              status: rec.status === "completed" ? "active" : rec.status === "disqualified" ? "disqualified" : "onboarding",
              driveFolderLink: rec.driveFolderLink || null,
              notionDashboardLink: rec.notionDashboardLink || null,
              signalGroupLink: rec.signalGroupLink || null,
              ghlSubAccountId: rec.ghlSubAccountId || null,
              createdAt: rec.createdAt,
              updatedAt: rec.updatedAt,
            })
            .returning();
          clientRecord = insertedClient;
          clientByNameMap.set(normClientName, insertedClient);
          clientsCreated++;
        }
      }

      // 4. Find or create Contact
      const email = (rec.contactEmail || "").trim().toLowerCase();
      const ghlId = rec.ghlContactId;
      let contactRecord = (ghlId ? contactByGhlIdMap.get(ghlId) : undefined) || (email ? contactByEmailMap.get(email) : undefined);

      if (!contactRecord) {
        const nameParts = (rec.primaryContactName || "").trim().split(/\s+/);
        const firstName = nameParts[0] || "";
        const lastName = nameParts.slice(1).join(" ") || "";

        const [insertedContact] = await db
          .insert(contacts)
          .values({
            organizationId: orgId,
            clientId: clientRecord ? clientRecord.id : null,
            ghlContactId: rec.ghlContactId || null,
            ghlOpportunityId: rec.ghlOpportunityId || null,
            firstName,
            lastName,
            name: rec.primaryContactName || rawClientName || "Unnamed Contact",
            email: rec.contactEmail || null,
            phone: rec.contactPhone || null,
            isPrimary: true,
            pipelineStage: rec.ghlPipelineStage || null,
            status: rec.status === "disqualified" ? "disqualified" : "active",
            createdAt: rec.createdAt,
            updatedAt: rec.updatedAt,
          })
          .returning();
        contactRecord = insertedContact;
        if (ghlId) contactByGhlIdMap.set(ghlId, insertedContact);
        if (email) contactByEmailMap.set(email, insertedContact);
        contactsCreated++;
      } else if (!contactRecord.clientId && clientRecord) {
        // Link existing contact to this client
        await db
          .update(contacts)
          .set({ clientId: clientRecord.id })
          .where(eq(contacts.id, contactRecord.id));
      }

      // 5. Migrate linked Google Ad Accounts to this Client
      if (clientRecord && rec.adAccounts && rec.adAccounts.length > 0) {
        for (const gAcc of rec.adAccounts) {
          await db
            .update(adAccounts)
            .set({ clientId: clientRecord.id })
            .where(eq(adAccounts.id, gAcc.id));
          accountsLinked++;
        }
      }

      // 6. Migrate linked Meta Ad Accounts to this Client
      if (clientRecord && rec.metaAdAccounts && rec.metaAdAccounts.length > 0) {
        for (const mAcc of rec.metaAdAccounts) {
          await db
            .update(metaAdAccounts)
            .set({ clientId: clientRecord.id })
            .where(eq(metaAdAccounts.id, mAcc.id));
          accountsLinked++;
        }
      }

      // 7. Update call records for this client/contact
      if (rec.id || rec.ghlContactId) {
        await db
          .update(callRecords)
          .set({
            clientId: clientRecord ? clientRecord.id : null,
            contactId: contactRecord.id,
          })
          .where(
            and(
              eq(callRecords.organizationId, orgId),
              rec.ghlContactId
                ? eq(callRecords.ghlContactId, rec.ghlContactId)
                : eq(callRecords.clientOnboardingId, rec.id),
            ),
          );
      }
    }

    revalidatePath("/clients");
    revalidatePath("/accounts");
    revalidatePath("/overview/industry");

    return {
      success: true as const,
      totalRawRecords: rawRecords.length,
      clientsCreated,
      contactsCreated,
      accountsLinked,
    };
  } catch (error: any) {
    console.error("Migration error:", error);
    return { success: false as const, error: error.message };
  }
}

/**
 * Retrieves split CRM directory data:
 * 1. Canonical Clients (business entities) with connected ad accounts, contacts count, call stats.
 * 2. Canonical Contacts & Leads (individual GHL persons) with pipeline stages, parent client, call stats.
 */
export async function getCrmDirectoryDataAction() {
  try {
    const { orgId } = await getSessionOrgId();
    if (!orgId) return { success: false as const, error: "No active organization" };

    // 1. Fetch canonical clients
    let clientsList: any[] = [];
    try {
      clientsList = await db.query.clients.findMany({
        where: eq(clients.organizationId, orgId),
        orderBy: [desc(clients.createdAt)],
        with: {
          contacts: true,
          adAccounts: true,
          metaAdAccounts: true,
        },
      });
    } catch (err) {
      console.warn("Could not query clients with relations, fallback to basic query:", err);
      clientsList = await db.query.clients.findMany({
        where: eq(clients.organizationId, orgId),
        orderBy: [desc(clients.createdAt)],
      });
    }

    // 2. Fetch canonical contacts
    let contactsList: any[] = [];
    try {
      contactsList = await db.query.contacts.findMany({
        where: eq(contacts.organizationId, orgId),
        orderBy: [desc(contacts.createdAt)],
        with: {
          client: true,
        },
      });
    } catch (err) {
      console.warn("Could not query contacts with client relation, fallback to basic query:", err);
      contactsList = await db.query.contacts.findMany({
        where: eq(contacts.organizationId, orgId),
        orderBy: [desc(contacts.createdAt)],
      });
    }

    // 3. Fetch call records for the organization to compute latest calls & metrics
    let allCalls: any[] = [];
    try {
      allCalls = await db
        .select({
          id: callRecords.id,
          clientId: callRecords.clientId,
          contactId: callRecords.contactId,
          clientOnboardingId: callRecords.clientOnboardingId,
          ghlContactId: callRecords.ghlContactId,
          contactPhone: callRecords.contactPhone,
          contactEmail: callRecords.contactEmail,
          callStartedAt: callRecords.callStartedAt,
          leadScore: callRecords.leadScore,
          sentiment: callRecords.sentiment,
          createdAt: callRecords.createdAt,
        })
        .from(callRecords)
        .where(eq(callRecords.organizationId, orgId))
        .orderBy(desc(callRecords.callStartedAt), desc(callRecords.createdAt));
    } catch (callErr) {
      console.warn("Could not fetch callRecords for CRM directory:", callErr);
    }

    // Enrich Clients with aggregate call stats
    const enrichedClients = clientsList.map((c) => {
      const clientCalls = allCalls.filter((call) => {
        if (call.clientId === c.id) return true;
        return false;
      });
      const latestCall = clientCalls[0];
      return {
        ...c,
        contactsCount: c.contacts ? c.contacts.length : 0,
        callCount: clientCalls.length,
        lastCallAt: latestCall ? latestCall.callStartedAt || latestCall.createdAt : null,
        latestLeadScore: latestCall ? latestCall.leadScore : null,
        latestSentiment: latestCall ? latestCall.sentiment : null,
      };
    });

    // Enrich Contacts with individual call stats & parent client name
    const enrichedContacts = contactsList.map((ct) => {
      const contactPhoneClean = (ct.phone || "").replace(/\D/g, "");
      const contactEmailClean = (ct.email || "").toLowerCase().trim();

      const matchingCalls = allCalls.filter((call) => {
        if (call.contactId === ct.id) return true;
        if (ct.ghlContactId && call.ghlContactId === ct.ghlContactId) return true;
        if (contactEmailClean && call.contactEmail?.toLowerCase().trim() === contactEmailClean) return true;
        if (contactPhoneClean && contactPhoneClean.length >= 6) {
          const callPhoneClean = (call.contactPhone || "").replace(/\D/g, "");
          if (callPhoneClean && (callPhoneClean.includes(contactPhoneClean) || contactPhoneClean.includes(callPhoneClean))) {
            return true;
          }
        }
        return false;
      });

      const latestCall = matchingCalls[0];

      return {
        ...ct,
        clientName: ct.client?.name || null,
        callCount: matchingCalls.length,
        lastCallAt: latestCall ? latestCall.callStartedAt || latestCall.createdAt : null,
        latestLeadScore: latestCall ? latestCall.leadScore : null,
        latestSentiment: latestCall ? latestCall.sentiment : null,
      };
    });

    return {
      success: true as const,
      clients: enrichedClients,
      contacts: enrichedContacts,
    };
  } catch (error: any) {
    console.error("getCrmDirectoryDataAction error:", error);
    return { success: false as const, error: error.message };
  }
}

/**
 * Assigns or unassigns a Contact to a canonical Client business.
 */
export async function assignContactToClientAction(contactId: number, clientId: number | null) {
  try {
    const { orgId, userId } = await getSessionOrgId();
    if (!orgId) return { success: false as const, error: "No active organization" };

    await db
      .update(contacts)
      .set({
        clientId: clientId,
        updatedAt: new Date(),
      })
      .where(and(eq(contacts.id, contactId), eq(contacts.organizationId, orgId)));

    // Also link any existing call records for this contact to the client
    if (clientId) {
      await db
        .update(callRecords)
        .set({ clientId: clientId })
        .where(and(eq(callRecords.contactId, contactId), eq(callRecords.organizationId, orgId)));
    }

    await logAction(userId, "ASSIGN_CONTACT_TO_CLIENT", "contacts", contactId, { clientId });
    revalidatePath("/clients");
    return { success: true as const };
  } catch (error: any) {
    console.error("assignContactToClientAction error:", error);
    return { success: false as const, error: error.message };
  }
}

/**
 * Promotes an individual Contact into a new canonical Client business.
 */
export async function promoteContactToClientAction(contactId: number, clientName: string) {
  try {
    const { orgId, userId } = await getSessionOrgId();
    if (!orgId) return { success: false as const, error: "No active organization" };

    const contactRecord = await db.query.contacts.findFirst({
      where: and(eq(contacts.id, contactId), eq(contacts.organizationId, orgId)),
    });

    if (!contactRecord) return { success: false as const, error: "Contact not found" };

    const [newClient] = await db
      .insert(clients)
      .values({
        organizationId: orgId,
        name: clientName.trim(),
        status: "active",
      })
      .returning();

    await db
      .update(contacts)
      .set({
        clientId: newClient.id,
        updatedAt: new Date(),
      })
      .where(eq(contacts.id, contactId));

    await db
      .update(callRecords)
      .set({
        clientId: newClient.id,
      })
      .where(and(eq(callRecords.contactId, contactId), eq(callRecords.organizationId, orgId)));

    await logAction(userId, "PROMOTE_CONTACT_TO_CLIENT", "clients", newClient.id, {
      contactId,
      clientName: newClient.name,
    });

    revalidatePath("/clients");
    return { success: true as const, clientId: newClient.id };
  } catch (error: any) {
    console.error("promoteContactToClientAction error:", error);
    return { success: false as const, error: error.message };
  }
}


