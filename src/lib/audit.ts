import { db } from "@/db";
import { auditLogs, emailLogs } from "@/db/schema";

export async function logAction(
  actorId: string,
  action: string,
  targetTable: string,
  targetId: string | number,
  metadata?: any,
) {
  await db.insert(auditLogs).values({
    actorId,
    action,
    targetTable,
    targetId: String(targetId), // Cast to string for consistency
    metadata,
  });
}

export async function logEmail(data: {
  adAccountId?: number | null;
  recipient: string;
  subject: string;
  emailType:
    | "morning_briefing"
    | "scheduled_report"
    | "on_demand_report"
    | "client_onboarding";
  status: "success" | "failed";
  error?: string | null;
  resendId?: string | null;
}) {
  try {
    await db.insert(emailLogs).values({
      adAccountId: data.adAccountId || null,
      recipient: data.recipient,
      subject: data.subject,
      emailType: data.emailType,
      status: data.status,
      error: data.error || null,
      resendId: data.resendId || null,
      sentAt: new Date(),
    });
  } catch (err) {
    console.error("Failed to log email distribution to database:", err);
  }
}
