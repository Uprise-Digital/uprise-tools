import { and, count, eq, gte } from "drizzle-orm";
import { db } from "@/db";
import {
  adGroupAdAudits,
  landingPageAudits,
  threatMatrixAudits,
} from "@/db/schema";
import { getMelbourneTodayStr, parseUTCDate } from "@/lib/date-utils";

/**
 * Checks if the organization has exceeded its daily audit limit.
 * The daily audit limit is read from the `DAILY_AUDIT_LIMIT` environment variable (default: 10).
 */
export async function checkDailyAuditLimit(organizationId: string): Promise<{
  allowed: boolean;
  limit: number;
  current: number;
}> {
  // Read limit from environment variable (soft cap easily editable as code/env)
  const limitStr = process.env.DAILY_AUDIT_LIMIT;
  const limit = limitStr ? parseInt(limitStr, 10) : 10;

  // Calculate start of today (UTC) in Melbourne timezone context
  const todayStr = getMelbourneTodayStr(); // e.g. "2026-07-09"
  const startOfDay = parseUTCDate(todayStr);

  // 1. Count Landing Page Audits today
  const [lpCountResult] = await db
    .select({ val: count() })
    .from(landingPageAudits)
    .where(
      and(
        eq(landingPageAudits.organizationId, organizationId),
        gte(landingPageAudits.createdAt, startOfDay),
      ),
    );

  // 2. Count Ad Group Ad Audits today
  const [adCountResult] = await db
    .select({ val: count() })
    .from(adGroupAdAudits)
    .where(
      and(
        eq(adGroupAdAudits.organizationId, organizationId),
        gte(adGroupAdAudits.createdAt, startOfDay),
      ),
    );

  // 3. Count Competitor Threat Matrix Audits today
  const [tmCountResult] = await db
    .select({ val: count() })
    .from(threatMatrixAudits)
    .where(
      and(
        eq(threatMatrixAudits.organizationId, organizationId),
        gte(threatMatrixAudits.createdAt, startOfDay),
      ),
    );

  const current =
    Number(lpCountResult?.val ?? 0) +
    Number(adCountResult?.val ?? 0) +
    Number(tmCountResult?.val ?? 0);

  return {
    allowed: current < limit,
    limit,
    current,
  };
}
