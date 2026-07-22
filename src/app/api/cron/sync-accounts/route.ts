import { NextResponse } from "next/server";
import { syncAllConnectionsMetadataAction } from "@/actions/settings.actions";

// Next.js config to allow this route to run for a longer time if needed
export const maxDuration = 300; // 5 minutes

export async function POST(request: Request) {
  try {
    // 1. Verify the Secret Token
    const authHeader = request.headers.get("authorization");
    const expectedToken = `Bearer ${process.env.CRON_SECRET}`;

    if (!process.env.CRON_SECRET || authHeader !== expectedToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Run the Sync Action
    const result = await syncAllConnectionsMetadataAction();

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json(
      {
        message: "Accounts metadata sync completed successfully",
        processedCount: result.processedCount,
        successCount: result.successCount,
      },
      { status: 200 },
    );
  } catch (error: any) {
    console.error("Cron sync accounts error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
