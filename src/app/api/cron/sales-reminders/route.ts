import { NextResponse } from "next/server";
import { sendStalledOpportunitiesReminderAction } from "@/actions/pipeline.actions";

export const maxDuration = 300; // 5 minutes

export async function POST(request: Request) {
  try {
    // 1. Verify the Secret Token
    const authHeader = request.headers.get("authorization");
    const expectedToken = `Bearer ${process.env.CRON_SECRET}`;

    if (!process.env.CRON_SECRET || authHeader !== expectedToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Trigger the Sales Reminder send
    const result = await sendStalledOpportunitiesReminderAction();

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json(
      {
        message: "Sales Reminders sent successfully",
        details: result.message,
      },
      { status: 200 },
    );
  } catch (error: any) {
    console.error("Cron sales-reminders error:", error);
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

    const authHeader = request.headers.get("authorization");
    const expectedToken = `Bearer ${process.env.CRON_SECRET}`;

    const isAuthorized =
      (process.env.CRON_SECRET && authHeader === expectedToken) ||
      (process.env.CRON_SECRET && secret === process.env.CRON_SECRET);

    if (!isAuthorized) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await sendStalledOpportunitiesReminderAction();

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json(
      {
        message: "Sales Reminders sent successfully via GET",
        details: result.message,
      },
      { status: 200 },
    );
  } catch (error: any) {
    console.error("Cron sales-reminders GET error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
