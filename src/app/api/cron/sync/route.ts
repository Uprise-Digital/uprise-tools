import { NextResponse } from "next/server";
import { syncAgencyPortfolioAction } from "@/actions/agency.actions";
import {
  formatUTCDate,
  getMelbourneTodayStr,
  parseUTCDate,
} from "@/lib/date-utils";

// Next.js config to allow this route to run for a longer time if needed (max duration depends on your host)
export const maxDuration = 300; // 5 minutes

export async function POST(request: Request) {
  try {
    // 1. Verify the Secret Token
    const authHeader = request.headers.get("authorization");
    const expectedToken = `Bearer ${process.env.CRON_SECRET}`;

    if (!process.env.CRON_SECRET || authHeader !== expectedToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Calculate the Date Range (e.g., rolling last 30 days) in Melbourne/AEDT timezone
    const endDate = getMelbourneTodayStr();

    const endDateObj = parseUTCDate(endDate);
    const startDateObj = new Date(endDateObj);
    startDateObj.setUTCDate(endDateObj.getUTCDate() - 30);
    const startDate = formatUTCDate(startDateObj);

    // 3. Run the Sync Action
    const result = await syncAgencyPortfolioAction(startDate, endDate);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json(
      {
        message: "Sync completed successfully",
        syncedCount: result.syncedCount,
      },
      { status: 200 },
    );
  } catch (error: any) {
    console.error("Cron sync error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
