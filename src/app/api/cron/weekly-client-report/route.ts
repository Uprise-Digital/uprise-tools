import { NextResponse } from "next/server";
import { sendWeeklyClientReportAction } from "@/actions/weekly-client-report.actions";

export const maxDuration = 300; // 5 minutes

export async function POST(request: Request) {
  try {
    // 1. Verify the Secret Token
    const authHeader = request.headers.get("authorization");
    const expectedToken = `Bearer ${process.env.CRON_SECRET}`;

    if (!process.env.CRON_SECRET || authHeader !== expectedToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // CRITICAL AGENCY SAFEGUARD: NO EMAILS TO BE SENT THROUGH AUTOMATION
    console.log(
      "[Cron] Weekly client report automation is strictly disabled per agency policy. Skipping.",
    );
    return NextResponse.json({
      success: true,
      message: "Weekly client report automation is strictly disabled. No emails sent through automation.",
    });
  } catch (error: any) {
    console.error("Cron weekly-client-report error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

// Support GET for manual verification/trigger if secret matches in query param or header
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get("secret");
    const recipient = searchParams.get("recipient") || undefined;

    const authHeader = request.headers.get("authorization");
    const expectedToken = `Bearer ${process.env.CRON_SECRET}`;

    const isAuthorized =
      (process.env.CRON_SECRET && authHeader === expectedToken) ||
      (process.env.CRON_SECRET && secret === process.env.CRON_SECRET);

    if (!isAuthorized) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // CRITICAL AGENCY SAFEGUARD: NO EMAILS TO BE SENT THROUGH AUTOMATION
    console.log(
      "[Cron] Weekly client report automation is strictly disabled per agency policy. Skipping.",
    );
    return NextResponse.json({
      success: true,
      message: "Weekly client report automation is strictly disabled. No emails sent through automation.",
    });
  } catch (error: any) {
    console.error("Cron weekly-client-report GET error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
