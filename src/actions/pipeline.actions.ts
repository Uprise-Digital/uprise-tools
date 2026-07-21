"use server";

import { desc, eq, ne } from "drizzle-orm";
import { headers } from "next/headers";
import { getBriefingSettingsAction } from "@/actions/briefing-settings.actions";
import { db } from "@/db";
import { withBypassTenantDb } from "@/db/db-helper";
import { pipelineRevivalPlans, salesReminderSettings, user } from "@/db/schema";
import { generateContentTracked } from "@/lib/ai-logger";
import { logEmail } from "@/lib/audit";
import { auth } from "@/lib/auth";
import {
  createContactNote,
  getContactNotes,
  getGhlContactDetails,
  getGhlOpportunities,
  getGhlPipelines,
  getGhlUsers,
} from "@/service/gohighlevel-service";

// Helper to check user session
async function checkAuth() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session) {
    throw new Error("Unauthorized");
  }
  return session;
}

/**
 * Fetches full GHL contact details including tags, campaign attribution, and source.
 */
export async function getGhlContactDetailsAction(contactId: string) {
  try {
    await checkAuth();
    if (!contactId) return { success: true as const, data: null };
    const details = await getGhlContactDetails(contactId);
    return { success: true as const, data: details };
  } catch (error: any) {
    console.error("[getGhlContactDetailsAction Error]:", error);
    return { success: false as const, error: error.message, data: null };
  }
}

/**
 * Fetches all sales pipeline dashboard data.
 */
export async function getPipelineDashboardDataAction(pipelineId?: string) {
  try {
    await checkAuth();

    const locationId = process.env.GHL_LOCATION_ID;
    if (!locationId) {
      throw new Error(
        "GHL_LOCATION_ID environment variable is not configured.",
      );
    }

    // 1. Fetch Pipelines
    const pipelines = await getGhlPipelines(locationId);
    if (pipelines.length === 0) {
      return {
        success: true as const,
        pipelines: [],
        selectedPipelineId: "",
        stages: [],
        opportunities: [],
        metrics: {
          totalValue: 0,
          activeCount: 0,
          stalledCount: 0,
          stalledValue: 0,
        },
      };
    }

    const selectedPipeline =
      pipelines.find((p) => p.id === pipelineId) || pipelines[0];
    const selectedPipelineId = selectedPipeline.id;

    // 2. Fetch Opportunities for selected pipeline
    const rawOpportunities = await getGhlOpportunities(
      locationId,
      selectedPipelineId,
    );

    // 3. Fetch GHL Users to map assignedTo to names
    let usersList: any[] = [];
    try {
      usersList = await getGhlUsers(locationId);
    } catch (e) {
      console.warn(
        "Failed to fetch GHL users, displaying raw user IDs instead.",
        e,
      );
    }
    const userMap = new Map(usersList.map((u) => [u.id, u.name]));

    // 4. Map and evaluate opportunities
    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

    let totalValue = 0;
    let activeCount = 0;
    let stalledCount = 0;
    let stalledValue = 0;

    const opportunities = rawOpportunities.map((o) => {
      const ownerName = o.assignedTo
        ? userMap.get(o.assignedTo) || `User (${o.assignedTo.slice(-4)})`
        : "Unassigned";

      const lastUpdatedMs = new Date(o.updatedAt).getTime();
      const isStalled = o.status === "open" && lastUpdatedMs < sevenDaysAgo;
      const daysStalled =
        o.status === "open"
          ? Math.max(
              0,
              Math.floor((now - lastUpdatedMs) / (24 * 60 * 60 * 1000)),
            )
          : 0;

      const val = o.monetaryValue || 0;
      if (o.status === "open") {
        totalValue += val;
        activeCount++;
        if (isStalled) {
          stalledCount++;
          stalledValue += val;
        }
      }

      return {
        ...o,
        ownerName,
        isStalled,
        daysStalled,
      };
    });

    return {
      success: true as const,
      pipelines: pipelines.map((p) => ({ id: p.id, name: p.name })),
      selectedPipelineId,
      stages: selectedPipeline.stages,
      opportunities,
      metrics: {
        totalValue: parseFloat(totalValue.toFixed(2)),
        activeCount,
        stalledCount,
        stalledValue: parseFloat(stalledValue.toFixed(2)),
      },
    };
  } catch (error: any) {
    console.error("[getPipelineDashboardDataAction Error]:", error);
    return { success: false as const, error: error.message };
  }
}

/**
 * Fetches GHL notes timeline for a specific contact.
 */
export async function getContactNotesAction(contactId: string) {
  try {
    await checkAuth();
    const notes = await getContactNotes(contactId);

    // Fetch users list to map note creators if available
    const locationId = process.env.GHL_LOCATION_ID || "";
    let usersList: any[] = [];
    if (locationId) {
      try {
        usersList = await getGhlUsers(locationId);
      } catch (e) {
        // Ignore
      }
    }
    const userMap = new Map(usersList.map((u) => [u.id, u.name]));

    const mappedNotes = notes.map((n) => ({
      ...n,
      creatorName: n.userId
        ? userMap.get(n.userId) || "Team Member"
        : "System Integration",
    }));

    return { success: true as const, notes: mappedNotes };
  } catch (error: any) {
    console.error("[getContactNotesAction Error]:", error);
    return { success: false as const, error: error.message };
  }
}

/**
 * Appends a new contact note directly into GoHighLevel CRM.
 */
export async function addGhlContactNoteAction(
  contactId: string,
  noteBody: string,
) {
  try {
    await checkAuth();
    if (!noteBody.trim()) throw new Error("Note content cannot be empty.");

    await createContactNote(contactId, noteBody.trim());
    return { success: true as const };
  } catch (error: any) {
    console.error("[addGhlContactNoteAction Error]:", error);
    return { success: false as const, error: error.message };
  }
}

/**
 * Fetches the latest saved revival plan from the database for a given opportunity.
 */
export async function getSavedRevivalPlanAction(opportunityId: string) {
  try {
    await checkAuth();
    if (!opportunityId) return { success: true as const, plan: null };

    const savedPlan = await withBypassTenantDb(async (tx) => {
      return await tx.query.pipelineRevivalPlans.findFirst({
        where: eq(pipelineRevivalPlans.opportunityId, opportunityId),
        orderBy: [desc(pipelineRevivalPlans.createdAt)],
      });
    });

    if (!savedPlan) {
      return { success: true as const, plan: null };
    }

    return {
      success: true as const,
      plan: {
        strategy: savedPlan.strategy,
        steps: savedPlan.steps as string[],
        outreachScript: savedPlan.outreachScript,
        recommendedFollowUpDays: savedPlan.recommendedFollowUpDays || 3,
        createdAt: savedPlan.createdAt.toISOString(),
      },
    };
  } catch (error: any) {
    console.error("[getSavedRevivalPlanAction Error]:", error);
    return { success: false as const, error: error.message, plan: null };
  }
}

/**
 * Uses Gemini to generate an action revival plan and outreach templates for a stalled prospect,
 * and saves it into the database for persistence.
 */
export async function generateRevivalPlanAction(
  opportunityId: string,
  details: {
    name: string;
    contactName: string;
    stageName: string;
    value: number;
    daysStalled: number;
    ownerName: string;
    contactId?: string;
  },
) {
  try {
    await checkAuth();

    let crmNotesSummary = "No CRM activity notes recorded.";
    let leadAttributionSummary = "Standard Lead";

    if (details.contactId) {
      try {
        const [notes, contactDetails] = await Promise.all([
          getContactNotes(details.contactId).catch(() => []),
          getGhlContactDetails(details.contactId).catch(() => null),
        ]);

        if (notes && notes.length > 0) {
          crmNotesSummary = notes
            .map((n) => {
              const text = (n.body || "").replace(/<[^>]*>/g, "").trim();
              const dateStr = n.createdAt ? n.createdAt.slice(0, 10) : "";
              return `[${dateStr}] ${text}`;
            })
            .join("\n");
        }

        if (contactDetails) {
          const parts = [];
          if (contactDetails.source)
            parts.push(`Source: ${contactDetails.source}`);
          if (contactDetails.campaign)
            parts.push(`Campaign: ${contactDetails.campaign}`);
          if (contactDetails.formName)
            parts.push(`Form: ${contactDetails.formName}`);
          if (contactDetails.tags && contactDetails.tags.length > 0) {
            parts.push(`Tags: ${contactDetails.tags.join(", ")}`);
          }
          if (parts.length > 0) {
            leadAttributionSummary = parts.join(" | ");
          }
        }
      } catch (ctxErr) {
        console.warn(
          "Failed to fetch CRM context for revival plan prompt:",
          ctxErr,
        );
      }
    }

    const prompt = `
      You are an expert sales director and growth coach.
      Analyze this STALLED sales opportunity from our pipeline and write an actionable revival plan.
      
      DEAL DETAILS:
      - Prospect / Deal Name: ${details.name}
      - Contact: ${details.contactName}
      - Stage: ${details.stageName}
      - Deal Value: $${details.value} USD
      - Stalled Period: ${details.daysStalled} days without stage movement
      - Assigned Owner: ${details.ownerName}
      - Lead Source & Marketing Context: ${leadAttributionSummary}
      
      PREVIOUS CRM ACTIVITY & CALL NOTES HISTORY:
      ${crmNotesSummary}
      
      OUTPUT FORMAT (Strict JSON):
      {
        "strategy": "A brief 2-sentence summary of the outreach angle to revive interest.",
        "steps": [
          "Action Step 1 (Immediate - e.g. Phone call or SMS check-in detailing specific hook)",
          "Action Step 2 (Follow-up - e.g. Email template or audit link to share)",
          "Action Step 3 (Closing loop - e.g. A final break-up text or scheduling proposal)"
        ],
        "outreachScript": "A professional, punchy, high-conversion email or SMS message template ready to copy-paste. Tailored specifically to the deal details AND prior CRM activity notes above. If phone calls or emails were already attempted in notes, reference them naturally (e.g. 'I tried giving you a shout earlier but figured you were swamped...').",
        "recommendedFollowUpDays": 3
      }
      
      CONSTRAINTS:
      - Do NOT wrap in markdown block code tags (e.g. \`\`\`json). Output raw json string only.
      - Make the outreach script highly contextual to the ${details.stageName} stage and CRM notes history.
    `;

    const result = await generateContentTracked(
      {
        model: "gemini-flash-latest",
        contents: prompt,
        config: { responseMimeType: "application/json" },
      },
      {
        feature: "sales_pipeline_revival",
      },
    );

    const rawText = (result.response.text as string) || "";
    const cleanedText = rawText.replace(/```json\n?|\n?```/g, "").trim();
    const parsedPlan = JSON.parse(cleanedText);

    // Save/upsert to database
    let savedRecord;
    try {
      const existing = await withBypassTenantDb(async (tx) => {
        return await tx.query.pipelineRevivalPlans.findFirst({
          where: eq(pipelineRevivalPlans.opportunityId, opportunityId),
        });
      });

      if (existing) {
        const [updated] = await withBypassTenantDb(async (tx) => {
          return await tx
            .update(pipelineRevivalPlans)
            .set({
              strategy: parsedPlan.strategy || "",
              steps: parsedPlan.steps || [],
              outreachScript: parsedPlan.outreachScript || "",
              recommendedFollowUpDays: parsedPlan.recommendedFollowUpDays || 3,
              opportunityName: details.name,
              contactId: details.contactId || null,
              updatedAt: new Date(),
            })
            .where(eq(pipelineRevivalPlans.id, existing.id))
            .returning();
        });
        savedRecord = updated;
      } else {
        const [created] = await withBypassTenantDb(async (tx) => {
          return await tx
            .insert(pipelineRevivalPlans)
            .values({
              opportunityId,
              contactId: details.contactId || null,
              opportunityName: details.name,
              strategy: parsedPlan.strategy || "",
              steps: parsedPlan.steps || [],
              outreachScript: parsedPlan.outreachScript || "",
              recommendedFollowUpDays: parsedPlan.recommendedFollowUpDays || 3,
            })
            .returning();
        });
        savedRecord = created;
      }
    } catch (dbErr) {
      console.error("[generateRevivalPlanAction DB Save Error]:", dbErr);
    }

    const createdAt = savedRecord
      ? savedRecord.updatedAt.toISOString()
      : new Date().toISOString();

    return {
      success: true as const,
      plan: {
        ...parsedPlan,
        createdAt,
      },
      usageAlert: result.usageAlert,
    };
  } catch (error: any) {
    console.error("[generateRevivalPlanAction Error]:", error);
    let errMsg = error.message || "Failed to generate revival plan.";
    if (
      errMsg.includes("CONSUMER_SUSPENDED") ||
      errMsg.includes("Permission denied")
    ) {
      errMsg =
        "Gemini API key is suspended by Google Cloud. Please update GEMINI_API_KEY in .env.local.";
    }
    return { success: false as const, error: errMsg };
  }
}

/**
 * Uses Gemini to summarize meeting/call transcripts or fathom notes into a clean GHL CRM note.
 */
export async function generateTranscriptSummaryAction(transcript: string) {
  try {
    await checkAuth();
    if (!transcript.trim())
      throw new Error("Transcript content cannot be empty.");

    const prompt = `
      You are an AI sales assistant. Convert this raw meeting transcript or call summary into a concise, professional CRM note.
      
      RAW NOTES/TRANSCRIPT:
      ${transcript}
      
      CRM NOTE STRUCTURE FORMAT:
      ### 📞 Call / Meeting Summary
      [Provide a 3-sentence summary of the main discussion, key updates, and customer interest.]
      
      ### 🎯 Key Outcomes & Decisions
      - [Decision/Outcome 1]
      - [Decision/Outcome 2]
      
      ### 🚀 Action Items
      - [Action item for owner] (Due: [date/estimate])
      - [Action item for prospect] (Due: [date/estimate])
      
      ### 📈 Deal Sentiment
      [Warm, Neutral, Cold, or Hot with 1-sentence reasoning]
      
      CONSTRAINTS: Output the formatted markdown note directly. Do not include introductory notes or wrappers. Max 250 words.
    `;

    const result = await generateContentTracked(
      {
        model: "gemini-flash-latest",
        contents: prompt,
      },
      {
        feature: "sales_pipeline_transcript_summarizer",
      },
    );

    return {
      success: true as const,
      summary: result.response.text as string,
      usageAlert: result.usageAlert,
    };
  } catch (error: any) {
    console.error("[generateTranscriptSummaryAction Error]:", error);
    return { success: false as const, error: error.message };
  }
}

/**
 * Sends a daily stalled opportunities email digest to Uprise team members.
 */
export async function sendStalledOpportunitiesReminderAction() {
  const SYSTEM_ACTOR = "SYSTEM_AUTOMATION";
  try {
    const locationId = process.env.GHL_LOCATION_ID;
    const apiKey = process.env.GHL_API_KEY;
    const resendKey = process.env.RESEND_API_KEY;

    if (!locationId || !apiKey) {
      throw new Error("GHL_LOCATION_ID or GHL_API_KEY is not configured.");
    }
    if (!resendKey) {
      throw new Error("RESEND_API_KEY is not configured.");
    }

    const { Resend } = await import("resend");
    const resend = new Resend(resendKey);

    // 1. Fetch Sales Reminder Settings
    let recipients: string[] = [];
    let isActive = true;
    try {
      const settingsRes = await getSalesReminderSettingsAction();
      if (settingsRes.success && settingsRes.data) {
        isActive = settingsRes.data.isActive;
        recipients = settingsRes.data.recipients;
      }
    } catch (e) {
      console.warn(
        "Failed to load sales reminder settings, using default team fallbacks:",
        e,
      );
    }

    if (!isActive) {
      return {
        success: true,
        message: "Sales reminders email notification is disabled.",
      };
    }

    // 2. Fetch Pipelines & Opportunities
    const pipelines = await getGhlPipelines(locationId);
    if (pipelines.length === 0) {
      return { success: true, message: "No GHL pipelines found." };
    }

    // Get all opportunities for the first pipeline
    const targetPipeline = pipelines[0];
    const rawOpps = await getGhlOpportunities(locationId, targetPipeline.id);

    // Fetch GHL Users
    let usersList: any[] = [];
    try {
      usersList = await getGhlUsers(locationId);
    } catch (e) {
      // Ignore
    }
    const userMap = new Map(usersList.map((u) => [u.id, u.name]));

    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

    const stalledOpps = rawOpps
      .filter(
        (o) =>
          o.status === "open" && new Date(o.updatedAt).getTime() < sevenDaysAgo,
      )
      .map((o) => {
        const ownerName = o.assignedTo
          ? userMap.get(o.assignedTo) || `User (${o.assignedTo.slice(-4)})`
          : "Unassigned";
        const daysStalled = Math.max(
          0,
          Math.floor(
            (now - new Date(o.updatedAt).getTime()) / (24 * 60 * 60 * 1000),
          ),
        );
        return { ...o, ownerName, daysStalled };
      })
      .sort((a, b) => b.daysStalled - a.daysStalled);

    if (stalledOpps.length === 0) {
      return {
        success: true,
        message: "No stalled opportunities found today.",
      };
    }

    // 3. Fallback recipients (all team members) if empty
    if (recipients.length === 0) {
      const team = await withBypassTenantDb(async (tx) => {
        return await tx.select().from(user).where(ne(user.id, SYSTEM_ACTOR));
      });
      recipients = team.map((u) => u.email).filter(Boolean);
    }

    if (recipients.length === 0) {
      throw new Error("No recipients found to email.");
    }

    // 4. Compile HTML
    const appUrl =
      process.env.BETTER_AUTH_URL ||
      "https://uprise-tools-production.up.railway.app";

    let tableRows = "";
    for (const opp of stalledOpps) {
      tableRows += `
        <tr style="border-bottom: 1px solid #f1f5f9; font-size: 13px; color: #334155;">
          <td style="padding: 12px 0;">
            <strong style="color: #1e293b;">${opp.name}</strong><br/>
            <span style="font-size: 11px; color: #64748b;">${opp.contactName} (${opp.contactEmail || "no email"})</span>
          </td>
          <td style="padding: 12px 0; font-weight: 600;">$${(opp.monetaryValue || 0).toLocaleString()}</td>
          <td style="padding: 12px 0; color: #475569;">${opp.ownerName}</td>
          <td style="padding: 12px 0; font-weight: bold; color: #ef4444;">${opp.daysStalled} days</td>
        </tr>
      `;
    }

    const htmlBody = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
        <div style="text-align: center; margin-bottom: 24px; border-bottom: 1px solid #f1f5f9; padding-bottom: 16px;">
          <img src="https://uprise-tools-production.up.railway.app/logo_white.png" alt="Uprise Logo" style="height: 36px; filter: invert(1); margin-bottom: 8px;" />
          <h1 style="margin: 0; font-size: 20px; font-weight: 800; color: #0f172a;">Sales Follow-up Required</h1>
        </div>

        <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 16px; border-radius: 8px; margin-bottom: 24px;">
          <h2 style="margin: 0; color: #991b1b; font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;">⚠️ Stalled Sales Opportunities</h2>
          <p style="margin: 6px 0 0 0; color: #7f1d1d; font-size: 13px; line-height: 1.5;">
            There are <strong>${stalledOpps.length} deals</strong> in the sales pipeline with no updates or CRM activity in the last 7+ days. Lak & Reuben, please follow up immediately.
          </p>
        </div>

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 28px;">
          <thead>
            <tr style="border-bottom: 2px solid #e2e8f0; text-align: left; font-size: 11px; font-weight: bold; color: #475569; text-transform: uppercase; letter-spacing: 0.05em;">
              <th style="padding: 8px 0; width: 45%;">Deal / Contact</th>
              <th style="padding: 8px 0; width: 20%;">Value</th>
              <th style="padding: 8px 0; width: 20%;">Owner</th>
              <th style="padding: 8px 0; width: 15%;">Stalled</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>

        <div style="text-align: center; margin-bottom: 16px;">
          <a href="${appUrl}/pipeline" style="background-color: #4f46e5; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 13px; display: inline-block; box-shadow: 0 4px 6px -1px rgba(79, 70, 229, 0.2);">
            View Pipeline & AI Action Plans
          </a>
        </div>

        <p style="text-align: center; font-size: 11px; color: #94a3b8; margin-top: 32px; border-top: 1px solid #f1f5f9; padding-top: 16px;">
          This is an automated notification from Uprise Tools Daily Sales Assistant.
        </p>
      </div>
    `;

    const subject = `⚠️ Action Required: ${stalledOpps.length} Stalled Sales Opportunities`;

    // 5. Send emails
    for (const email of recipients) {
      const emailResult = await resend.emails.send({
        from: "Uprise Tools <briefing@uprise.digital>",
        to: email,
        subject: subject,
        html: htmlBody,
      });

      // Log to email_logs
      await logEmail({
        recipient: email,
        subject: subject,
        emailType: "morning_briefing",
        status: emailResult.error ? "failed" : "success",
        resendId: emailResult.data?.id || null,
        error: emailResult.error?.message || null,
      });
    }

    return {
      success: true,
      message: `Sent stalled leads digest to ${recipients.length} recipients.`,
    };
  } catch (error: any) {
    console.error("[sendStalledOpportunitiesReminderAction Error]:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Fetches GHL Sales Reminder Settings for the organization.
 */
export async function getSalesReminderSettingsAction() {
  try {
    let orgId: string | undefined;
    try {
      const session = await auth.api.getSession({
        headers: await headers(),
      });
      if (session?.session?.activeOrganizationId) {
        orgId = session.session.activeOrganizationId;
      }
    } catch {
      // Outside HTTP context
    }

    if (!orgId) {
      const firstOrg = await withBypassTenantDb(async (tx) => {
        return await tx.query.organization.findFirst();
      });
      orgId = firstOrg?.id;
    }

    if (!orgId) {
      return {
        success: true as const,
        data: { id: 0, recipients: [], sendTime: "08:00", isActive: false },
      };
    }

    let settings = await withBypassTenantDb(async (tx) => {
      return await tx.query.salesReminderSettings.findFirst({
        where: eq(salesReminderSettings.organizationId, orgId!),
      });
    });

    if (!settings) {
      // Create default settings with all team members as default recipients
      let defaultRecipients: string[] = [];
      try {
        const team = await withBypassTenantDb(async (tx) => {
          return await tx
            .select()
            .from(user)
            .where(ne(user.id, "SYSTEM_AUTOMATION"));
        });
        defaultRecipients = team.map((u) => u.email).filter(Boolean);
      } catch (e) {
        // Ignore
      }

      const [newSettings] = await withBypassTenantDb(async (tx) => {
        return await tx
          .insert(salesReminderSettings)
          .values({
            organizationId: orgId!,
            recipients: defaultRecipients,
            sendTime: "08:00",
            isActive: true,
          })
          .returning();
      });
      settings = newSettings;
    }

    return {
      success: true as const,
      data: {
        id: settings.id,
        recipients: settings.recipients as string[],
        sendTime: settings.sendTime,
        isActive: settings.isActive,
      },
    };
  } catch (error: any) {
    console.error("[getSalesReminderSettingsAction Error]:", error);
    return { success: false as const, error: error.message };
  }
}

/**
 * Updates GHL Sales Reminder Settings for the organization.
 */
export async function updateSalesReminderSettingsAction(data: {
  recipients: string[];
  sendTime: string;
  isActive: boolean;
}) {
  try {
    let orgId: string | undefined;
    try {
      const session = await auth.api.getSession({
        headers: await headers(),
      });
      if (session?.session?.activeOrganizationId) {
        orgId = session.session.activeOrganizationId;
      }
    } catch {
      // Outside HTTP context
    }

    if (!orgId) {
      const firstOrg = await withBypassTenantDb(async (tx) => {
        return await tx.query.organization.findFirst();
      });
      orgId = firstOrg?.id;
    }

    if (!orgId) {
      throw new Error("No active organization found to update settings.");
    }

    const existing = await withBypassTenantDb(async (tx) => {
      return await tx.query.salesReminderSettings.findFirst({
        where: eq(salesReminderSettings.organizationId, orgId!),
      });
    });

    if (existing) {
      await withBypassTenantDb(async (tx) => {
        await tx
          .update(salesReminderSettings)
          .set({
            recipients: data.recipients,
            sendTime: data.sendTime,
            isActive: data.isActive,
            updatedAt: new Date(),
          })
          .where(eq(salesReminderSettings.id, existing.id));
      });
    } else {
      await withBypassTenantDb(async (tx) => {
        await tx.insert(salesReminderSettings).values({
          organizationId: orgId!,
          recipients: data.recipients,
          sendTime: data.sendTime,
          isActive: data.isActive,
        });
      });
    }

    return { success: true as const };
  } catch (error: any) {
    console.error("[updateSalesReminderSettingsAction Error]:", error);
    return { success: false as const, error: error.message };
  }
}

/**
 * Fetches the list of all registered team members.
 */
export async function getTeamMembersAction() {
  try {
    await checkAuth();
    const team = await withBypassTenantDb(async (tx) => {
      return await tx
        .select({ id: user.id, email: user.email, name: user.name })
        .from(user)
        .where(ne(user.id, "SYSTEM_AUTOMATION"));
    });
    return { success: true as const, data: team };
  } catch (error: any) {
    console.error("[getTeamMembersAction Error]:", error);
    return { success: false as const, error: error.message };
  }
}
