import { GoogleGenAI, Type } from "@google/genai";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { callRecords, clientOnboardings } from "@/db/schema";
import { getAiModel } from "@/lib/ai-config";
import { getGhlCredentials } from "@/service/gohighlevel-service";

const GHL_API_BASE = "https://services.leadconnectorhq.com";

export interface AnalyzedCallResult {
  summary: string;
  sentiment: "positive" | "neutral" | "negative";
  leadScore: number;
  leadScoreReasoning?: string;
  serviceRequested: string;
  estimatedBudget: string;
  urgency: string;
  objections: string[];
  keyTakeaways: string[];
  actionItems: string[];
  agentFeedback?: {
    adherence?: string;
    coachingTips?: string[];
  };
  transcript: string;
}

/**
 * Fetches the raw audio buffer from GoHighLevel's recording endpoint.
 */
export async function fetchGhlCallAudioBuffer(
  messageId: string,
  locationId: string,
  apiKey: string,
): Promise<{ buffer: Buffer; contentType: string }> {
  const url = `${GHL_API_BASE}/conversations/messages/${encodeURIComponent(messageId)}/locations/${encodeURIComponent(locationId)}/recording`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Version: "2021-04-15",
    },
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(
      `Failed to fetch call recording from GHL (Status ${res.status}): ${res.statusText || errText}`,
    );
  }

  const contentType = res.headers.get("content-type") || "audio/wav";
  const arrayBuffer = await res.arrayBuffer();
  return {
    buffer: Buffer.from(arrayBuffer),
    contentType,
  };
}

/**
 * Analyzes audio recording buffer using Gemini native multimodal audio.
 */
export async function analyzeCallAudioWithGemini(
  audioBuffer: Buffer,
  mimeType: string,
  context?: {
    contactName?: string;
    companyName?: string;
    direction?: string;
    duration?: number;
  },
): Promise<AnalyzedCallResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is not configured.");
  }

  const ai = new GoogleGenAI({ apiKey });

  // Normalize mime type for Gemini
  let cleanMimeType = mimeType.split(";")[0].trim().toLowerCase();
  if (cleanMimeType.includes("wav") || cleanMimeType === "audio/x-wav") {
    cleanMimeType = "audio/wav";
  } else if (cleanMimeType.includes("mpeg") || cleanMimeType.includes("mp3")) {
    cleanMimeType = "audio/mp3";
  } else if (cleanMimeType.includes("ogg")) {
    cleanMimeType = "audio/ogg";
  } else if (!cleanMimeType.startsWith("audio/")) {
    cleanMimeType = "audio/wav";
  }

  const base64Audio = audioBuffer.toString("base64");

  const prompt = `
You are an expert sales performance and digital agency intelligence AI analyzing a recorded customer phone call.
${context?.contactName ? `Customer Name: ${context.contactName}` : ""}
${context?.companyName ? `Client / Business: ${context.companyName}` : ""}
${context?.direction ? `Call Direction: ${context.direction}` : ""}
${context?.duration ? `Call Duration: ${context.duration} seconds` : ""}

Analyze the audio recording thoroughly and provide:
1. Full verbatim speaker-separated transcript with timestamps or turn labels (e.g. "Agent: ...", "Customer: ...").
2. Concise executive summary of what was discussed.
3. Lead qualification rating score from 1 (unqualified tyre-kicker / spam / wrong number) to 10 (hot high-intent customer / ready to buy / high-ticket commercial deal).
4. Sentiment: positive, neutral, or negative.
5. Extracted service requested (e.g., Earthmoving, Tipper Hire, Roofing, Plumbing, etc.).
6. Extracted estimated budget or quoted value (e.g. "$15,000", "$500/day", or "Not mentioned").
7. Urgency (e.g., "Immediate", "Within 2 weeks", "Next month", "Flexible").
8. Key objections or hesitations raised by the customer.
9. Key takeaways (3-5 core points).
10. Action items & next steps for the sales team.
11. Sales agent feedback & coaching tips.
`;

  const response = await ai.models.generateContent({
    model: getAiModel("high"),
    contents: [
      {
        role: "user",
        parts: [
          {
            inlineData: {
              data: base64Audio,
              mimeType: cleanMimeType,
            },
          },
          {
            text: prompt,
          },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          summary: { type: Type.STRING },
          sentiment: {
            type: Type.STRING,
            enum: ["positive", "neutral", "negative"],
          },
          leadScore: { type: Type.INTEGER },
          leadScoreReasoning: { type: Type.STRING },
          serviceRequested: { type: Type.STRING },
          estimatedBudget: { type: Type.STRING },
          urgency: { type: Type.STRING },
          objections: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          keyTakeaways: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          actionItems: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          agentFeedback: {
            type: Type.OBJECT,
            properties: {
              adherence: { type: Type.STRING },
              coachingTips: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
            },
          },
          transcript: { type: Type.STRING },
        },
        required: [
          "summary",
          "sentiment",
          "leadScore",
          "serviceRequested",
          "estimatedBudget",
          "urgency",
          "objections",
          "keyTakeaways",
          "actionItems",
          "transcript",
        ],
      },
    },
  });

  const text = response.text;
  if (!text) {
    throw new Error("Gemini returned empty response for call audio analysis.");
  }

  const parsed = JSON.parse(text) as AnalyzedCallResult;
  // Ensure score is clamped 1-10
  parsed.leadScore = Math.max(1, Math.min(10, Number(parsed.leadScore) || 5));
  return parsed;
}

/**
 * Syncs and saves call insights to GoHighLevel Contact Notes.
 */
export async function syncCallInsightsToGhl(
  callRecordId: number,
  organizationId?: string,
): Promise<{ success: boolean; noteId?: string }> {
  const [record] = await db
    .select()
    .from(callRecords)
    .where(eq(callRecords.id, callRecordId))
    .limit(1);

  if (!record) {
    throw new Error(`Call record #${callRecordId} not found.`);
  }

  if (!record.ghlContactId) {
    throw new Error(
      "Cannot sync to GHL: No GHL Contact ID associated with this call.",
    );
  }

  const orgId = organizationId || record.organizationId;
  const { apiKey } = await getGhlCredentials(orgId);

  const formattedScore = record.leadScore
    ? `${record.leadScore}/10 ${
        record.leadScore >= 8
          ? "🔥 (High Intent)"
          : record.leadScore >= 5
            ? "⚡ (Moderate)"
            : "❄️ (Unqualified)"
      }`
    : "N/A";

  const actionItemsList = Array.isArray(record.actionItems)
    ? (record.actionItems as string[])
        .map((item, idx) => `${idx + 1}. ${item}`)
        .join("\n")
    : "None listed";

  const keyPointsList = Array.isArray(record.keyTakeaways)
    ? (record.keyTakeaways as string[]).map((p) => `• ${p}`).join("\n")
    : "None listed";

  const noteBody = `🎙️ [AI Call Intelligence - Uprise Tools]
━━━━━━━━━━━━━━━━━━━━━━━━━━
• Lead Score: ${formattedScore}
• Sentiment: ${(record.sentiment || "neutral").toUpperCase()}
• Service Requested: ${record.serviceRequested || "Not specified"}
• Estimated Budget: ${record.estimatedBudget || "Not specified"}
• Urgency: ${record.urgency || "Not specified"}
• Duration: ${Math.round((record.durationSeconds || 0) / 60)} mins (${record.durationSeconds}s)

📋 Summary:
${record.summary || "No summary available"}

🎯 Action Items:
${actionItemsList}

💡 Key Discussion Points:
${keyPointsList}
━━━━━━━━━━━━━━━━━━━━━━━━━━
Audio recording & verbatim transcript available in Uprise Tools.`;

  const url = `${GHL_API_BASE}/contacts/${encodeURIComponent(record.ghlContactId)}/notes`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Version: "2021-04-15",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      body: noteBody,
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Failed to post note to GHL: ${res.statusText || errText}`);
  }

  const data = await res.json().catch(() => ({}));

  await db
    .update(callRecords)
    .set({
      syncedToGhl: true,
      syncedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(callRecords.id, callRecordId));

  return { success: true, noteId: data?.note?.id || data?.id };
}

/**
 * Searches and syncs all call records from GHL for a specific client onboarding.
 */
export async function syncClientCallHistory(
  clientOnboardingId: number,
  organizationId: string,
): Promise<{ totalFound: number; totalImported: number }> {
  const [client] = await db
    .select()
    .from(clientOnboardings)
    .where(
      and(
        eq(clientOnboardings.id, clientOnboardingId),
        eq(clientOnboardings.organizationId, organizationId),
      ),
    )
    .limit(1);

  if (!client) {
    throw new Error(`Client onboarding #${clientOnboardingId} not found.`);
  }

  const { apiKey, locationId } = await getGhlCredentials(organizationId);
  if (!locationId) {
    throw new Error("GHL Location ID is not configured for this organization.");
  }

  const headers = {
    Authorization: `Bearer ${apiKey}`,
    Version: "2021-04-15",
    "Content-Type": "application/json",
  };

  const conversationsToSearch: {
    id: string;
    contactId?: string;
    contactName?: string;
  }[] = [];

  // 1. If client has ghlContactId, search conversations for that contact
  if (client.ghlContactId) {
    const searchUrl = `${GHL_API_BASE}/conversations/search?locationId=${encodeURIComponent(locationId)}&contactId=${encodeURIComponent(client.ghlContactId)}&limit=10`;
    const res = await fetch(searchUrl, { headers });
    if (res.ok) {
      const data = await res.json();
      for (const conv of data.conversations || []) {
        conversationsToSearch.push({
          id: conv.id,
          contactId: conv.contactId || client.ghlContactId,
          contactName: conv.contactName || client.primaryContactName,
        });
      }
    }
  }

  // 2. Also search by email or client name if not found
  if (conversationsToSearch.length === 0 && client.contactEmail) {
    const searchUrl = `${GHL_API_BASE}/conversations/search?locationId=${encodeURIComponent(locationId)}&query=${encodeURIComponent(client.contactEmail)}&limit=10`;
    const res = await fetch(searchUrl, { headers });
    if (res.ok) {
      const data = await res.json();
      for (const conv of data.conversations || []) {
        conversationsToSearch.push({
          id: conv.id,
          contactId: conv.contactId || client.ghlContactId || undefined,
          contactName: conv.contactName || client.primaryContactName,
        });
      }
    }
  }

  // 3. If still not found, search by phone
  if (conversationsToSearch.length === 0 && client.contactPhone) {
    const searchUrl = `${GHL_API_BASE}/conversations/search?locationId=${encodeURIComponent(locationId)}&query=${encodeURIComponent(client.contactPhone)}&limit=10`;
    const res = await fetch(searchUrl, { headers });
    if (res.ok) {
      const data = await res.json();
      for (const conv of data.conversations || []) {
        conversationsToSearch.push({
          id: conv.id,
          contactId: conv.contactId || client.ghlContactId || undefined,
          contactName: conv.contactName || client.primaryContactName,
        });
      }
    }
  }

  let totalFound = 0;
  let totalImported = 0;

  for (const conv of conversationsToSearch) {
    const msgUrl = `${GHL_API_BASE}/conversations/${conv.id}/messages`;
    const msgRes = await fetch(msgUrl, { headers });
    if (!msgRes.ok) continue;

    const msgData = await msgRes.json();
    const messages = msgData.messages?.messages || msgData.messages || [];

    const callMessages = messages.filter(
      (m: any) =>
        m.messageType === "CALL" ||
        m.messageType === "TYPE_CALL" ||
        m.messageType?.toLowerCase().includes("call") ||
        m.meta?.call ||
        m.call,
    );

    totalFound += callMessages.length;

    for (const callMsg of callMessages) {
      const ghlMessageId = callMsg.id;
      const durationSeconds =
        callMsg.meta?.call?.duration ??
        callMsg.call?.duration ??
        callMsg.duration ??
        0;
      const direction = (callMsg.direction || "inbound").toLowerCase();
      const status =
        callMsg.meta?.call?.status ?? callMsg.status ?? "completed";
      const callStartedAt = callMsg.dateAdded
        ? new Date(callMsg.dateAdded)
        : new Date();
      const contactPhone =
        callMsg.from?.startsWith("+") || /^\d+$/.test(callMsg.from || "")
          ? callMsg.from
          : callMsg.to?.startsWith("+") || /^\d+$/.test(callMsg.to || "")
            ? callMsg.to
            : client.contactPhone || null;

      // Upsert into callRecords
      const [existing] = await db
        .select({ id: callRecords.id })
        .from(callRecords)
        .where(eq(callRecords.ghlMessageId, ghlMessageId))
        .limit(1);

      if (existing) {
        await db
          .update(callRecords)
          .set({
            clientOnboardingId: client.id,
            ghlContactId: conv.contactId || client.ghlContactId,
            contactName: conv.contactName || client.primaryContactName,
            contactEmail: client.contactEmail,
            contactPhone,
            durationSeconds,
            direction,
            status,
            updatedAt: new Date(),
          })
          .where(eq(callRecords.id, existing.id));
      } else {
        await db.insert(callRecords).values({
          organizationId,
          clientOnboardingId: client.id,
          ghlLocationId: locationId,
          ghlConversationId: conv.id,
          ghlMessageId,
          ghlContactId: conv.contactId || client.ghlContactId,
          contactName: conv.contactName || client.primaryContactName,
          contactEmail: client.contactEmail,
          contactPhone,
          direction,
          status,
          durationSeconds,
          callStartedAt,
          audioStreamAvailable: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        totalImported++;
      }
    }
  }

  return { totalFound, totalImported };
}
