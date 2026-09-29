import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { generateSuggestionsInternal } from "@/actions/negative-keywords.actions";
import { withBypassTenantDb } from "@/db/db-helper";
import { adAccounts } from "@/db/schema";

export const maxDuration = 300; // 5 minutes

async function parseBatchParams(request: Request) {
  const url = new URL(request.url);
  let offset = url.searchParams.has("offset")
    ? parseInt(url.searchParams.get("offset")!, 10)
    : undefined;
  let limit = url.searchParams.has("limit")
    ? parseInt(url.searchParams.get("limit")!, 10)
    : undefined;

  if (request.method === "POST") {
    try {
      const cloned = request.clone();
      const body = await cloned.json().catch(() => null);
      if (body) {
        if (offset === undefined && typeof body.offset === "number") {
          offset = body.offset;
        }
        if (limit === undefined && typeof body.limit === "number") {
          limit = body.limit;
        }
      }
    } catch {}
  }

  const isAll = url.searchParams.get("all") === "true";
  const parsedOffset = Number.isInteger(offset) && offset! >= 0 ? offset! : 0;
  const parsedLimit = isAll
    ? undefined
    : Number.isInteger(limit) && limit! > 0
      ? Math.min(limit!, 50)
      : 5; // Default batch size: 5 accounts per invocation to comfortably avoid timeouts

  return { offset: parsedOffset, limit: parsedLimit };
}

async function processAccountsBatch(offset = 0, limit?: number) {
  const activeAccounts = await withBypassTenantDb(async (tx) => {
    return await tx.query.adAccounts.findMany({
      where: eq(adAccounts.isActive, true),
      orderBy: (table, { asc }) => [asc(table.id)],
    });
  });

  const total = activeAccounts.length;
  const targetAccounts =
    limit !== undefined
      ? activeAccounts.slice(offset, offset + limit)
      : activeAccounts;

  const results: any[] = [];

  for (const account of targetAccounts) {
    try {
      console.log(
        `[Cron Negatives] Running generation for account ${account.name} (ID: ${account.id})...`,
      );

      // Rolling 14 days, actorId "CRON_AUTOMATION" ensures saved to pending review queue
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

  const processed = targetAccounts.length;
  const effectiveLimit = limit ?? total;
  const hasMore = offset + processed < total;
  const nextOffset = hasMore ? offset + processed : null;

  return {
    total,
    offset,
    limit: effectiveLimit,
    processed,
    hasMore,
    nextOffset,
    results,
  };
}

export async function POST(request: Request) {
  try {
    // 1. Verify Secret Token
    const authHeader = request.headers.get("authorization");
    const expectedToken = `Bearer ${process.env.CRON_SECRET}`;

    if (!process.env.CRON_SECRET || authHeader !== expectedToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Process batch of active accounts
    const { offset, limit } = await parseBatchParams(request);
    const batchResult = await processAccountsBatch(offset, limit);

    return NextResponse.json(
      {
        message: "Negative keywords cron completed",
        ...batchResult,
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

    const { offset, limit } = await parseBatchParams(request);
    const batchResult = await processAccountsBatch(offset, limit);

    return NextResponse.json(
      {
        message: "Negative keywords cron completed via GET",
        ...batchResult,
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
