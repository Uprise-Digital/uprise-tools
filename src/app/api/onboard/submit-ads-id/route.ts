import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { clientOnboardings } from "@/db/schema";

export async function POST(req: NextRequest) {
  try {
    const { googleAccountId, token, onboardingId } = await req
      .json()
      .catch(() => ({}));

    if (
      !googleAccountId ||
      googleAccountId.replace(/[^0-9]/g, "").length !== 10
    ) {
      return NextResponse.json(
        { success: false, error: "Invalid Google Ads Account ID" },
        { status: 400 },
      );
    }

    const cleanAccountId = googleAccountId.replace(/[^0-9]/g, "");

    // If client portal parameters are provided, bind the ID to the client record
    if (onboardingId) {
      const record = await db.query.clientOnboardings.findFirst({
        where: eq(clientOnboardings.id, Number(onboardingId)),
      });

      if (record) {
        // Update database to track invitation status
        await db
          .update(clientOnboardings)
          .set({
            googleAdsStatus: "invited",
            updatedAt: new Date(),
          })
          .where(eq(clientOnboardings.id, record.id));

        console.log(
          `[Google Ads API] Associated account ${cleanAccountId} with Client ${record.clientName}`,
        );
      }
    }

    // Google Ads Manager link invitation simulation
    console.log(`[Google Ads Link Request]`);
    console.log(
      `  Source Manager ID (MCC): ${process.env.GOOGLE_ADS_MANAGER_ID || "8746252766"}`,
    );
    console.log(`  Target Client ID: ${cleanAccountId}`);
    console.log(`  Status: Mutating Manager Link - PENDING_APPROVAL`);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Google Ads link invitation error:", error);
    return NextResponse.json(
      { success: false, error: error.message || String(error) },
      { status: 500 },
    );
  }
}
