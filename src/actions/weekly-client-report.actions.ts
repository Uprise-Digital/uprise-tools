"use server";

import { eq, ne, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import {
  type ClientPulseItem,
  getClientPulseBoardDataAction,
} from "@/actions/client-pulse.actions";
import { db } from "@/db";
import { user, weeklyClientReportSettings } from "@/db/schema";
import { logAction } from "@/lib/audit";
import { auth } from "@/lib/auth";
import { sendSystemEmail } from "@/lib/email-service";

const SYSTEM_ACTOR = "SYSTEM_AUTOMATION";

export interface WeeklyClientReportSettingsData {
  id: number | null;
  isActive: boolean;
  sendDayOfWeek: string; // 'monday', 'tuesday', etc.
  sendTime: string; // '08:00'
  recipients: string[];
  includeRiskWatchlist: boolean;
  includePerformanceMetrics: boolean;
  includeSentimentPrompt: boolean;
}

let hasEnsuredSchema = false;

export async function ensureWeeklyClientReportSettingsSchema() {
  if (hasEnsuredSchema) return;
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "weekly_client_report_settings" (
        "id" serial PRIMARY KEY NOT NULL,
        "organization_id" text NOT NULL DEFAULT 'default-org',
        "recipients" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "send_day_of_week" text NOT NULL DEFAULT 'monday',
        "send_time" varchar(5) NOT NULL DEFAULT '08:00',
        "is_active" boolean NOT NULL DEFAULT true,
        "include_risk_watchlist" boolean NOT NULL DEFAULT true,
        "include_performance_metrics" boolean NOT NULL DEFAULT true,
        "include_sentiment_prompt" boolean NOT NULL DEFAULT true,
        "updated_at" timestamp NOT NULL DEFAULT now()
      );
    `);
    hasEnsuredSchema = true;
  } catch (e) {
    console.warn("ensureWeeklyClientReportSettingsSchema warning:", e);
  }
}

/**
 * Loads current weekly client report automation settings
 */
export async function getWeeklyClientReportSettingsAction() {
  try {
    await ensureWeeklyClientReportSettingsSchema();
    const settings = await db.query.weeklyClientReportSettings.findFirst();

    if (!settings) {
      // Default recipients to team members
      const team = await db
        .select()
        .from(user)
        .where(ne(user.id, SYSTEM_ACTOR));
      const defaultRecipients = team.map((u) => u.email).filter(Boolean);

      return {
        success: true,
        data: {
          id: null,
          isActive: true,
          sendDayOfWeek: "monday",
          sendTime: "08:00",
          recipients: defaultRecipients,
          includeRiskWatchlist: true,
          includePerformanceMetrics: true,
          includeSentimentPrompt: true,
        } as WeeklyClientReportSettingsData,
      };
    }

    return {
      success: true,
      data: {
        id: settings.id,
        isActive: settings.isActive,
        sendDayOfWeek: settings.sendDayOfWeek || "monday",
        sendTime: settings.sendTime || "08:00",
        recipients: (settings.recipients as string[]) || [],
        includeRiskWatchlist: settings.includeRiskWatchlist ?? true,
        includePerformanceMetrics: settings.includePerformanceMetrics ?? true,
        includeSentimentPrompt: settings.includeSentimentPrompt ?? true,
      } as WeeklyClientReportSettingsData,
    };
  } catch (error: any) {
    console.error("getWeeklyClientReportSettingsAction error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Saves or updates weekly client report automation settings
 */
export async function saveWeeklyClientReportSettingsAction(
  data: WeeklyClientReportSettingsData,
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  try {
    await ensureWeeklyClientReportSettingsSchema();

    const payload = {
      isActive: data.isActive,
      sendDayOfWeek: data.sendDayOfWeek || "monday",
      sendTime: data.sendTime || "08:00",
      recipients: data.recipients,
      includeRiskWatchlist: data.includeRiskWatchlist,
      includePerformanceMetrics: data.includePerformanceMetrics,
      includeSentimentPrompt: data.includeSentimentPrompt,
      updatedAt: new Date(),
    };

    if (data.id) {
      await db
        .update(weeklyClientReportSettings)
        .set(payload)
        .where(eq(weeklyClientReportSettings.id, data.id));
    } else {
      await db.insert(weeklyClientReportSettings).values(payload);
    }

    await logAction(
      session.user.id,
      "SAVE_WEEKLY_CLIENT_REPORT_SETTINGS",
      "weekly_client_report_settings",
      data.id?.toString() || "NEW",
      payload,
    );

    revalidatePath("/reports");
    return { success: true };
  } catch (error: any) {
    console.error("saveWeeklyClientReportSettingsAction error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Compiles the Weekly Client Report HTML
 */
export async function buildWeeklyClientReportHtml(params: {
  pulseDate: string;
  clients: ClientPulseItem[];
  summary: {
    totalClients: number;
    highRiskCount: number;
    moderateRiskCount: number;
    healthyCount: number;
    avgPortfolioRisk: number;
    pulseCoveragePercent: number;
  };
  options: {
    includeRiskWatchlist: boolean;
    includePerformanceMetrics: boolean;
    includeSentimentPrompt: boolean;
  };
  appBaseUrl: string;
}): Promise<string> {
  const { pulseDate, clients, summary, options, appBaseUrl } = params;
  const pulseUrl = `${appBaseUrl}/clients/pulse`;

  const unreviewedClients = clients.filter((c) => c.staffRatingsCount === 0);

  // Watchlist clients (high risk or with significant lead drop or CPA variance)
  const watchlist = clients.filter(
    (c) =>
      c.riskTier === "high" ||
      (c.leadsWowChange !== null && c.leadsWowChange <= -30) ||
      (c.cpaVariance !== null && c.cpaVariance >= 50),
  );

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Weekly Client Status & Retention Report</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f8fafc; padding: 24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 680px; background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
          
          <!-- Header -->
          <tr>
            <td style="padding: 28px 32px; background: linear-gradient(135deg, #4f46e5 0%, #6366f1 100%); color: #ffffff;">
              <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; font-weight: 700; color: #c7d2fe;">Agency Client Retention</div>
              <h1 style="margin: 6px 0 4px 0; font-size: 24px; font-weight: 800; color: #ffffff;">Weekly Client Status & Retention Digest</h1>
              <p style="margin: 0; font-size: 13px; color: #e0e7ff;">Week of ${pulseDate} &bull; ${summary.totalClients} Active Clients in Portfolio</p>
            </td>
          </tr>

          <!-- Call to Action Prompt Banner -->
          ${
            options.includeSentimentPrompt
              ? `<tr>
            <td style="padding: 24px 32px 12px 32px;">
              <div style="background-color: #f5f3ff; border: 1px solid #ddd6fe; border-radius: 12px; padding: 18px 20px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td style="vertical-align: middle;">
                      <h3 style="margin: 0 0 4px 0; font-size: 15px; font-weight: 700; color: #4338ca;">
                        ✍️ Team Sentiment Review Open
                      </h3>
                      <p style="margin: 0; font-size: 12px; color: #5b21b6; line-height: 1.5;">
                        Help calibrate our agency retention score ahead of the morning standup. Log your sentiment, lead quality thoughts, and client feedback for this week.
                      </p>
                    </td>
                    <td style="vertical-align: middle; text-align: right; padding-left: 16px;">
                      <a href="${pulseUrl}" style="display: inline-block; background-color: #4f46e5; color: #ffffff; padding: 10px 18px; border-radius: 10px; font-weight: 700; font-size: 12px; text-decoration: none; white-space: nowrap; box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);">
                        Log Pulse Now &rarr;
                      </a>
                    </td>
                  </tr>
                </table>
              </div>
            </td>
          </tr>`
              : ""
          }

          <!-- Portfolio Summary KPI Cards -->
          <tr>
            <td style="padding: 12px 32px 20px 32px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td width="32%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px 14px; text-align: center;">
                    <div style="font-size: 10px; text-transform: uppercase; font-weight: 700; color: #64748b; letter-spacing: 0.05em;">Avg Churn Risk</div>
                    <div style="font-size: 22px; font-weight: 800; font-family: monospace; color: ${summary.avgPortfolioRisk > 50 ? "#dc2626" : summary.avgPortfolioRisk > 30 ? "#d97706" : "#16a34a"}; margin-top: 2px;">
                      ${summary.avgPortfolioRisk}%
                    </div>
                    <div style="font-size: 10px; color: #64748b;">${summary.avgPortfolioRisk > 50 ? "Elevated" : "Healthy"}</div>
                  </td>
                  <td width="2%"></td>
                  <td width="32%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px 14px; text-align: center;">
                    <div style="font-size: 10px; text-transform: uppercase; font-weight: 700; color: #64748b; letter-spacing: 0.05em;">Critical / Watchlist</div>
                    <div style="font-size: 22px; font-weight: 800; font-family: monospace; color: #dc2626; margin-top: 2px;">
                      ${summary.highRiskCount}
                    </div>
                    <div style="font-size: 10px; color: #64748b;">Requires action</div>
                  </td>
                  <td width="2%"></td>
                  <td width="32%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px 14px; text-align: center;">
                    <div style="font-size: 10px; text-transform: uppercase; font-weight: 700; color: #64748b; letter-spacing: 0.05em;">Team Coverage</div>
                    <div style="font-size: 22px; font-weight: 800; font-family: monospace; color: #4f46e5; margin-top: 2px;">
                      ${summary.pulseCoveragePercent}%
                    </div>
                    <div style="font-size: 10px; color: #64748b;">${unreviewedClients.length} awaiting pulse</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Watchlist Section -->
          ${
            options.includeRiskWatchlist && watchlist.length > 0
              ? `<tr>
            <td style="padding: 0 32px 20px 32px;">
              <div style="border-top: 1px solid #e2e8f0; padding-top: 16px;">
                <h3 style="margin: 0 0 10px 0; font-size: 14px; font-weight: 700; color: #dc2626; text-transform: uppercase; letter-spacing: 0.05em;">
                  ⚠️ Attention & Retention Watchlist (${watchlist.length})
                </h3>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 10px; overflow: hidden;">
                  ${watchlist
                    .map(
                      (c) => `<tr>
                    <td style="padding: 10px 14px; border-bottom: 1px solid #fee2e2;">
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                        <tr>
                          <td>
                            <strong style="font-size: 13px; color: #991b1b;">${c.name}</strong>
                            <span style="font-size: 11px; color: #b91c1c; margin-left: 6px;">(${c.industry})</span>
                            ${
                              c.automatedFlags && c.automatedFlags.length > 0
                                ? `<div style="font-size: 11px; color: #b91c1c; margin-top: 2px;">${c.automatedFlags.join(" &bull; ")}</div>`
                                : ""
                            }
                          </td>
                          <td align="right" style="vertical-align: middle;">
                            <span style="display: inline-block; background-color: #fee2e2; color: #991b1b; border: 1px solid #fca5a5; padding: 3px 8px; border-radius: 6px; font-family: monospace; font-size: 12px; font-weight: 800;">
                              ${c.compositeRiskScore}% Risk
                            </span>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>`,
                    )
                    .join("")}
                </table>
              </div>
            </td>
          </tr>`
              : ""
          }

          <!-- Active Clients Status Breakdown Table -->
          <tr>
            <td style="padding: 0 32px 24px 32px;">
              <div style="border-top: 1px solid #e2e8f0; padding-top: 16px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td>
                      <h3 style="margin: 0; font-size: 14px; font-weight: 700; color: #0f172a; text-transform: uppercase; letter-spacing: 0.05em;">
                        Active Client Portfolio (${clients.length})
                      </h3>
                    </td>
                    <td align="right">
                      <a href="${pulseUrl}" style="font-size: 12px; font-weight: 600; color: #4f46e5; text-decoration: none;">
                        Open Pulse Board &rarr;
                      </a>
                    </td>
                  </tr>
                </table>

                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top: 12px; border-collapse: collapse; font-size: 12px; width: 100%;">
                  <thead>
                    <tr style="background-color: #f8fafc; border-bottom: 2px solid #e2e8f0; text-align: left; font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: 700;">
                      <th style="padding: 8px 10px;">Client</th>
                      <th style="padding: 8px 10px; text-align: center;">Risk Score</th>
                      ${options.includePerformanceMetrics ? `<th style="padding: 8px 10px;">7d Leads / CPA</th>` : ""}
                      <th style="padding: 8px 10px;">Team Status</th>
                      <th style="padding: 8px 10px; text-align: right;">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${clients
                      .slice(0, 30)
                      .map(
                        (
                          c,
                          idx,
                        ) => `<tr style="border-bottom: 1px solid #f1f5f9; background-color: ${idx % 2 === 0 ? "#ffffff" : "#fafafa"};">
                      <td style="padding: 9px 10px;">
                        <strong style="color: #0f172a; font-size: 12px;">${c.name}</strong>
                        <div style="color: #64748b; font-size: 10px;">${c.industry}</div>
                      </td>
                      <td style="padding: 9px 10px; text-align: center; vertical-align: middle;">
                        <span style="display: inline-block; padding: 2px 7px; border-radius: 6px; font-family: monospace; font-size: 11px; font-weight: 800; background-color: ${c.riskTier === "high" ? "#fee2e2" : c.riskTier === "moderate" ? "#fef3c7" : "#dcfce7"}; color: ${c.riskTier === "high" ? "#991b1b" : c.riskTier === "moderate" ? "#92400e" : "#166534"};">
                          ${c.compositeRiskScore}%
                        </span>
                      </td>
                      ${
                        options.includePerformanceMetrics
                          ? `<td style="padding: 9px 10px; vertical-align: middle;">
                        <div><strong>${c.recentLeads} leads</strong> ${c.leadsWowChange !== null ? `<span style="font-size: 10px; color: ${c.leadsWowChange < 0 ? "#dc2626" : "#16a34a"}; font-weight: bold;">(${c.leadsWowChange > 0 ? "+" : ""}${c.leadsWowChange}%)</span>` : ""}</div>
                        <div style="color: #64748b; font-size: 10px;">CPA: $${c.recentCpa} | Spend: $${c.recentSpend}</div>
                      </td>`
                          : ""
                      }
                      <td style="padding: 9px 10px; vertical-align: middle;">
                        ${
                          c.staffRatingsCount > 0
                            ? `<span style="color: #16a34a; font-weight: 600; font-size: 11px;">✓ ${c.staffRatingsCount} review(s)</span>`
                            : `<span style="color: #d97706; font-weight: 600; font-size: 11px;">⏳ Awaiting pulse</span>`
                        }
                      </td>
                      <td style="padding: 9px 10px; text-align: right; vertical-align: middle;">
                        <a href="${pulseUrl}" style="display: inline-block; background-color: #f1f5f9; color: #334155; padding: 4px 8px; border-radius: 6px; font-size: 11px; font-weight: 600; text-decoration: none; border: 1px solid #e2e8f0;">
                          Review &rarr;
                        </a>
                      </td>
                    </tr>`,
                      )
                      .join("")}
                  </tbody>
                </table>

                ${
                  clients.length > 30
                    ? `<div style="text-align: center; margin-top: 14px; font-size: 11px; color: #64748b;">
                  Showing top 30 clients by risk. <a href="${pulseUrl}" style="color: #4f46e5; font-weight: 600; text-decoration: none;">View all ${clients.length} active clients on the retention board &rarr;</a>
                </div>`
                    : ""
                }
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 32px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center; font-size: 11px; color: #64748b;">
              <p style="margin: 0 0 6px 0;">
                This automated weekly report is sent to all configured team members to facilitate weekly client retention triage.
              </p>
              <p style="margin: 0;">
                Manage report automation and recipients in <a href="${appBaseUrl}/reports" style="color: #4f46e5; text-decoration: underline;">Report Settings</a>.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Compiles a plain-text fallback version of the weekly report
 */
export async function buildWeeklyClientReportText(params: {
  pulseDate: string;
  clients: ClientPulseItem[];
  summary: {
    totalClients: number;
    highRiskCount: number;
    avgPortfolioRisk: number;
  };
  appBaseUrl: string;
}): Promise<string> {
  const { pulseDate, clients, summary, appBaseUrl } = params;
  const pulseUrl = `${appBaseUrl}/clients/pulse`;

  let body = `WEEKLY CLIENT STATUS & RETENTION DIGEST\n`;
  body += `Week of ${pulseDate} | ${summary.totalClients} Active Clients\n`;
  body += `Average Portfolio Risk: ${summary.avgPortfolioRisk}% | High Risk Clients: ${summary.highRiskCount}\n\n`;
  body += `Please review clients and submit your weekly sentiment ratings before the standup meeting:\n`;
  body += `${pulseUrl}\n\n`;
  body += `CLIENTS SUMMARY:\n`;
  body += `-----------------------------------------\n`;

  for (const c of clients) {
    body += `- ${c.name} [${c.compositeRiskScore}% Risk] (${c.industry})\n`;
    body += `  7d Leads: ${c.recentLeads} | CPA: $${c.recentCpa} | Spend: $${c.recentSpend}\n`;
    body += `  Team Status: ${c.staffRatingsCount > 0 ? `${c.staffRatingsCount} review(s)` : "Awaiting pulse"}\n\n`;
  }

  body += `\nManage automation settings at: ${appBaseUrl}/reports\n`;
  return body;
}

/**
 * Compiles and sends the Weekly Client Report email
 */
export async function sendWeeklyClientReportAction() {
  let emails: string[] = [];
  try {
    const settingsRes = await getWeeklyClientReportSettingsAction();
    const settings =
      settingsRes.success && settingsRes.data ? settingsRes.data : null;

    // Fetch Board Data for Week 0 (Current Week)
    const boardRes = await getClientPulseBoardDataAction(0);
    if (!boardRes.success || !boardRes.data) {
      throw new Error(
        boardRes.error || "Failed to fetch client retention data.",
      );
    }

    const { pulseDate, clients, summary } = boardRes.data;

    // Recipients fallback
    if (settings?.recipients && settings.recipients.length > 0) {
      emails = settings.recipients;
    } else {
      const team = await db
        .select()
        .from(user)
        .where(ne(user.id, SYSTEM_ACTOR));
      emails = team.map((u) => u.email).filter(Boolean);
    }

    if (emails.length === 0) {
      throw new Error("No recipients configured for weekly client report.");
    }

    const appBaseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.VERCEL_URL ||
      "http://localhost:3000";

    const htmlBody = await buildWeeklyClientReportHtml({
      pulseDate,
      clients,
      summary,
      options: {
        includeRiskWatchlist: settings?.includeRiskWatchlist ?? true,
        includePerformanceMetrics: settings?.includePerformanceMetrics ?? true,
        includeSentimentPrompt: settings?.includeSentimentPrompt ?? true,
      },
      appBaseUrl,
    });

    const subject = `📊 Weekly Client Status & Retention Digest — Week of ${pulseDate}`;

    let orgId: string | undefined;
    try {
      const session = await auth.api.getSession({ headers: await headers() });
      orgId = session?.session?.activeOrganizationId || undefined;
    } catch {
      // Cron context may not have headers session
    }

    const emailResult = await sendSystemEmail({
      organizationId: orgId,
      templateKey: "weekly_client_report",
      to: emails,
      customSubject: subject,
      customHtml: htmlBody,
      variables: {
        week_date: pulseDate,
        pulse_url: `${appBaseUrl}/clients/pulse`,
      },
    });

    if (!emailResult.success) {
      throw new Error(
        emailResult.error || "Failed to dispatch email via provider.",
      );
    }

    return {
      success: true,
      message: `Weekly client report successfully sent to ${emails.length} recipient(s).`,
      recipientCount: emails.length,
    };
  } catch (error: any) {
    console.error("sendWeeklyClientReportAction error:", error);
    return {
      success: false,
      error: error.message || "Failed to send weekly client report.",
    };
  }
}
