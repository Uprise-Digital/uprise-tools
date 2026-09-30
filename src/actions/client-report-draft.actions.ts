"use server";

import { and, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { Resend } from "resend";
import { db } from "@/db";
import {
  adAccounts,
  adPerformanceDaily,
  emailLogs,
  metaAdAccounts,
  metaAdsConnections,
  reportSchedules,
} from "@/db/schema";
import {
  isAccountMatch,
  normalizeAccountName,
  stemAccountName,
} from "@/lib/account-unification";
import {
  type ExecutiveBriefingParams,
  generateExecutiveBriefing,
} from "@/lib/ai-service";
import { logAction, logEmail } from "@/lib/audit";
import { auth } from "@/lib/auth";
import { getAuthOrgContext } from "@/lib/auth-helpers";
import { decryptToken } from "@/lib/crypto";
import { enforceEmailSafeguard, SAFE_AGENT_EMAIL } from "@/lib/email-guard";
import { parseMetaActionsConv } from "@/lib/meta-utils";
import { getOrCreatePublicShareUrlInternal } from "@/actions/share-dashboard.actions";

const resend = new Resend(process.env.RESEND_API_KEY || "re_dummy_build_key");

export interface ClientDraftEmailResponse {
  adAccountId: number;
  accountName: string;
  googleAccountId: string;
  recipientEmail: string;
  ccEmails: string;
  subject: string;
  plainText: string;
  htmlContent: string;
  fullHtml: string;
  publicShareUrl: string;
  hasMeta: boolean;
  metaAccountName: string | null;
  googleMetrics: {
    spend: number;
    conversions: number;
    cpl: number;
    clicks: number;
    ctr: number;
    cpc: number;
    priorSpend?: number;
    priorConversions?: number;
    priorCpl?: number;
  };
  metaMetrics: {
    spend: number;
    conversions: number;
    cpl: number;
  } | null;
  wordLimitTier: "concise" | "standard" | "detailed";
  customInstructions: string;
}

/**
 * Builds email HTML from user-editable plain text while preserving
 * Lakshane's executive styling, typography, links, and signature footer.
 */
export async function buildHtmlFromExecutiveText(
  bodyText: string,
  clientName: string,
  options?: {
    senderName?: string;
    senderRole?: string;
    senderPhone?: string;
    senderWebsite?: string;
  },
): Promise<string> {
  const senderName = options?.senderName || "Lakshane Fonseka";
  const senderRole = options?.senderRole || "Founder | Uprise Digital";
  const senderPhone = options?.senderPhone || "+61 426 759 756";
  const senderWebsite = options?.senderWebsite || "www.uprisedigital.com.au";
  const cleanWebsite = senderWebsite.replace(/^https?:\/\//, "");

  // Linkify URLs
  const linkify = (text: string) => {
    return text.replace(
      /(https?:\/\/[^\s<]+)/g,
      '<a href="$1" style="color: #1155cc; text-decoration: underline;" target="_blank" rel="noopener noreferrer">$1</a>',
    );
  };

  // Convert double newlines to paragraphs
  const paragraphs = bodyText
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  const paragraphsHtml = paragraphs
    .map((p) => {
      // Handle single newlines inside a paragraph as <br />
      const formatted = linkify(p).replace(/\n/g, "<br />");
      return `<p style="margin: 0 0 14px 0; line-height: 1.6; color: inherit;">${formatted}</p>`;
    })
    .join("\n    ");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 14px; line-height: 1.6; color: inherit;">
  <div style="max-width: 600px; margin: 0; text-align: left;">
    ${paragraphsHtml}

    <!-- Uprise Executive Signature Footer -->
    <table border="0" cellspacing="0" cellpadding="0" style="margin-top: 24px; border-collapse: collapse;">
      <tr>
        <td valign="middle" style="padding-right: 18px; vertical-align: middle;">
          <img src="https://tools.uprisedigital.com.au/logo_black.png" alt="Uprise Digital" width="95" style="display: block; width: 95px; height: auto;" />
        </td>
        <td valign="middle" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 13.5px; line-height: 1.45; vertical-align: middle;">
          <div style="font-weight: 700; font-size: 14.5px; color: #0a2540;">${senderName}</div>
          <div style="color: #475569; margin-top: 2px;">${senderRole}</div>
          <div style="color: #475569; margin-top: 2px;">${senderPhone}</div>
          <div style="margin-top: 2px;">
            <a href="https://${cleanWebsite}" style="color: #1155cc; text-decoration: underline;">${cleanWebsite}</a>
          </div>
        </td>
      </tr>
    </table>
  </div>
</body>
</html>`;
}

/**
 * Generate an executive email draft for a specific client account.
 * Supports custom instructions (prompt injection), word limit tiers, and multi-channel toggling.
 */
export async function generateClientDraftEmailAction(params: {
  adAccountId: number;
  customInstructions?: string;
  wordLimitTier?: "concise" | "standard" | "detailed";
  channels?: ("google" | "meta")[];
}): Promise<{
  success: boolean;
  data?: ClientDraftEmailResponse;
  error?: string;
}> {
  try {
    let orgId = "default-org";
    let userId = "system";
    try {
      const session = await auth.api.getSession({ headers: await headers() });
      if (session) {
        userId = session.user.id;
        const ctx = await getAuthOrgContext();
        if (ctx?.orgId) orgId = ctx.orgId;
      }
    } catch {
      // Fallback if called outside HTTP context
    }

    const { adAccountId, channels = ["google", "meta"] } = params;
    const wordLimitTier = params.wordLimitTier || "standard";

    // 1. Fetch Ad Account & Schedule Defaults
    const account = await db.query.adAccounts.findFirst({
      where: eq(adAccounts.id, adAccountId),
      with: {
        reportSchedules: true,
      },
    });

    if (!account) {
      return { success: false, error: "Ad account not found." };
    }

    if (account.organizationId) {
      orgId = account.organizationId;
    }

    const primarySchedule = (account as any).reportSchedules?.[0] || null;
    const recipientEmail = primarySchedule?.recipientEmail || "";
    const ccEmails = primarySchedule?.ccEmails || "";
    const effectiveInstructions =
      params.customInstructions !== undefined
        ? params.customInstructions
        : primarySchedule?.customAiInstructions || "";

    // 2. Obtain Public Dashboard Share URL (No login required)
    const publicShareUrl = await getOrCreatePublicShareUrlInternal(
      adAccountId,
      orgId,
    );

    // 3. Determine Date Range: Last 30 Days & Prior 30 Days
    const now = new Date();
    const endDateObj = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startDateObj = new Date(endDateObj);
    startDateObj.setDate(startDateObj.getDate() - 30);

    const priorEndObj = new Date(startDateObj);
    priorEndObj.setDate(priorEndObj.getDate() - 1);
    const priorStartObj = new Date(priorEndObj);
    priorStartObj.setDate(priorStartObj.getDate() - 30);

    const startDateStr = startDateObj.toISOString().split("T")[0];
    const endDateStr = endDateObj.toISOString().split("T")[0];
    const priorStartStr = priorStartObj.toISOString().split("T")[0];
    const priorEndStr = priorEndObj.toISOString().split("T")[0];

    // 4. Fetch Google Ads Performance (Current 30 Days + Prior 30 Days)
    const currentGoogleRows = await db
      .select({
        spend: sql<string>`COALESCE(SUM(${adPerformanceDaily.spend}), 0)`,
        clicks: sql<number>`COALESCE(SUM(${adPerformanceDaily.clicks}), 0)`,
        impressions: sql<number>`COALESCE(SUM(${adPerformanceDaily.impressions}), 0)`,
        conversions: sql<string>`COALESCE(SUM(${adPerformanceDaily.conversions}), 0)`,
      })
      .from(adPerformanceDaily)
      .where(
        and(
          eq(adPerformanceDaily.adAccountId, adAccountId),
          gte(adPerformanceDaily.date, startDateStr),
          lte(adPerformanceDaily.date, endDateStr),
        ),
      );

    const priorGoogleRows = await db
      .select({
        spend: sql<string>`COALESCE(SUM(${adPerformanceDaily.spend}), 0)`,
        conversions: sql<string>`COALESCE(SUM(${adPerformanceDaily.conversions}), 0)`,
      })
      .from(adPerformanceDaily)
      .where(
        and(
          eq(adPerformanceDaily.adAccountId, adAccountId),
          gte(adPerformanceDaily.date, priorStartStr),
          lte(adPerformanceDaily.date, priorEndStr),
        ),
      );

    const gSpend = parseFloat(currentGoogleRows[0]?.spend || "0");
    const gClicks = Number(currentGoogleRows[0]?.clicks || 0);
    const gImpr = Number(currentGoogleRows[0]?.impressions || 0);
    const gConv = parseFloat(currentGoogleRows[0]?.conversions || "0");
    const gCpl = gConv > 0 ? gSpend / gConv : gSpend;
    const gCtr = gImpr > 0 ? (gClicks / gImpr) * 100 : 0;
    const gCpc = gClicks > 0 ? gSpend / gClicks : 0;

    const priorSpend = parseFloat(priorGoogleRows[0]?.spend || "0");
    const priorConv = parseFloat(priorGoogleRows[0]?.conversions || "0");
    const priorCpl = priorConv > 0 ? priorSpend / priorConv : undefined;

    // 5. Check & Fetch Meta Ads Data
    let metaMetrics: { spend: number; conversions: number; cpl: number } | null =
      null;
    let linkedMetaName: string | null = null;
    let hasMeta = false;

    const orgMetaAccounts = await db.query.metaAdAccounts.findMany({
      where: eq(metaAdAccounts.organizationId, orgId),
    });

    let matchedMeta = account.clientId
      ? orgMetaAccounts.find((m) => m.clientId === account.clientId)
      : undefined;

    if (!matchedMeta && account.clientOnboardingId) {
      matchedMeta = orgMetaAccounts.find(
        (m) => m.clientOnboardingId === account.clientOnboardingId,
      );
    }

    const normAccountName = normalizeAccountName(account.name);
    if (!matchedMeta && normAccountName) {
      matchedMeta = orgMetaAccounts.find(
        (m) => normalizeAccountName(m.name) === normAccountName,
      );
    }

    const stemName = stemAccountName(account.name);
    if (!matchedMeta && stemName) {
      matchedMeta = orgMetaAccounts.find(
        (m) => stemAccountName(m.name) === stemName,
      );
    }

    if (!matchedMeta) {
      matchedMeta = orgMetaAccounts.find((m) =>
        isAccountMatch(account.name, m.name),
      );
    }

    if (matchedMeta) {
      hasMeta = true;
      linkedMetaName = matchedMeta.name;

      // If user enabled meta channel, fetch 30-day stats
      if (channels.includes("meta")) {
        try {
          const metaConn = await db.query.metaAdsConnections.findFirst({
            where: eq(metaAdsConnections.organizationId, orgId),
          });

          if (metaConn) {
            const rawToken = decryptToken(metaConn.accessToken);
            const actId = `act_${matchedMeta.metaAccountId.replace(/^act_/, "")}`;
            const timeRangeParam = encodeURIComponent(
              JSON.stringify({ since: startDateStr, until: endDateStr }),
            );

            const dailyUrl = `https://graph.facebook.com/v19.0/${actId}/insights?fields=spend,conversions,actions&time_range=${timeRangeParam}&access_token=${encodeURIComponent(rawToken)}&limit=10`;
            const metaRes = await fetch(dailyUrl).then((r) => r.json());

            if (Array.isArray(metaRes?.data) && metaRes.data.length > 0) {
              let mSpend = 0;
              let mConv = 0;
              for (const row of metaRes.data) {
                mSpend += parseFloat(row.spend || "0");
                mConv += parseMetaActionsConv(row.actions);
              }
              const mCpl = mConv > 0 ? mSpend / mConv : mSpend;
              metaMetrics = {
                spend: mSpend,
                conversions: mConv,
                cpl: mCpl,
              };
            }
          }
        } catch (metaErr) {
          console.warn("Could not fetch live Meta metrics:", metaErr);
        }
      }
    }

    // 6. Build Executive Briefing Options
    const shouldIncludeGoogle = channels.includes("google");
    const shouldIncludeMeta = channels.includes("meta") && Boolean(hasMeta);

    // Month label e.g., "September 2026" or "Last 30 Days"
    const periodMonth = new Intl.DateTimeFormat("en-AU", {
      month: "long",
      year: "numeric",
    }).format(endDateObj);

    const googleReportUrl = publicShareUrl
      ? `${publicShareUrl}${publicShareUrl.includes("?") ? "&" : "?"}selected=google`
      : "";
    const metaReportUrl = publicShareUrl
      ? `${publicShareUrl}${publicShareUrl.includes("?") ? "&" : "?"}selected=meta`
      : "";

    const briefingPayload: ExecutiveBriefingParams = {
      clientName: account.name,
      recipientName: recipientEmail ? recipientEmail.split("@")[0] : "Team",
      periodLabel: periodMonth,
      customInstructions: effectiveInstructions,
      wordLimitTier,
      organizationId: orgId,
      userId: userId !== "system" ? userId : undefined,
      ...(shouldIncludeGoogle
        ? {
            googleData: {
              spend: gSpend,
              conversions: gConv,
              cpl: gCpl,
              clicks: gClicks,
              ctr: gCtr,
              cpc: gCpc,
              priorSpend,
              priorConversions: priorConv,
              priorCpl,
              reportUrl: googleReportUrl,
            },
          }
        : {}),
      ...(shouldIncludeMeta
        ? {
            metaData: {
              spend: metaMetrics?.spend || 0,
              conversions: metaMetrics?.conversions || 0,
              cpl: metaMetrics?.cpl || 0,
              reportUrl: metaReportUrl,
            },
          }
        : {}),
    };

    const briefing = await generateExecutiveBriefing(briefingPayload);

    return {
      success: true,
      data: {
        adAccountId: account.id,
        accountName: account.name,
        googleAccountId: account.googleAccountId,
        recipientEmail,
        ccEmails,
        subject: briefing.subject,
        plainText: briefing.plainText,
        htmlContent: briefing.htmlContent,
        fullHtml: briefing.fullHtml,
        publicShareUrl,
        hasMeta,
        metaAccountName: linkedMetaName,
        googleMetrics: {
          spend: gSpend,
          conversions: gConv,
          cpl: gCpl,
          clicks: gClicks,
          ctr: gCtr,
          cpc: gCpc,
          priorSpend,
          priorConversions: priorConv,
          priorCpl,
        },
        metaMetrics,
        wordLimitTier,
        customInstructions: effectiveInstructions,
      },
    };
  } catch (error: any) {
    console.error("generateClientDraftEmailAction error:", error);
    return { success: false, error: error.message || "Failed to generate draft." };
  }
}

/**
 * Send the executive email (or test email).
 * Strictly enforced: all non-whitelisted recipients are diverted to seyone@uprisedigital.com.au!
 */
export async function sendClientExecutiveEmailAction(params: {
  adAccountId: number;
  recipientEmail: string;
  ccEmails?: string;
  subject: string;
  bodyText: string;
  isTest?: boolean;
  staffRecipientEmail?: string;
}): Promise<{
  success: boolean;
  resendId?: string;
  deliveredTo?: string;
  wasSafeguarded?: boolean;
  error?: string;
}> {
  try {
    let orgId = "default-org";
    let userId = "system";
    try {
      const session = await auth.api.getSession({ headers: await headers() });
      if (session) {
        userId = session.user.id;
        const ctx = await getAuthOrgContext();
        if (ctx?.orgId) orgId = ctx.orgId;
      }
    } catch {
      // outside Next.js request
    }

    const {
      adAccountId,
      recipientEmail,
      ccEmails,
      subject,
      bodyText,
      staffRecipientEmail,
    } = params;

    const account = await db.query.adAccounts.findFirst({
      where: eq(adAccounts.id, adAccountId),
    });

    const clientName = account?.name || "Client";

    // 1. Determine target recipient and apply Safeguard
    let safeTo: string[];
    let safeCc: string[] | undefined;
    let safeSubject: string;
    let wasSafeguarded = false;

    if (staffRecipientEmail) {
      // Test directly sent to a staff colleague
      safeTo = [staffRecipientEmail.trim().toLowerCase()];
      safeCc = undefined;
      safeSubject = `[STAFF TEST] ${subject}`;
    } else {
      // Production send or general test: passes through safeguard
      const safeguard = enforceEmailSafeguard(recipientEmail, subject, ccEmails);
      safeTo = safeguard.to;
      safeCc = safeguard.cc;
      safeSubject = safeguard.subject;
      wasSafeguarded = safeguard.isOverridden;
    }

    // 2. Generate clean, dark-mode compatible HTML with Uprise signature
    const emailHtml = await buildHtmlFromExecutiveText(bodyText, clientName);

    // 3. Dispatch via Resend
    const sendRes = await resend.emails.send({
      from: "Lakshane Fonseka <reports@uprisedigital.com.au>",
      to: safeTo,
      cc: safeCc,
      subject: safeSubject,
      text: bodyText,
      html: emailHtml,
    });

    if (sendRes.error) {
      await logEmail({
        adAccountId,
        recipient: safeTo.join(", "),
        subject: safeSubject,
        emailType: "client_executive_report",
        status: "failed",
        error: sendRes.error.message,
      });
      return { success: false, error: sendRes.error.message };
    }

    const resendId = sendRes.data?.id || null;

    // 4. Log to emailLogs
    await logEmail({
      adAccountId,
      recipient: safeTo.join(", "),
      subject: safeSubject,
      emailType: "client_executive_report",
      status: "success",
      resendId,
    });

    if (userId !== "system") {
      await logAction(
        userId,
        "CLIENT_EXECUTIVE_REPORT_SENT",
        "email_logs",
        resendId || String(adAccountId),
        {
          adAccountId,
          intendedRecipient: staffRecipientEmail || recipientEmail,
          deliveredTo: safeTo,
          wasSafeguarded,
        },
      );
    }

    return {
      success: true,
      resendId: resendId || undefined,
      deliveredTo: safeTo.join(", "),
      wasSafeguarded,
    };
  } catch (error: any) {
    console.error("sendClientExecutiveEmailAction error:", error);
    return { success: false, error: error.message || "Failed to dispatch email." };
  }
}

/**
 * Fetch sending history across all client reports or for a specific client.
 */
export async function getClientReportSendingHistoryAction(params?: {
  adAccountId?: number;
  limit?: number;
}): Promise<{
  success: boolean;
  logs: Array<{
    id: number;
    adAccountId: number | null;
    accountName: string | null;
    recipient: string;
    subject: string;
    emailType: string;
    status: string;
    error: string | null;
    resendId: string | null;
    sentAt: string;
  }>;
  error?: string;
}> {
  try {
    const limit = params?.limit || 50;

    let whereClause = inArray(emailLogs.emailType, [
      "client_executive_report",
      "scheduled_report",
      "on_demand_report",
    ]);

    if (params?.adAccountId) {
      whereClause = and(
        eq(emailLogs.adAccountId, params.adAccountId),
        whereClause,
      ) as any;
    }

    const rawLogs = await db
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
      .where(whereClause)
      .orderBy(desc(emailLogs.sentAt))
      .limit(limit);

    const logs = rawLogs.map((r) => ({
      id: r.id,
      adAccountId: r.adAccountId,
      accountName: r.accountName || null,
      recipient: r.recipient,
      subject: r.subject,
      emailType: r.emailType,
      status: r.status,
      error: r.error,
      resendId: r.resendId,
      sentAt: r.sentAt.toISOString(),
    }));

    return { success: true, logs };
  } catch (error: any) {
    console.error("getClientReportSendingHistoryAction error:", error);
    return { success: false, logs: [], error: error.message };
  }
}

/**
 * Persists prompt injection / custom AI instructions to the client's report schedule.
 */
export async function saveClientDraftInstructionsAction(params: {
  adAccountId: number;
  customAiInstructions: string;
  recipientEmail?: string;
  ccEmails?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { adAccountId, customAiInstructions, recipientEmail, ccEmails } =
      params;

    const existing = await db.query.reportSchedules.findFirst({
      where: eq(reportSchedules.adAccountId, adAccountId),
    });

    if (existing) {
      await db
        .update(reportSchedules)
        .set({
          customAiInstructions,
          ...(recipientEmail ? { recipientEmail } : {}),
          ...(ccEmails !== undefined ? { ccEmails } : {}),
        })
        .where(eq(reportSchedules.id, existing.id));
    }

    return { success: true };
  } catch (error: any) {
    console.error("saveClientDraftInstructionsAction error:", error);
    return { success: false, error: error.message };
  }
}
