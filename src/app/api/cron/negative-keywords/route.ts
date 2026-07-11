import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { generateSuggestionsInternal } from "@/actions/negative-keywords.actions";
import { withBypassTenantDb } from "@/db/db-helper";
import { adAccounts } from "@/db/schema";

export const maxDuration = 300; // 5 minutes

async function processAllActiveAccounts() {
  const activeAccounts = await withBypassTenantDb(async (tx) => {
    return await tx.query.adAccounts.findMany({
      where: eq(adAccounts.isActive, true),
    });
  });

  const results: any[] = [];

  for (const account of activeAccounts) {
    try {
      console.log(
        `[Cron Negatives] Running generation for account ${account.name} (ID: ${account.id})...`,
      );

      // We do not specify dates, which means it will pull the default date period (rolling 14 days)
      const res = await generateSuggestionsInternal(
        account.id,
        undefined,
        undefined,
        "CRON_AUTOMATION",
      );

      results.push({
        accountId: account.id,
        accountName: account.name,
        success: true,
        ...res,
      });
    } catch (err: any) {
      console.error(
        `[Cron Negatives] Failed for account ${account.name} (ID: ${account.id}):`,
        err,
      );
      results.push({
        accountId: account.id,
        accountName: account.name,
        success: false,
        error: err.message || "Unknown error",
      });
    }
  }

  return results;
}

export async function POST(request: Request) {
  try {
    // 1. Verify the Secret Token
    const authHeader = request.headers.get("authorization");
    const expectedToken = `Bearer ${process.env.CRON_SECRET}`;

    if (!process.env.CRON_SECRET || authHeader !== expectedToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Process active accounts
    const details = await processAllActiveAccounts();

    return NextResponse.json(
      {
        message: "Negative keywords cron completed",
        details,
      },
      { status: 200 },
    );
  } catch (error: any) {
    console.error("Cron negative-keywords error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

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

    const details = await processAllActiveAccounts();

    return NextResponse.json(
      {
        message: "Negative keywords cron completed via GET",
        details,
      },
      { status: 200 },
    );
  } catch (error: any) {
    console.error("Cron negative-keywords GET error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
