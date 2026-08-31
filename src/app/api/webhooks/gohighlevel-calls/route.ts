import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse, after } from "next/server";
import { db } from "@/db";
import { callRecords } from "@/db/schema";
import { autoProcessGhlCallRecord } from "@/service/call-intelligence-service";
import { getGhlCredentials } from "@/service/gohighlevel-service";

/**
 * Real-time Webhook endpoint for GoHighLevel Call Events.
 *
 * Use this URL in GoHighLevel Workflows (e.g. Trigger on 'Call Status: Completed' -> Webhook):
 * POST https://your-domain.com/api/webhooks/gohighlevel-calls?secret=YOUR_CRON_SECRET
 */
export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const secret = searchParams.get("secret");

    // Optional secret verification if CRON_SECRET is configured
    if (
      process.env.CRON_SECRET &&
      secret &&
      secret !== process.env.CRON_SECRET
    ) {
      return NextResponse.json(
        { success: false, error: "Unauthorized secret" },
        { status: 401 },
      );
    }

    const body = await req.json().catch(() => ({}));

    // Extract contact and call identifiers defensively
    const contactId =
      body.contactId ||
      body.contact?.id ||
      body.contact_id ||
      body.customData?.contactId;
    const messageId =
      body.messageId ||
      body.message?.id ||
      body.id ||
      body.callId ||
      body.customData?.messageId;
    const locationId =
      body.locationId ||
      body.location?.id ||
      body.location_id ||
      body.customData?.locationId;
    const duration =
      body.duration ||
      body.callDuration ||
      body.call?.duration ||
      body.meta?.call?.duration ||
      0;
    const direction = (
      body.direction ||
      body.callDirection ||
      body.call?.direction ||
      "inbound"
    ).toLowerCase();
    const contactName =
      body.contactName ||
      `${body.contact?.firstName || ""} ${body.contact?.lastName || ""}`.trim() ||
      body.name ||
      "Contact";
    const contactPhone =
      body.phone || body.contact?.phone || body.from || body.to || null;

    if (!contactId && !messageId) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing contactId or messageId in webhook payload",
        },
        { status: 400 },
      );
    }

    // Resolve tenant organization context
    let targetOrgId = searchParams.get("orgId");
    if (!targetOrgId) {
      const firstOrg = await db.query.organization.findFirst();
      targetOrgId = firstOrg?.id || "default-org";
    }

    const { locationId: defaultLocationId } =
      await getGhlCredentials(targetOrgId);
    const resolvedLocationId = locationId
      ? String(locationId)
      : defaultLocationId || "unknown-location";
    const resolvedMessageId = messageId
      ? String(messageId)
      : `call-${Date.now()}`;

    // Check if record exists
    let callRecordId: number;
    let existing = null;

    if (messageId) {
      const [found] = await db
        .select()
        .from(callRecords)
        .where(eq(callRecords.ghlMessageId, resolvedMessageId))
        .limit(1);
      existing = found;
    }

    if (existing) {
      callRecordId = existing.id;
    } else {
      const [inserted] = await db
        .insert(callRecords)
        .values({
          organizationId: targetOrgId,
          ghlLocationId: resolvedLocationId,
          ghlMessageId: resolvedMessageId,
          ghlContactId: contactId ? String(contactId) : null,
          contactName,
          contactPhone,
          direction,
          status: "completed",
          durationSeconds: Number(duration) || 0,
          callStartedAt: new Date(),
          audioStreamAvailable: true,
        })
        .returning({ id: callRecords.id });

      callRecordId = inserted.id;
    }

    // Execute transcription, 100-word summary, and note posting in the background
    after(async () => {
      try {
        console.log(
          `[GHL Call Webhook] Auto-processing call #${callRecordId} for contact ${contactId}...`,
        );
        const res = await autoProcessGhlCallRecord(callRecordId, targetOrgId);
        if (res.success) {
          console.log(
            `[GHL Call Webhook] Successfully posted ~100-word note into GHL for contact ${contactId}:`,
            res.noteBody,
          );
        } else {
          console.warn(
            `[GHL Call Webhook] Failed to auto-process call #${callRecordId}:`,
            res.error,
          );
        }
      } catch (procErr) {
        console.error(
          `[GHL Call Webhook] Background process error for call #${callRecordId}:`,
          procErr,
        );
      }
    });

    return NextResponse.json({
      success: true,
      message: "Call webhook received. Processing AI note for GoHighLevel.",
      callRecordId,
      contactId,
    });
  } catch (error: any) {
    console.error("GHL Call Webhook Error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
