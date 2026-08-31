import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { syncAllRecentGhlCallNotes } from "@/service/call-intelligence-service";

/**
 * Scheduled Cron Job: Sync and post AI 100-word summaries into GHL Contact Notes.
 *
 * GET /api/cron/sync-ghl-call-notes?secret=YOUR_CRON_SECRET
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const secret = searchParams.get("secret");

    if (
      process.env.CRON_SECRET &&
      secret &&
      secret !== process.env.CRON_SECRET
    ) {
      return NextResponse.json(
        { success: false, error: "Unauthorized cron secret" },
        { status: 401 },
      );
    }

    const organizations = await db.query.organization.findMany();
    const results = [];

    for (const org of organizations) {
      try {
        const res = await syncAllRecentGhlCallNotes(org.id, 20);
        results.push({
          orgId: org.id,
          orgName: org.name,
          ...res,
        });
      } catch (orgErr: any) {
        console.warn(`Cron GHL call sync error for org ${org.id}:`, orgErr);
        results.push({
          orgId: org.id,
          orgName: org.name,
          error: orgErr.message,
        });
      }
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      results,
    });
  } catch (error: any) {
    console.error("Cron GHL Call Notes Sync Error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
