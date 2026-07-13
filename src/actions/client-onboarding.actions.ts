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
} from "@/db/schema";
import { logAction, logEmail } from "@/lib/audit";
import { auth } from "@/lib/auth";
import { updateGhlOpportunityStage } from "@/service/gohighlevel-service";

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

      // Drive Link (Mocking duplication of the parent template folder)
      const driveFolderLink = `https://drive.google.com/drive/folders/mock-folder-${slug}`;

      // Notion Link (Mocking template clone)
      const notionDashboardLink = `https://notion.so/uprisedigital/Uprise-Digital-x-${slug}-mock-dashboard`;

      // Signal Link (Mock invite code generation)
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
 * Helper to compile onboarding email bodies.
 */
export function compileOnboardingEmail(params: {
  primaryContactName: string;
  clientName: string;
  driveFolderLink: string;
  notionDashboardLink: string;
  signalGroupLink: string;
  googleAdsAccess: boolean;
  metaAdsAccess: boolean;
}) {
  const {
    primaryContactName,
    clientName,
    driveFolderLink,
    notionDashboardLink,
    signalGroupLink,
    googleAdsAccess,
    metaAdsAccess,
  } = params;

  let adsInstructionsText = "";
  let adsInstructionsHtml = "";

  if (googleAdsAccess) {
    adsInstructionsText += `To grant us access to your Google Ads account, please follow the steps here: https://tools.uprisedigital.com.au/docs/client-guides/google-ads-access\n\n`;
    adsInstructionsHtml += `<p style="margin-bottom: 12px;">To grant us access to your Google Ads account, please follow the steps here: <a href="https://tools.uprisedigital.com.au/docs/client-guides/google-ads-access" style="color: #4f46e5; text-decoration: underline; font-weight: 600;">Google Ads Account Access Instructions</a></p>`;
  }

  if (metaAdsAccess) {
    adsInstructionsText += `To grant us access to your Meta Ads account, please follow the steps here: https://tools.uprisedigital.com.au/docs/client-guides/meta-ads-access\n\n`;
    adsInstructionsHtml += `<p style="margin-bottom: 12px;">To grant us access to your Meta Ads account, please follow the steps here: <a href="https://tools.uprisedigital.com.au/docs/client-guides/meta-ads-access" style="color: #4f46e5; text-decoration: underline; font-weight: 600;">Meta Ads Account Access Instructions</a></p>`;
  }

  const textBody = `Hi ${primaryContactName},

Great to have you on board!
Firstly, thank you for booking your onboarding call - we're looking forward to it.

To help us hit the ground running, we'd really appreciate it if you could complete the steps below before your onboarding call:

To help us with creating your ad assets, I've created your Google Drive Folder: Media Assets (Images and Videos) (${driveFolderLink}).
Please upload all your media assets like photos, videos, and logos (preferably in high-quality PNG format) inside the Media Assets (Images and Videos) folder.

You can access the Uprise Digital x ${clientName} (${notionDashboardLink}) dashboard here. We'll use this dashboard to record all details discussed during the onboarding call for your reference.

Here's a link to your Signal Group. Here, we can communicate instantly to provide you updates or requests immediately. Please click on the hyperlinks below for your reference:

    Download Signal on your mobile device
        Apple: https://apps.apple.com/us/app/signal-private-messenger/id874139669
        Android: https://play.google.com/store/apps/details?id=org.thoughtcrime.secureshare
    Click on the hyperlink below to join the Uprise Digital group chat
    Uprise x ${clientName} (${signalGroupLink})

${adsInstructionsText}
Feel free to reach out if you have any questions or concerns. Don't hesitate to reach out; we're here to help.

Thank you and have a great day!

Lakshane Fonseka
Founder | Uprise Digital
+61 426 759 756
www.uprisedigital.com.au`;

  const htmlBody = `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 20px;">
  <p style="font-size: 16px; margin-bottom: 16px;">Hi ${primaryContactName},</p>
  
  <p style="font-size: 16px; margin-bottom: 16px;">Great to have you on board!</p>
  <p style="font-size: 16px; margin-bottom: 24px;">Firstly, thank you for booking your onboarding call - we're looking forward to it.</p>
  
  <p style="font-size: 15px; font-weight: 600; color: #0f172a; margin-bottom: 16px; text-transform: uppercase; letter-spacing: 0.5px;">To help us hit the ground running, we'd really appreciate it if you could complete the steps below before your onboarding call:</p>
  
  <div style="background-color: #f8fafc; border-left: 4px solid #4f46e5; padding: 16px; margin-bottom: 24px; border-radius: 0 8px 8px 0;">
    <p style="margin: 0 0 8px 0; font-weight: 600; color: #0f172a;">1. Upload Media Assets</p>
    <p style="margin: 0; font-size: 14px; color: #475569;">To help us with creating your ad assets, I've created your Google Drive Folder: 
      <a href="${driveFolderLink}" style="color: #4f46e5; text-decoration: underline; font-weight: 600;">Media Assets (Images and Videos)</a>.<br/>
      Please upload all your media assets like photos, videos, and logos (preferably in high-quality PNG format) inside the folder.
    </p>
  </div>

  <div style="background-color: #f8fafc; border-left: 4px solid #4f46e5; padding: 16px; margin-bottom: 24px; border-radius: 0 8px 8px 0;">
    <p style="margin: 0 0 8px 0; font-weight: 600; color: #0f172a;">2. Client Dashboard</p>
    <p style="margin: 0; font-size: 14px; color: #475569;">You can access the 
      <a href="${notionDashboardLink}" style="color: #4f46e5; text-decoration: underline; font-weight: 600;">Uprise Digital x ${clientName}</a> 
      dashboard here. We'll use this dashboard to record all details discussed during the onboarding call for your reference.
    </p>
  </div>

  <div style="background-color: #f8fafc; border-left: 4px solid #4f46e5; padding: 16px; margin-bottom: 24px; border-radius: 0 8px 8px 0;">
    <p style="margin: 0 0 8px 0; font-weight: 600; color: #0f172a;">3. Join Signal Group</p>
    <p style="margin: 0 0 12px 0; font-size: 14px; color: #475569;">Here's a link to your Signal Group so we can communicate instantly. Please click the links below:</p>
    <ul style="margin: 0; padding-left: 20px; font-size: 13px; color: #475569;">
      <li style="margin-bottom: 4px;">Download Signal: 
        <a href="https://apps.apple.com/us/app/signal-private-messenger/id874139669" style="color: #4f46e5; text-decoration: none;">Apple</a> | 
        <a href="https://play.google.com/store/apps/details?id=org.thoughtcrime.secureshare" style="color: #4f46e5; text-decoration: none;">Android</a>
      </li>
      <li>Join group chat: 
        <a href="${signalGroupLink}" style="color: #4f46e5; text-decoration: underline; font-weight: 600;">Uprise x ${clientName}</a>
      </li>
    </ul>
  </div>

  ${
    adsInstructionsHtml
      ? `
  <div style="background-color: #f8fafc; border-left: 4px solid #4f46e5; padding: 16px; margin-bottom: 24px; border-radius: 0 8px 8px 0;">
    <p style="margin: 0 0 8px 0; font-weight: 600; color: #0f172a;">4. Grant Account Access</p>
    <div style="font-size: 14px; color: #475569;">
      ${adsInstructionsHtml}
    </div>
  </div>
  `
      : ""
  }

  <p style="font-size: 15px; margin-top: 24px; margin-bottom: 24px; color: #475569;">Feel free to reach out if you have any questions or concerns. We are here to help!</p>
  
  <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0;" />

  <p style="font-size: 14px; font-weight: bold; margin: 0 0 4px 0; color: #0f172a;">Lakshane Fonseka</p>
  <p style="font-size: 12px; color: #64748b; margin: 0 0 4px 0;">Founder | Uprise Digital</p>
  <p style="font-size: 12px; color: #64748b; margin: 0 0 4px 0;">+61 426 759 756</p>
  <p style="font-size: 12px; color: #64748b; margin: 0;"><a href="https://www.uprisedigital.com.au" style="color: #4f46e5; text-decoration: none;">www.uprisedigital.com.au</a></p>
</div>`;

  return { text: textBody, html: htmlBody };
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

    const subject =
      customSubject || "Welcome to Uprise Digital - Let's get started!";

    let html = customHtml;
    let text = customText;

    if (!html || !text) {
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
