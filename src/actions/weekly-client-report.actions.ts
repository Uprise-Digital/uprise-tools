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
import { getAppUrl } from "@/lib/app-url";
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
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Weekly Client Status and Retention Digest</title>
</head>
<body style="margin: 0; padding: 0; background-color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; -webkit-text-size-adjust: 100%; color: #0f172a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" align="center" style="width: 100%; max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; border-spacing: 0;">
    
    <!-- Top Brand Header -->
    <tr>
      <td style="padding: 24px 24px 20px 24px; background-color: #0f172a; text-align: left;">
          <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 700; color: #94a3b8; margin-bottom: 6px;">
            Uprise Digital &bull; Client Retention
          </div>
          <h1 style="margin: 0 0 6px 0; font-size: 20px; font-weight: 700; line-height: 1.3; color: #ffffff;">
            Weekly Client Status &amp; Retention Digest
          </h1>
          <div style="font-size: 12px; color: #cbd5e1;">
            Week of ${pulseDate} &bull; ${summary.totalClients} Active Clients
          </div>
        </td>
      </tr>

      <!-- Sentiment Review Action Callout -->
      ${
        options.includeSentimentPrompt
          ? `<tr>
        <td style="padding: 16px 24px; background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
            <tr>
              <td style="vertical-align: middle;">
                <div style="font-size: 13px; font-weight: 700; color: #0f172a; margin-bottom: 3px;">
                  Pre-Standup Sentiment Review Open
                </div>
                <div style="font-size: 12px; color: #475569; line-height: 1.4;">
                  Please enter your client sentiment and lead quality ratings before the team morning standup.
                </div>
              </td>
              <td align="right" style="vertical-align: middle; padding-left: 12px; white-space: nowrap;">
                <a href="${pulseUrl}" style="display: inline-block; background-color: #4f46e5; color: #ffffff; padding: 8px 14px; border-radius: 6px; font-size: 12px; font-weight: 600; text-decoration: none;">
                  Log Ratings &rarr;
                </a>
              </td>
            </tr>
          </table>
        </td>
      </tr>`
          : ""
      }

      <!-- KPI Summary Cards -->
      <tr>
        <td style="padding: 20px 24px 16px 24px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
            <tr>
              <td width="31%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 10px; text-align: center;">
                <div style="font-size: 10px; text-transform: uppercase; font-weight: 700; color: #64748b; letter-spacing: 0.04em;">Average Risk</div>
                <div style="font-size: 20px; font-weight: 700; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; color: ${summary.avgPortfolioRisk > 50 ? "#b91c1c" : summary.avgPortfolioRisk > 30 ? "#b45309" : "#15803d"}; margin: 4px 0 2px 0;">
                  ${summary.avgPortfolioRisk}%
                </div>
                <div style="font-size: 10px; color: #64748b;">${summary.avgPortfolioRisk > 50 ? "Elevated" : "Healthy"}</div>
              </td>
              <td width="3.5%"></td>
              <td width="31%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 10px; text-align: center;">
                <div style="font-size: 10px; text-transform: uppercase; font-weight: 700; color: #64748b; letter-spacing: 0.04em;">Watchlist</div>
                <div style="font-size: 20px; font-weight: 700; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; color: ${watchlist.length > 0 ? "#b91c1c" : "#15803d"}; margin: 4px 0 2px 0;">
                  ${watchlist.length}
                </div>
                <div style="font-size: 10px; color: #64748b;">${watchlist.length > 0 ? "Requires review" : "No high alerts"}</div>
              </td>
              <td width="3.5%"></td>
              <td width="31%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 10px; text-align: center;">
                <div style="font-size: 10px; text-transform: uppercase; font-weight: 700; color: #64748b; letter-spacing: 0.04em;">Coverage</div>
                <div style="font-size: 20px; font-weight: 700; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; color: #4338ca; margin: 4px 0 2px 0;">
                  ${summary.pulseCoveragePercent}%
                </div>
                <div style="font-size: 10px; color: #64748b;">${unreviewedClients.length} pending</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- Attention Watchlist Section -->
      ${
        options.includeRiskWatchlist && watchlist.length > 0
          ? `<tr>
        <td style="padding: 0 24px 16px 24px;">
          <div style="border-top: 1px solid #f1f5f9; padding-top: 16px;">
            <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #b91c1c; margin-bottom: 10px;">
              Attention &amp; Retention Watchlist (${watchlist.length})
            </div>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border: 1px solid #fecaca; border-radius: 8px; background-color: #fef2f2; border-collapse: separate;">
              ${watchlist
                .map(
                  (c, idx) => `<tr>
                <td style="padding: 10px 14px; ${idx < watchlist.length - 1 ? "border-bottom: 1px solid #fee2e2;" : ""}">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                    <tr>
                      <td style="vertical-align: top;">
                        <div style="font-size: 13px; font-weight: 700; color: #991b1b;">
                          ${c.name}
                        </div>
                        <div style="font-size: 11px; color: #7f1d1d; margin-top: 1px;">
                          ${c.industry || "General"} &bull; ${c.recentLeads} leads (7d) &bull; CPA $${c.recentCpa}
                        </div>
                        ${
                          c.automatedFlags && c.automatedFlags.length > 0
                            ? `<div style="font-size: 11px; color: #991b1b; margin-top: 3px;">${c.automatedFlags.join(" &bull; ")}</div>`
                            : ""
                        }
                      </td>
                      <td align="right" style="vertical-align: top; padding-left: 8px;">
                        <span style="display: inline-block; padding: 2px 6px; border-radius: 4px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 11px; font-weight: 700; background-color: #fee2e2; color: #991b1b; border: 1px solid #fca5a5;">
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

      <!-- Active Clients Portfolio Section -->
      <tr>
        <td style="padding: 0 24px 20px 24px;">
          <div style="border-top: 1px solid #f1f5f9; padding-top: 16px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 10px;">
              <tr>
                <td style="vertical-align: middle;">
                  <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #475569;">
                    Active Client Portfolio (${clients.length})
                  </div>
                </td>
                <td align="right" style="vertical-align: middle;">
                  <a href="${pulseUrl}" style="font-size: 11px; font-weight: 600; color: #4f46e5; text-decoration: none;">
                    View Dashboard &rarr;
                  </a>
                </td>
              </tr>
            </table>

            <!-- Mobile-Friendly Client Rows -->
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; border-collapse: separate;">
              ${clients
                .slice(0, 30)
                .map(
                  (c, idx) => `<tr>
                <td style="padding: 10px 14px; background-color: ${idx % 2 === 0 ? "#ffffff" : "#f8fafc"}; ${idx < Math.min(clients.length, 30) - 1 ? "border-bottom: 1px solid #e2e8f0;" : ""}">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                    <tr>
                      <td style="vertical-align: middle;">
                        <div style="font-size: 13px; font-weight: 700; color: #0f172a;">
                          ${c.name}
                        </div>
                        <div style="font-size: 11px; color: #64748b; margin-top: 2px;">
                          ${c.industry || "General"}
                          ${
                            options.includePerformanceMetrics
                              ? ` &bull; ${c.recentLeads} leads ${c.leadsWowChange !== null ? `(${c.leadsWowChange > 0 ? "+" : ""}${c.leadsWowChange}%)` : ""} &bull; CPA $${c.recentCpa}`
                              : ""
                          }
                        </div>
                      </td>
                      <td align="right" style="vertical-align: middle; padding-left: 10px; white-space: nowrap;">
                        <span style="display: inline-block; padding: 2px 7px; border-radius: 4px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 11px; font-weight: 700; background-color: ${c.riskTier === "high" ? "#fee2e2" : c.riskTier === "moderate" ? "#fef3c7" : "#dcfce7"}; color: ${c.riskTier === "high" ? "#991b1b" : c.riskTier === "moderate" ? "#92400e" : "#166534"};">
                          ${c.compositeRiskScore}%
                        </span>
                        <div style="font-size: 10px; color: ${c.staffRatingsCount > 0 ? "#15803d" : "#9a3412"}; font-weight: 600; margin-top: 2px;">
                          ${c.staffRatingsCount > 0 ? `${c.staffRatingsCount} review(s)` : "Awaiting"}
                        </div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>`,
                )
                .join("")}
            </table>

            ${
              clients.length > 30
                ? `<div style="text-align: center; margin-top: 10px; font-size: 11px; color: #64748b;">
              Showing first 30 of ${clients.length} active accounts. <a href="${pulseUrl}" style="color: #4f46e5; text-decoration: none; font-weight: 600;">View complete list on retention board &rarr;</a>
            </div>`
                : ""
            }
          </div>
        </td>
      </tr>

      <!-- Footer -->
      <tr>
        <td style="padding: 16px 24px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center; font-size: 11px; color: #64748b; line-height: 1.5;">
          <div>Uprise Digital &bull; Client Retention Automation</div>
          <div style="margin-top: 2px;">
            Configure schedule and recipients in <a href="${appBaseUrl}/reports" style="color: #4f46e5; text-decoration: underline;">Report Settings</a>.
          </div>
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
    body += `  Team Status: ${c.staffRatingsCount > 0 ? `${c.staffRatingsCount} review(s)` : "Awaiting review"}\n\n`;
  }

  body += `\nManage automation settings at: ${appBaseUrl}/reports\n`;
  return body;
}

/**
 * Compiles and sends the Weekly Client Report email
 */
export async function sendWeeklyClientReportAction(
  recipientOverride?: string | string[],
) {
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

    // Determine recipients (override > settings > team members)
    if (recipientOverride) {
      emails = Array.isArray(recipientOverride)
        ? recipientOverride
        : [recipientOverride];
    } else if (settings?.recipients && settings.recipients.length > 0) {
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

    const appBaseUrl = getAppUrl();

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

    const subject = `Weekly Client Status & Retention Digest — Week of ${pulseDate}`;

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
