import { and, desc, eq, ilike, like, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { adAccounts, auditLogs, emailLogs, user } from "@/db/schema";
import LogsClient from "./pageClient";

interface PageProps {
  searchParams: Promise<{
    tab?: string;
    page?: string;
    limit?: string;
    search?: string;
    action?: string;
    status?: string;
    emailType?: string;
  }>;
}

export default async function LogsPage({ searchParams }: PageProps) {
  const resolvedParams = await searchParams;
  const tab = resolvedParams.tab || "audit";
  const page = parseInt(resolvedParams.page || "1", 10);
  const limit = parseInt(resolvedParams.limit || "25", 10);
  const offset = (page - 1) * limit;
  const search = resolvedParams.search || "";
  const action = resolvedParams.action || "all";
  const status = resolvedParams.status || "all";
  const emailType = resolvedParams.emailType || "all";

  let auditLogsData: any[] = [];
  let emailLogsData: any[] = [];
  let totalCount = 0;

  if (tab === "audit") {
    // 1. Build Audit Log Where Clauses
    const whereClauses = [];

    if (search) {
      whereClauses.push(
        or(
          ilike(auditLogs.action, `%${search}%`),
          ilike(auditLogs.targetTable, `%${search}%`),
          ilike(auditLogs.targetId, `%${search}%`),
          ilike(user.name, `%${search}%`),
          ilike(user.email, `%${search}%`)
        )
      );
    }

    if (action && action !== "all") {
      if (action === "triage") {
        whereClauses.push(
          or(
            like(auditLogs.action, "%TRIAGE%"),
            like(auditLogs.action, "%TARGETS%")
          )
        );
      } else if (action === "rules") {
        whereClauses.push(like(auditLogs.action, "%RULE%"));
      } else if (action === "user") {
        whereClauses.push(like(auditLogs.action, "%USER%"));
      } else if (action === "security") {
        whereClauses.push(
          or(
            like(auditLogs.action, "%MCP_TOOLS%"),
            like(auditLogs.action, "%ROLL_MCP%")
          )
        );
      } else if (action === "system") {
        whereClauses.push(like(auditLogs.action, "%DAILY_BRIEFING%"));
      }
    }

    const whereCondition = whereClauses.length > 0 ? and(...whereClauses) : undefined;

    // 2. Fetch Audit Logs Count & Paginated Records
    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(auditLogs)
      .leftJoin(user, eq(auditLogs.actorId, user.id))
      .where(whereCondition);
    
    totalCount = Number(countResult?.count || 0);

    const records = await db
      .select({
        id: auditLogs.id,
        actorId: auditLogs.actorId,
        action: auditLogs.action,
        targetTable: auditLogs.targetTable,
        targetId: auditLogs.targetId,
        metadata: auditLogs.metadata,
        createdAt: auditLogs.createdAt,
        actorName: user.name,
        actorEmail: user.email,
        actorImage: user.image,
      })
      .from(auditLogs)
      .leftJoin(user, eq(auditLogs.actorId, user.id))
      .where(whereCondition)
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit)
      .offset(offset);

    auditLogsData = records.map((log) => ({
      id: log.id,
      actorId: log.actorId,
      action: log.action,
      targetTable: log.targetTable,
      targetId: log.targetId,
      metadata: log.metadata,
      createdAt: log.createdAt.toISOString(),
      actor: log.actorName
        ? {
            name: log.actorName,
            email: log.actorEmail,
            image: log.actorImage,
          }
        : null,
    }));
  } else {
    // 1. Build Email Log Where Clauses
    const emailWhereClauses = [];

    if (search) {
      emailWhereClauses.push(
        or(
          ilike(emailLogs.recipient, `%${search}%`),
          ilike(emailLogs.subject, `%${search}%`),
          ilike(emailLogs.emailType, `%${search}%`),
          ilike(adAccounts.name, `%${search}%`)
        )
      );
    }

    if (status && status !== "all") {
      emailWhereClauses.push(eq(emailLogs.status, status));
    }

    if (emailType && emailType !== "all") {
      emailWhereClauses.push(eq(emailLogs.emailType, emailType));
    }

    const emailWhereCondition = emailWhereClauses.length > 0 ? and(...emailWhereClauses) : undefined;

    // 2. Fetch Email Logs Count & Paginated Records
    const [emailCountResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(emailLogs)
      .leftJoin(adAccounts, eq(emailLogs.adAccountId, adAccounts.id))
      .where(emailWhereCondition);

    totalCount = Number(emailCountResult?.count || 0);

    const emailRecords = await db
      .select({
        id: emailLogs.id,
        adAccountId: emailLogs.adAccountId,
        recipient: emailLogs.recipient,
        subject: emailLogs.subject,
        emailType: emailLogs.emailType,
        status: emailLogs.status,
        error: emailLogs.error,
        resendId: emailLogs.resendId,
        sentAt: emailLogs.sentAt,
        accountName: adAccounts.name,
      })
      .from(emailLogs)
      .leftJoin(adAccounts, eq(emailLogs.adAccountId, adAccounts.id))
      .where(emailWhereCondition)
      .orderBy(desc(emailLogs.sentAt))
      .limit(limit)
      .offset(offset);

    emailLogsData = emailRecords.map((email) => ({
      id: email.id,
      adAccountId: email.adAccountId,
      recipient: email.recipient,
      subject: email.subject,
      emailType: email.emailType,
      status: email.status,
      error: email.error,
      resendId: email.resendId,
      sentAt: email.sentAt.toISOString(),
      accountName: email.accountName || null,
    }));
  }

  return (
    <LogsClient
      tab={tab}
      page={page}
      limit={limit}
      totalCount={totalCount}
      auditLogs={auditLogsData}
      emailLogs={emailLogsData}
    />
  );
}
