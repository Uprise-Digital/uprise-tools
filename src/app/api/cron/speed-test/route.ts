import { and, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { Resend } from "resend";
import { withBypassTenantDb } from "@/db/db-helper";
import {
  adAccounts,
  backgroundTasks,
  campaignLandingPages,
  landingPageSpeedTests,
  member,
  organization,
  user,
} from "@/db/schema";
import { logEmail } from "@/lib/audit";
import { createOrgNotification } from "@/service/notification.service";
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
  console.log(
    "[Cron Speed Test] Initiating weekly landing page speed audits...",
  );

  // 1. Fetch all landing pages enrolled in weekly speed checks across active accounts
  const enrolledPages = await withBypassTenantDb(async (tx) => {
    return await tx.query.campaignLandingPages.findMany({
      where: eq(campaignLandingPages.weeklySpeedCheck, true),
      with: {
        account: true,
      },
    });
  });

  // Fetch org audit scope settings
  const orgSettingsMap = new Map<string, "ALL" | "ENABLED_ONLY">();
  try {
    const orgs = await withBypassTenantDb(async (tx) => {
      if (tx?.query?.organization?.findMany) {
        return await tx.query.organization.findMany();
      }
      return [];
    });
    for (const org of orgs) {
      let scope: "ALL" | "ENABLED_ONLY" = "ALL";
      if (org?.metadata) {
        try {
          const meta = JSON.parse(org.metadata);
          if (meta.pageSpeedAuditScope) scope = meta.pageSpeedAuditScope;
        } catch (e) {}
      }
      if (org?.id) {
        orgSettingsMap.set(org.id, scope);
      }
    }
  } catch (err) {
    console.warn("[Cron Speed Test] Could not load organization scope settings, defaulting to ALL:", err);
  }

  // Filter based on each org's pageSpeedAuditScope setting
  const eligiblePages = enrolledPages.filter((page) => {
    const scope = orgSettingsMap.get(page.organizationId) || "ALL";
    if (scope === "ENABLED_ONLY") {
      return page.status === "ENABLED";
    }
    return true;
  });

  console.log(
    `[Cron Speed Test] Found ${eligiblePages.length} landing pages eligible for weekly speed audits (${enrolledPages.length} enrolled).`,
  );

  const results: any[] = [];
  const orgIssuesMap = new Map<string, SpeedAlertIssue[]>();

  for (const page of eligiblePages) {
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
        if (isLowScore)
          reason = "Mobile performance score critically low (< 50)";
        else if (isSlowLcp) reason = `LCP latency slow (${audit.lcpDisplay})`;
        else if (isHighCls)
          reason = `Layout shift unstable (${audit.clsDisplay})`;

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
      // 1. Dispatch In-App Notification to all Org Members
      const hasCritical = issues.some((i) => i.performanceScore < 50);
      const avgScore = Math.round(
        issues.reduce((acc, i) => acc + i.performanceScore, 0) / issues.length,
      );
      await createOrgNotification({
        organizationId: orgId,
        type: "lp_speed_degraded",
        severity: hasCritical ? "critical" : "warning",
        title: `Landing Page Speed Alert (${issues.length} page${issues.length > 1 ? "s" : ""})`,
        message: `Weekly sentinel detected performance regressions on ${issues
          .map((i) => i.campaignName || i.accountName)
          .slice(0, 2)
          .join(
            ", ",
          )}${issues.length > 2 ? ` and ${issues.length - 2} more` : ""}. Average score: ${avgScore}/100.`,
        link:
          issues.length === 1
            ? `/lp-analysis/speed/${issues[0].campaignLandingPageId}`
            : "/lp-analysis",
        metadata: {
          issuesCount: issues.length,
          issues: issues.slice(0, 5),
        },
      });

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

/**
 * Triggers an automated full portfolio speed audit for an organization
 * based on its configured scope, device strategy, and alerting settings.
 */
export async function triggerAutomatedFullAuditForOrg(
  orgId: string,
  isManualTest: boolean = false,
): Promise<{
  success: boolean;
  pagesAudited?: number;
  testsCompleted?: number;
  issuesCount?: number;
  message?: string;
  error?: string;
}> {
  try {
    const org = await withBypassTenantDb(async (tx) => {
      return await tx.query.organization.findFirst({
        where: eq(organization.id, orgId),
      });
    });
    if (!org) return { success: false, error: "Organization not found" };

    let meta: any = {};
    if (org.metadata) {
      try {
        meta = JSON.parse(org.metadata);
      } catch (e) {}
    }

    const autoAudit = meta.pageSpeedAutoAudit;
    if (!isManualTest && !autoAudit?.enabled) {
      return { success: false, message: "Automated full audit is not enabled" };
    }

    const auditScope: "ALL" | "ENABLED_ONLY" =
      meta.pageSpeedAuditScope === "ENABLED_ONLY" ? "ENABLED_ONLY" : "ALL";

    const deviceStrategy: "mobile" | "desktop" | "both" =
      meta.pageSpeedDeviceStrategy === "DESKTOP"
        ? "desktop"
        : meta.pageSpeedDeviceStrategy === "BOTH"
          ? "both"
          : "mobile";

    const devicesToTest: Array<"mobile" | "desktop"> =
      deviceStrategy === "both"
        ? ["mobile", "desktop"]
        : deviceStrategy === "desktop"
          ? ["desktop"]
          : ["mobile"];

    const deviceLabel =
      deviceStrategy === "both"
        ? "Mobile & Desktop"
        : deviceStrategy === "desktop"
          ? "Desktop"
          : "Mobile";

    const activeAccounts = await withBypassTenantDb(async (tx) => {
      return await tx.query.adAccounts.findMany({
        where: and(
          eq(adAccounts.organizationId, orgId),
          eq(adAccounts.isActive, true),
        ),
      });
    });
    const accountIds = activeAccounts.map((a) => a.id);
    if (accountIds.length === 0) {
      return { success: false, message: "No active ad accounts found in this organization." };
    }

    const targetPages = await withBypassTenantDb(async (tx) => {
      return await tx.query.campaignLandingPages.findMany({
        where: and(
          inArray(campaignLandingPages.adAccountId, accountIds),
          auditScope === "ENABLED_ONLY"
            ? eq(campaignLandingPages.status, "ENABLED")
            : undefined,
        ),
        with: {
          account: true,
        },
      });
    });

    const validPages = targetPages.filter(
      (p) =>
        p.url &&
        (p.url.startsWith("http://") || p.url.startsWith("https://")),
    );

    if (validPages.length === 0) {
      return { success: true, pagesAudited: 0, message: "No valid landing pages found to audit." };
    }

    const totalTests = validPages.length * devicesToTest.length;
    const taskTitle = `Automated Speed Audit: ${org.name} (${validPages.length} pages • ${deviceLabel})`;

    const [taskRecord] = await withBypassTenantDb(async (tx) => {
      return await tx
        .insert(backgroundTasks)
        .values({
          organizationId: orgId,
          name: taskTitle,
          status: "running",
          totalItems: totalTests,
          completedItems: 0,
          currentItem: `Starting automated ${deviceLabel} audit of ${validPages.length} landing pages...`,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning({ id: backgroundTasks.id });
    });

    let completedCount = 0;
    const issues: SpeedAlertIssue[] = [];

    for (let i = 0; i < validPages.length; i++) {
      const page = validPages[i];
      const cleanUrl = page.url.replace(/^https?:\/\//, "").replace(/\/$/, "");

      for (const device of devicesToTest) {
        const deviceIcon = device === "mobile" ? "📱 Mobile" : "🖥️ Desktop";

        if (taskRecord?.id) {
          await withBypassTenantDb(async (tx) => {
            await tx
              .update(backgroundTasks)
              .set({
                status: "running",
                completedItems: completedCount,
                currentItem: `[${deviceIcon}] Auditing: ${cleanUrl} (${completedCount + 1}/${totalTests})`,
                updatedAt: new Date(),
              })
              .where(eq(backgroundTasks.id, taskRecord.id));
          });
        }

        try {
          const audit = await runPageSpeedAudit(page.url, device);

          await withBypassTenantDb(async (tx) => {
            await tx.insert(landingPageSpeedTests).values({
              organizationId: orgId,
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
              triggerSource: isManualTest ? "MANUAL_BATCH" : "AUTOMATED_SCHEDULE",
              status: "COMPLETED",
              createdAt: new Date(),
            });
          });

          // Check alert thresholds
          const isLowScore = audit.performanceScore < 50;
          const isSlowLcp = audit.lcpMs > 3500;
          const isHighCls = audit.clsScore > 0.25;

          if (isLowScore || isSlowLcp || isHighCls) {
            let reason = "Performance regression detected";
            if (isLowScore)
              reason = `${deviceLabel} score critically low (< 50)`;
            else if (isSlowLcp)
              reason = `LCP latency slow (${audit.lcpDisplay})`;
            else if (isHighCls)
              reason = `Layout shift unstable (${audit.clsDisplay})`;

            issues.push({
              campaignLandingPageId: page.id,
              adAccountId: page.adAccountId,
              accountName: page.account?.name || "Client Account",
              campaignName: page.campaignName,
              url: page.url,
              performanceScore: audit.performanceScore,
              lcpDisplay: audit.lcpDisplay,
              clsDisplay: audit.clsDisplay,
              primaryReason: reason,
            });
          }
        } catch (testErr: any) {
          console.error(
            `[Auto Speed Audit] Error testing ${page.url} (${device}):`,
            testErr.message,
          );
        }

        completedCount++;
      }
    }

    // Mark background task as completed
    if (taskRecord?.id) {
      await withBypassTenantDb(async (tx) => {
        await tx
          .update(backgroundTasks)
          .set({
            status: "completed",
            completedItems: totalTests,
            currentItem: `Finished automated audit of ${validPages.length} landing pages (${deviceLabel}).`,
            updatedAt: new Date(),
          })
          .where(eq(backgroundTasks.id, taskRecord.id));
      });
    }

    // Update lastRunAt in org metadata
    meta.pageSpeedAutoAudit = {
      ...(meta.pageSpeedAutoAudit || {}),
      lastRunAt: new Date().toISOString(),
    };
    await withBypassTenantDb(async (tx) => {
      await tx
        .update(organization)
        .set({
          metadata: JSON.stringify(meta),
          updatedAt: new Date(),
        })
        .where(eq(organization.id, orgId));
    });

    // Dispatch alerts if issues found
    if (issues.length > 0) {
      try {
        const hasCritical = issues.some((i) => i.performanceScore < 50);
        const avgScore = Math.round(
          issues.reduce((acc, i) => acc + i.performanceScore, 0) / issues.length,
        );

        await createOrgNotification({
          organizationId: orgId,
          type: "lp_speed_degraded",
          severity: hasCritical ? "critical" : "warning",
          title: `Automated Full Speed Audit Alert (${issues.length} issue${issues.length > 1 ? "s" : ""})`,
          message: `Automated speed sentinel detected performance regressions on ${issues
            .map((i) => i.campaignName || i.accountName)
            .slice(0, 2)
            .join(", ")}${issues.length > 2 ? ` and ${issues.length - 2} more` : ""}. Average score: ${avgScore}/100.`,
          link: "/lp-analysis",
          metadata: {
            issuesCount: issues.length,
            issues: issues.slice(0, 5),
          },
        });

        const members = await withBypassTenantDb(async (tx) => {
          return await tx.query.member.findMany({
            where: eq(member.organizationId, orgId),
            with: { user: true },
          });
        });

        const recipients = members
          .map((m: any) => m.user?.email)
          .filter((email: string | undefined): email is string => Boolean(email));

        if (org?.supportEmail && !recipients.includes(org.supportEmail)) {
          recipients.push(org.supportEmail);
        }

        if (recipients.length > 0) {
          const appUrl =
            process.env.NEXT_PUBLIC_APP_URL ||
            process.env.BETTER_AUTH_URL ||
            "https://tools.uprisedigital.com.au";

          const subject = `🚨 [Speed Alert] Full Automated Audit: ${issues.length} Landing Pages with Performance Issues`;
          const html = buildSpeedAlertHtml({
            orgName: org.name,
            issues,
            appUrl,
          });

          await resend.emails.send({
            from: "Uprise Tools <alerts@uprisedigital.com.au>",
            to: recipients,
            subject,
            html,
          });
        }
      } catch (alertErr) {
        console.error("[Auto Speed Audit] Error dispatching alerts:", alertErr);
      }
    }

    return {
      success: true,
      pagesAudited: validPages.length,
      testsCompleted: totalTests,
      issuesCount: issues.length,
      message: `Completed automated audit: ${validPages.length} landing pages tested (${deviceLabel}).`,
    };
  } catch (err: any) {
    console.error("[triggerAutomatedFullAuditForOrg Error]:", err);
    return { success: false, error: err.message };
  }
}

/**
 * Checks all organizations to see if an automated full audit is due based on schedule.
 */
export async function processAutomatedFullAudits() {
  console.log("[Cron Speed Test] Checking organizations for scheduled automated full audits...");
  const orgs = await withBypassTenantDb(async (tx) => {
    if (tx?.query?.organization?.findMany) {
      return await tx.query.organization.findMany();
    }
    return [];
  });

  const now = new Date();
  const melbourneString = now.toLocaleString("en-US", { timeZone: "Australia/Melbourne" });
  const melDate = new Date(melbourneString);
  const melDayOfWeek = melDate.getDay() === 0 ? 7 : melDate.getDay(); // 1 = Mon ... 7 = Sun
  const melDayOfMonth = melDate.getDate();
  const melHour = melDate.getHours();

  const auditResults: any[] = [];

  for (const org of orgs) {
    if (!org.metadata) continue;
    let meta: any = null;
    try {
      meta = JSON.parse(org.metadata);
    } catch (e) {
      continue;
    }

    const autoAudit = meta?.pageSpeedAutoAudit;
    if (!autoAudit || !autoAudit.enabled) continue;

    const scheduledHour = autoAudit.time ? parseInt(autoAudit.time.split(":")[0], 10) : 9;
    const lastRun = autoAudit.lastRunAt ? new Date(autoAudit.lastRunAt).getTime() : 0;
    const hoursSinceLastRun = (Date.now() - lastRun) / (1000 * 60 * 60);

    let isDue = false;

    if (autoAudit.frequency === "WEEKLY") {
      const targetDay = typeof autoAudit.dayOfWeek === "number" ? autoAudit.dayOfWeek : 1;
      if (melDayOfWeek === targetDay && melHour >= scheduledHour && hoursSinceLastRun > 20) {
        isDue = true;
      }
    } else if (autoAudit.frequency === "MONTHLY") {
      const targetDay = typeof autoAudit.dayOfMonth === "number" ? autoAudit.dayOfMonth : 1;
      if (melDayOfMonth === targetDay && melHour >= scheduledHour && hoursSinceLastRun > 20 * 24) {
        isDue = true;
      }
    }

    if (isDue) {
      console.log(
        `[Cron Speed Test] Org ${org.name} (${org.id}) is due for full automated speed audit! Running...`,
      );
      try {
        const result = await triggerAutomatedFullAuditForOrg(org.id, false);
        auditResults.push({ orgId: org.id, orgName: org.name, ...result });
      } catch (err: any) {
        console.error(`[Cron Speed Test] Failed automated audit for org ${org.name}:`, err);
        auditResults.push({
          orgId: org.id,
          orgName: org.name,
          success: false,
          error: err.message,
        });
      }
    }
  }

  return auditResults;
}

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    const expectedToken = `Bearer ${process.env.CRON_SECRET}`;

    if (!process.env.CRON_SECRET || authHeader !== expectedToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const weeklyReport = await processWeeklySpeedChecks();
    const automatedAuditResults = await processAutomatedFullAudits();
    return NextResponse.json({
      success: true,
      weeklyReport,
      automatedAuditResults,
    });
  } catch (error: any) {
    console.error("Cron speed-test POST error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
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

    const weeklyReport = await processWeeklySpeedChecks();
    const automatedAuditResults = await processAutomatedFullAudits();
    return NextResponse.json({
      success: true,
      weeklyReport,
      automatedAuditResults,
    });
  } catch (error: any) {
    console.error("Cron speed-test GET error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 },
    );
  }
}

