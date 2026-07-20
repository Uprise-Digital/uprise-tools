"use server";

import { headers } from "next/headers";
import { generateContentTracked } from "@/lib/ai-logger";
import { auth } from "@/lib/auth";
import {
  createContactNote,
  getContactNotes,
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
 * Uses Gemini to generate an action revival plan and outreach templates for a stalled prospect.
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
  },
) {
  try {
    await checkAuth();

    const prompt = `
      You are an expert sales director and growth coach.
      Analyze this STALLED sales opportunity from our pipeline and write an actionable revival plan.
      
      DEAL DETAILS:
      - Prospect / Deal Name: ${details.name}
      - Contact: ${details.contactName}
      - Stage: ${details.stageName}
      - Deal Value: $${details.value} USD
      - Stalled Period: ${details.daysStalled} days without contact/update
      - Assigned Owner: ${details.ownerName}
      
      OUTPUT FORMAT (Strict JSON):
      {
        "strategy": "A brief 2-sentence summary of the outreach angle to revive interest.",
        "steps": [
          "Action Step 1 (Immediate - e.g. Phone call or SMS check-in detailing specific hook)",
          "Action Step 2 (Follow-up - e.g. Email template or audit link to share)",
          "Action Step 3 (Closing loop - e.g. A final break-up text or scheduling proposal)"
        ],
        "outreachScript": "A professional, punchy, high-conversion email or SMS message template ready to copy-paste. Tailored to the deal details. Keep it short, casual, and low-friction.",
        "recommendedFollowUpDays": 3
      }
      
      CONSTRAINTS:
      - Do NOT wrap in markdown block code tags (e.g. \`\`\`json). Output raw json string only.
      - Make the outreach script highly contextual to the ${details.stageName} stage.
    `;

    const result = await generateContentTracked(
      {
        model: "gemini-2.5-flash",
        contents: prompt,
        config: { responseMimeType: "application/json" },
      },
      {
        feature: "sales_pipeline_revival",
      },
    );

    const parsedPlan = JSON.parse(result.response.text as string);
    return {
      success: true as const,
      plan: parsedPlan,
      usageAlert: result.usageAlert,
    };
  } catch (error: any) {
    console.error("[generateRevivalPlanAction Error]:", error);
    return { success: false as const, error: error.message };
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
        model: "gemini-2.5-flash",
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
