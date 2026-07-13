import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { triggerOnboardingAutomation } from "@/actions/client-onboarding.actions";
import { db } from "@/db";
import { clientOnboardings } from "@/db/schema";

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const secret = searchParams.get("secret");

    // Verify Webhook Secret
    if (secret !== process.env.CRON_SECRET) {
      return NextResponse.json(
        { success: false, error: "Unauthorized secret key" },
        { status: 401 },
      );
    }

    const body = await req.json().catch(() => ({}));

    // Defensively extract contact details (handles flat and nested GHL structures)
    const contactId = body.contact?.id || body.contact_id || body.contactId;
    const firstName =
      body.contact?.firstName || body.first_name || body.firstName || "";
    const lastName =
      body.contact?.lastName || body.last_name || body.lastName || "";
    const email = body.contact?.email || body.email || "";
    const companyName =
      body.contact?.companyName || body.company_name || body.companyName || "";

    // Extract opportunity details
    const opportunityId =
      body.opportunity?.id || body.opportunity_id || body.opportunityId;

    if (!email) {
      return NextResponse.json(
        { success: false, error: "Missing contact email in payload" },
        { status: 400 },
      );
    }

    // Extract and parse tags for service configuration
    let tags: string[] = [];
    const rawTags = body.contact?.tags || body.tags;
    if (Array.isArray(rawTags)) {
      tags = rawTags.map((t) => String(t));
    } else if (typeof rawTags === "string") {
      tags = rawTags.split(",").map((t) => t.trim());
    }

    const googleAdsAccess =
      tags.length > 0
        ? tags.some((t) => t.toLowerCase().includes("google ads"))
        : true;
    const metaAdsAccess =
      tags.length > 0
        ? tags.some((t) => t.toLowerCase().includes("meta ads"))
        : true;

    // Resolve tenant organization context
    let targetOrgId = searchParams.get("orgId");
    if (!targetOrgId) {
      const firstOrg = await db.query.organization.findFirst();
      targetOrgId = firstOrg?.id || "default-org";
    }

    const payload = {
      organizationId: targetOrgId,
      clientName: companyName || `${firstName}'s Business` || "New Client",
      primaryContactName: `${firstName} ${lastName}`.trim() || "Client",
      contactEmail: email,
      googleAdsAccess,
      metaAdsAccess,
      ghlContactId: contactId || null,
      ghlOpportunityId: opportunityId || null,
      updatedAt: new Date(),
    };

    let onboardingId: number;

    // Avoid duplicates by checking opportunityId or contactId
    let existing = null;
    if (opportunityId) {
      existing = await db.query.clientOnboardings.findFirst({
        where: eq(clientOnboardings.ghlOpportunityId, opportunityId),
      });
    } else if (contactId) {
      existing = await db.query.clientOnboardings.findFirst({
        where: eq(clientOnboardings.ghlContactId, contactId),
      });
    }

    if (existing) {
      await db
        .update(clientOnboardings)
        .set(payload)
        .where(eq(clientOnboardings.id, existing.id));
      onboardingId = existing.id;
      console.log(
        `[GHL Webhook] Updated existing onboarding entry ID: ${onboardingId}`,
      );
    } else {
      const [inserted] = await db
        .insert(clientOnboardings)
        .values({
          ...payload,
          status: "draft",
          createdAt: new Date(),
        })
        .returning({ id: clientOnboardings.id });

      onboardingId = inserted.id;
      console.log(
        `[GHL Webhook] Created new client onboarding entry ID: ${onboardingId}`,
      );
    }

    // Trigger Google Drive folder creation & link setups in the background
    triggerOnboardingAutomation(onboardingId).catch((err) => {
      console.error(
        `[GHL Webhook] Failed to auto-trigger onboarding flow for ID ${onboardingId}:`,
        err,
      );
    });

    return NextResponse.json({ success: true, onboardingId });
  } catch (error: any) {
    console.error("[GHL Webhook] Critical Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || String(error) },
      { status: 500 },
    );
  }
}
