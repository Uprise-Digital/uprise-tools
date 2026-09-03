import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { Resend } from "resend";
import { withBypassTenantDb } from "@/db/db-helper";
import {
  adAccounts,
  campaignLandingPages,
  landingPageSpeedTests,
  member,
  organization,
  user,
} from "@/db/schema";
import { logEmail } from "@/lib/audit";
import { runPageSpeedAudit } from "@/service/pagespeed.service";

export const maxDuration = 300; // 5 minutes

const resend = new Resend(process.env.RESEND_API_KEY || "re_dummy_build_key");

interface SpeedAlertIssue {
  campaignLandingPageId: number;
  adAccountId: number;
  accountName: string;
  campaignName: string;
  url: string;
  performanceScore: number;
  lcpDisplay?: string;
  clsDisplay?: string;
  primaryReason: string;
}

function buildSpeedAlertHtml(props: {
  orgName: string;
  issues: SpeedAlertIssue[];
  appUrl: string;
}): string {
  const issueRows = props.issues
    .map(
      (issue) => `
    <tr style="border-bottom: 1px solid #e2e8f0;">
      <td style="padding: 12px 8px; vertical-align: top;">
        <strong style="color: #0f172a; font-size: 13px;">${issue.accountName}</strong>
        <div style="color: #64748b; font-size: 11px;">${issue.campaignName}</div>
        <a href="${issue.url}" target="_blank" style="color: #4f46e5; font-size: 11px; text-decoration: none; word-break: break-all;">
          ${issue.url}
        </a>
      </td>
      <td style="padding: 12px 8px; vertical-align: top; text-align: center;">
        <span style="display: inline-block; padding: 3px 8px; border-radius: 6px; font-weight: bold; font-size: 13px; background: ${
          issue.performanceScore < 50
            ? "#fee2e2; color: #dc2626;"
            : "#fef3c7; color: #d97706;"
        }">
          ${issue.performanceScore} / 100
        </span>
      </td>
      <td style="padding: 12px 8px; vertical-align: top; font-size: 12px; color: #334155;">
        ${issue.lcpDisplay ? `<div><strong>LCP:</strong> ${issue.lcpDisplay}</div>` : ""}
        ${issue.clsDisplay ? `<div><strong>CLS:</strong> ${issue.clsDisplay}</div>` : ""}
        <div style="color: #e11d48; font-size: 11px; margin-top: 2px;">${issue.primaryReason}</div>
      </td>
      <td style="padding: 12px 8px; vertical-align: top; text-align: right;">
        <a href="${props.appUrl}/lp-analysis/speed/${issue.campaignLandingPageId}" 
           style="display: inline-block; background: #4f46e5; color: #ffffff; text-decoration: none; padding: 6px 12px; border-radius: 6px; font-size: 11px; font-weight: bold;">
          View Insights
        </a>
      </td>
    </tr>
  `,
    )
    .join("");

  return `
  <!DOCTYPE html>
  <html>
    <head>
      <meta charset="utf-8">
      <title>Weekly Landing Page Speed Alert</title>
    </head>
    <body style="margin: 0; padding: 24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #0f172a;">
      <div style="max-width: 680px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
        <div style="background: #1e1b4b; padding: 20px 24px; color: #ffffff;">
          <h2 style="margin: 0; font-size: 18px; font-weight: 700; display: flex; align-items: center; gap: 8px;">
            🚨 Weekly Landing Page Speed Sentinel
          </h2>
          <p style="margin: 4px 0 0; font-size: 12px; color: #cbd5e1;">
            Automated performance audit for <strong>${props.orgName}</strong>
          </p>
        </div>

        <div style="padding: 24px;">
          <p style="font-size: 13px; line-height: 1.5; color: #334155; margin-top: 0;">
            The weekly speed monitor detected performance regressions on <strong>${props.issues.length} landing page(s)</strong> that may be negatively impacting your Google Ads Quality Score and paid conversion rates.
          </p>

          <table style="width: 100%; border-collapse: collapse; margin-top: 16px;">
            <thead>
              <tr style="background: #f1f5f9; text-align: left; font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em;">
                <th style="padding: 8px; border-radius: 6px 0 0 6px;">Landing Page</th>
                <th style="padding: 8px; text-align: center;">Score</th>
                <th style="padding: 8px;">Key Bottleneck</th>
                <th style="padding: 8px; text-align: right; border-radius: 0 6px 6px 0;">Action</th>
              </tr>
            </thead>
            <tbody>
              ${issueRows}
            </tbody>
          </table>

          <div style="margin-top: 24px; padding: 14px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 11px; color: #64748b;">
            💡 <strong>Why this matters:</strong> Slow landing page speeds (especially LCP &gt; 2.5s) increase your Cost Per Click (CPC) and cause high mobile bounce rates on active Google Ads traffic.
          </div>
        </div>

        <div style="background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 12px 24px; text-align: center; font-size: 11px; color: #94a3b8;">
          Uprise Tools Automated Performance Sentinel &bull; Generated on ${new Date().toLocaleDateString("en-GB")}
        </div>
      </div>
    </body>
  </html>
  `;
}

export async function processWeeklySpeedChecks() {
  console.log("[Cron Speed Test] Initiating weekly landing page speed audits...");

  // 1. Fetch all landing pages enrolled in weekly speed checks across active accounts
  const enrolledPages = await withBypassTenantDb(async (tx) => {
    return await tx.query.campaignLandingPages.findMany({
      where: and(
        eq(campaignLandingPages.weeklySpeedCheck, true),
        eq(campaignLandingPages.status, "ENABLED"),
      ),
      with: {
        account: true,
      },
    });
  });

  console.log(
    `[Cron Speed Test] Found ${enrolledPages.length} landing pages enrolled in weekly speed audits.`,
  );

  const results: any[] = [];
  const orgIssuesMap = new Map<string, SpeedAlertIssue[]>();

  for (const page of enrolledPages) {
    if (!page.url) continue;

    try {
      console.log(
        `[Cron Speed Test] Auditing ${page.url} for account ${page.account?.name} (ID: ${page.adAccountId})...`,
      );

      const audit = await runPageSpeedAudit(page.url, "mobile");

      // Save to database
      await withBypassTenantDb(async (tx) => {
        await tx.insert(landingPageSpeedTests).values({
          organizationId: page.organizationId,
          adAccountId: page.adAccountId,
          campaignLandingPageId: page.id,
          url: page.url,
          device: audit.device,
          performanceScore: audit.performanceScore,
          accessibilityScore: audit.accessibilityScore,
          bestPracticesScore: audit.bestPracticesScore,
          seoScore: audit.seoScore,
          lcpMs: audit.lcpMs,
          lcpDisplay: audit.lcpDisplay,
          clsScore: audit.clsScore,
          clsDisplay: audit.clsDisplay,
          inpMs: audit.inpMs,
          inpDisplay: audit.inpDisplay,
          fcpMs: audit.fcpMs,
          fcpDisplay: audit.fcpDisplay,
          ttfbMs: audit.ttfbMs,
          ttfbDisplay: audit.ttfbDisplay,
          speedIndexMs: audit.speedIndexMs,
          speedIndexDisplay: audit.speedIndexDisplay,
          totalByteWeight: audit.totalByteWeight,
          opportunities: audit.opportunities,
          diagnostics: audit.diagnostics,
          cruxData: audit.cruxData,
          triggerSource: "WEEKLY_CRON",
          status: "COMPLETED",
        });
      });

      results.push({
        id: page.id,
        url: page.url,
        score: audit.performanceScore,
        lcp: audit.lcpDisplay,
        success: true,
      });

      // Check alert thresholds
      const isLowScore = audit.performanceScore < 50;
      const isSlowLcp = audit.lcpMs > 3500;
      const isHighCls = audit.clsScore > 0.25;

      if (isLowScore || isSlowLcp || isHighCls) {
        let reason = "Performance regression detected";
        if (isLowScore) reason = "Mobile performance score critically low (< 50)";
        else if (isSlowLcp) reason = `LCP latency slow (${audit.lcpDisplay})`;
        else if (isHighCls) reason = `Layout shift unstable (${audit.clsDisplay})`;

        const issue: SpeedAlertIssue = {
          campaignLandingPageId: page.id,
          adAccountId: page.adAccountId,
          accountName: page.account?.name || "Client Account",
          campaignName: page.campaignName,
          url: page.url,
          performanceScore: audit.performanceScore,
          lcpDisplay: audit.lcpDisplay,
          clsDisplay: audit.clsDisplay,
          primaryReason: reason,
        };

        const existing = orgIssuesMap.get(page.organizationId) || [];
        existing.push(issue);
        orgIssuesMap.set(page.organizationId, existing);
      }
    } catch (err: any) {
      console.error(`[Cron Speed Test] Error testing ${page.url}:`, err);
      results.push({
        id: page.id,
        url: page.url,
        success: false,
        error: err.message,
      });
    }
  }

  // 2. Dispatch Resend email alerts for organizations with issues
  let alertsDispatched = 0;
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.BETTER_AUTH_URL ||
    "https://tools.uprisedigital.com.au";

  for (const [orgId, issues] of orgIssuesMap.entries()) {
    try {
      // Find organization details and team recipients
      const org = await withBypassTenantDb(async (tx) => {
        return await tx.query.organization.findFirst({
          where: eq(organization.id, orgId),
        });
      });

      const members = await withBypassTenantDb(async (tx) => {
        return await tx.query.member.findMany({
          where: eq(member.organizationId, orgId),
          with: {
            user: true,
          },
        });
      });

      const recipients = members
        .map((m: any) => m.user?.email)
        .filter((email: string | undefined): email is string => Boolean(email));

      if (org?.supportEmail && !recipients.includes(org.supportEmail)) {
        recipients.push(org.supportEmail);
      }

      if (recipients.length === 0) {
        console.warn(
          `[Cron Speed Test] No recipient emails found for org ${orgId}. Skipping email dispatch.`,
        );
        continue;
      }

      const subject = `🚨 [Speed Alert] Performance Issues Detected on ${issues.length} Landing Pages`;
      const html = buildSpeedAlertHtml({
        orgName: org?.name || "Your Agency",
        issues,
        appUrl,
      });

      const emailResult = await resend.emails.send({
        from: "Uprise Tools <alerts@uprisedigital.com.au>",
        to: recipients,
        subject,
        html,
      });

      if (emailResult.error) {
        console.error(
          `[Cron Speed Test] Resend error for org ${orgId}:`,
          emailResult.error,
        );
        await logEmail({
          recipient: recipients.join(", "),
          subject,
          emailType: "scheduled_report",
          status: "failed",
          error: emailResult.error.message,
        });
      } else {
        console.log(
          `[Cron Speed Test] Sent speed alert to ${recipients.join(", ")} (Resend ID: ${emailResult.data?.id})`,
        );
        await logEmail({
          recipient: recipients.join(", "),
          subject,
          emailType: "scheduled_report",
          status: "success",
          resendId: emailResult.data?.id,
        });
        alertsDispatched++;
      }
    } catch (sendErr) {
      console.error(
        `[Cron Speed Test] Failed to send email alert for org ${orgId}:`,
        sendErr,
      );
    }
  }

  return {
    success: true,
    processedCount: enrolledPages.length,
    issuesFound: Array.from(orgIssuesMap.values()).reduce(
      (acc, val) => acc + val.length,
      0,
    ),
    alertsDispatched,
    results,
  };
}

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    const expectedToken = `Bearer ${process.env.CRON_SECRET}`;

    if (!process.env.CRON_SECRET || authHeader !== expectedToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const report = await processWeeklySpeedChecks();
    return NextResponse.json(report);
  } catch (error: any) {
    console.error("Cron speed-test POST error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
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

    const report = await processWeeklySpeedChecks();
    return NextResponse.json(report);
  } catch (error: any) {
    console.error("Cron speed-test GET error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 },
    );
  }
}
