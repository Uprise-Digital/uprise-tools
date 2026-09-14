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
import { GEMINI_MODEL_LOW } from "@/lib/ai-config";
import { generateContentTracked } from "@/lib/ai-logger";
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
 * Helper to humanize industry codes
 */
function formatIndustryName(industry?: string | null): string {
  if (!industry) return "General";
  const map: Record<string, string> = {
    BUILDING_CONSTRUCTION: "Building & Construction",
    HOME_SERVICES_TRADES: "Home Services & Trades",
    ENERGY_SOLAR: "Solar & Renewables",
    LEGAL: "Legal Services",
    HEALTHCARE: "Healthcare & Medical",
    AUTOMOTIVE: "Automotive",
    ECOMMERCE: "E-Commerce",
    FINANCIAL_SERVICES: "Financial Services",
    REAL_ESTATE: "Real Estate",
    TECHNOLOGY: "Technology & SaaS",
    EDUCATION: "Education",
    HOSPITALITY: "Hospitality & Leisure",
    RETAIL: "Retail",
    OTHER: "General",
  };
  if (map[industry]) return map[industry];
  return industry
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Format leads and CPA into clean human copy
 */
function formatPerformanceCopy(client: ClientPulseItem): string {
  const leads = client.recentLeads;
  const spend = client.recentSpend;
  const cpa = client.recentCpa;
  const wow = client.leadsWowChange;

  if (spend === 0 && leads === 0) {
    return "Paused / No spend (7d)";
  }

  const leadsText = `${leads} ${leads === 1 ? "lead" : "leads"}`;
  const wowText = wow !== null ? ` (${wow > 0 ? "+" : ""}${wow}%)` : "";

  if (leads === 0 && spend > 0) {
    return `0 leads &bull; $${spend.toLocaleString()} spend`;
  }

  return `${leadsText}${wowText} &bull; CPA $${cpa}`;
}

/**
 * Helper to generate a concise 1-paragraph AI summary of the weekly client data
 */
export async function generateWeeklyExecutiveSummary(params: {
  pulseDate: string;
  clients: ClientPulseItem[];
  summary: {
    totalClients: number;
    highRiskCount: number;
    avgPortfolioRisk: number;
    pulseCoveragePercent: number;
  };
  organizationId?: string;
}): Promise<string> {
  const { pulseDate, clients, summary, organizationId } = params;

  // Build condensed input context for Gemini
  const watchlist = clients.filter(
    (c) =>
      (c.recentSpend ?? 0) > 0 &&
      (c.riskTier === "high" || c.compositeRiskScore > 50),
  );
  const topWins = clients.filter(
    (c) => (c.recentLeads ?? 0) >= 3 && (c.leadsWowChange ?? 0) >= 15,
  );
  const pendingRatingsCount = clients.filter(
    (c) => c.staffRatingsCount === 0,
  ).length;

  const dataPrompt = `
You are the Chief Operating Officer of a high-performance digital marketing agency (Uprise Digital).
Summarize this week's client status and retention data into exactly ONE punchy, executive paragraph (2-4 sentences max).

Data:
- Week: ${pulseDate}
- Active clients: ${summary.totalClients}
- Portfolio Average Risk: ${summary.avgPortfolioRisk}%
- Attention Watchlist (${watchlist.length} accounts): ${
    watchlist
      .slice(0, 3)
      .map(
        (c) =>
          `${c.name} (${c.recentLeads} leads, CPA $${c.recentCpa}, risk ${c.compositeRiskScore}%)`,
      )
      .join(", ") || "None"
  }
- Momentum/Wins (${topWins.length} accounts): ${
    topWins
      .slice(0, 2)
      .map((c) => `${c.name} (+${c.leadsWowChange}% leads)`)
      .join(", ") || "Steady"
  }
- Team Ratings Pending: ${pendingRatingsCount} unrated accounts

Rules:
- Exactly 1 paragraph. No bullet points, no markdown headings, no emojis, no asterisks.
- Professional, decisive tone.
- Directly highlight the biggest retention vulnerability, celebrate top momentum, and end with a reminder to submit client sentiment ratings before standup.
`;

  try {
    const aiRes = await generateContentTracked(
      {
        model: GEMINI_MODEL_LOW,
        contents: [{ role: "user", parts: [{ text: dataPrompt }] }],
        config: {
          temperature: 0.2,
          maxOutputTokens: 1000,
        },
      },
      {
        organizationId,
        feature: "weekly_client_report_executive_summary",
      },
    );

    const text =
      aiRes.response?.text?.trim?.() ||
      aiRes.response?.candidates?.[0]?.content?.parts?.[0]?.text?.trim?.();
    if (text && text.length > 20) {
      return text.replace(/\*\*/g, "").replace(/\*/g, "");
    }
  } catch (err) {
    console.warn(
      "Could not generate AI executive summary for weekly report:",
      err,
    );
  }

  // Fallback if AI fails or budget exceeded
  return `Across our ${summary.totalClients} active clients, overall portfolio churn risk sits at ${summary.avgPortfolioRisk}%, with ${watchlist.length} accounts requiring immediate performance review due to elevated CPA or lead declines. Meanwhile, top performers showed strong week-on-week lead momentum. Team members are requested to log their sentiment ratings on the remaining ${pendingRatingsCount} accounts prior to morning standup.`;
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
  aiExecutiveSummary?: string;
}): Promise<string> {
  const {
    pulseDate,
    clients,
    summary,
    options,
    appBaseUrl,
    aiExecutiveSummary,
  } = params;
  const pulseUrl = `${appBaseUrl}/clients/pulse`;
  const inactiveClientsUrl = `${appBaseUrl}/clients?tab=churned`;

  // 1. Genuine Risk Watchlist (Clients classified as high risk or composite risk > 50% with active spend)
  const watchlist = clients.filter((c) => {
    // Only real alerts, not paused accounts with zero spend
    const hasActiveSpend = (c.recentSpend ?? 0) > 0;
    return (
      hasActiveSpend && (c.riskTier === "high" || c.compositeRiskScore > 50)
    );
  });

  // 2. Pending Team Pulse (Clients with 0 team ratings this week, limited to top 5)
  const pendingRatings = clients
    .filter((c) => c.staffRatingsCount === 0)
    .slice(0, 5);

  // 3. Top Performers / Wins (Highest lead growth or healthy CPA, top 3)
  const wins = clients
    .filter(
      (c) =>
        (c.recentLeads ?? 0) >= 3 &&
        c.leadsWowChange !== null &&
        c.leadsWowChange >= 15 &&
        c.compositeRiskScore <= 35,
    )
    .sort((a, b) => (b.leadsWowChange ?? 0) - (a.leadsWowChange ?? 0))
    .slice(0, 3);

  // 4. Stable / Rest of Active Portfolio (top 15 snapshot)
  const highlightedIds = new Set([
    ...watchlist.map((c) => c.id),
    ...pendingRatings.map((c) => c.id),
    ...wins.map((c) => c.id),
  ]);

  const otherActiveClients = clients
    .filter((c) => !highlightedIds.has(c.id))
    .slice(0, 15);

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
                ${pendingRatings.length > 0 ? `Please log sentiment ratings for ${clients.filter((c) => c.staffRatingsCount === 0).length} client(s) before morning standup.` : "All active clients currently have team ratings. Check the board to review."}
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

    <!-- AI Executive Briefing -->
    ${
      aiExecutiveSummary
        ? `<tr>
      <td style="padding: 18px 24px 4px 24px;">
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #4f46e5; border-radius: 6px; padding: 14px 16px;">
          <div style="font-size: 10px; text-transform: uppercase; font-weight: 700; letter-spacing: 0.05em; color: #4338ca; margin-bottom: 6px;">
            AI Executive Overview
          </div>
          <div style="font-size: 13px; line-height: 1.55; color: #334155;">
            ${aiExecutiveSummary}
          </div>
        </div>
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
              <div style="font-size: 10px; color: #64748b;">${watchlist.length > 0 ? "Requires review" : "No critical alerts"}</div>
            </td>
            <td width="3.5%"></td>
            <td width="31%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 10px; text-align: center;">
              <div style="font-size: 10px; text-transform: uppercase; font-weight: 700; color: #64748b; letter-spacing: 0.04em;">Coverage</div>
              <div style="font-size: 20px; font-weight: 700; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; color: #4338ca; margin: 4px 0 2px 0;">
                ${summary.pulseCoveragePercent}%
              </div>
              <div style="font-size: 10px; color: #64748b;">${clients.filter((c) => c.staffRatingsCount === 0).length} pending</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- SECTION 1: ATTENTION & RETENTION WATCHLIST -->
    ${
      options.includeRiskWatchlist && watchlist.length > 0
        ? `<tr>
      <td style="padding: 0 24px 16px 24px;">
        <div style="border-top: 1px solid #f1f5f9; padding-top: 16px;">
          <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #b91c1c; margin-bottom: 10px;">
            Immediate Attention Watchlist (${watchlist.length})
          </div>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border: 1px solid #fecaca; border-radius: 8px; background-color: #fef2f2; border-collapse: separate; overflow: hidden;">
            ${watchlist
              .map(
                (c, idx) => `<tr>
              <td style="padding: 12px 14px; ${idx < watchlist.length - 1 ? "border-bottom: 1px solid #fee2e2;" : ""}">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td style="vertical-align: top;">
                      <div style="font-size: 13px; font-weight: 700; color: #991b1b;">
                        ${c.name}
                      </div>
                      <div style="font-size: 11px; color: #7f1d1d; margin-top: 2px;">
                        ${formatIndustryName(c.industry)} &bull; ${formatPerformanceCopy(c)}
                      </div>
                      ${
                        c.automatedFlags && c.automatedFlags.length > 0
                          ? `<div style="font-size: 11px; font-weight: 600; color: #b91c1c; margin-top: 4px;">&bull; ${c.automatedFlags.join("<br>&bull; ")}</div>`
                          : ""
                      }
                    </td>
                    <td align="right" style="vertical-align: top; padding-left: 10px; white-space: nowrap;">
                      <span style="display: inline-block; padding: 2px 7px; border-radius: 4px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 11px; font-weight: 700; background-color: #fee2e2; color: #991b1b; border: 1px solid #fca5a5;">
                        ${c.compositeRiskScore}% Risk
                      </span>
                      <div style="margin-top: 6px;">
                        <a href="${pulseUrl}" style="display: inline-block; font-size: 11px; font-weight: 600; color: #991b1b; text-decoration: underline;">
                          Triage &rarr;
                        </a>
                      </div>
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

    <!-- SECTION 2: PENDING RATINGS (Call to action for team) -->
    ${
      pendingRatings.length > 0
        ? `<tr>
      <td style="padding: 0 24px 16px 24px;">
        <div style="border-top: 1px solid #f1f5f9; padding-top: 16px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 8px;">
            <tr>
              <td style="vertical-align: middle;">
                <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #4338ca;">
                  Ratings Needed This Week (${clients.filter((c) => c.staffRatingsCount === 0).length})
                </div>
              </td>
              <td align="right" style="vertical-align: middle;">
                <a href="${pulseUrl}" style="font-size: 11px; font-weight: 600; color: #4f46e5; text-decoration: none;">
                  Log All &rarr;
                </a>
              </td>
            </tr>
          </table>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border: 1px solid #e0e7ff; border-radius: 8px; background-color: #eef2ff; border-collapse: separate; overflow: hidden;">
            ${pendingRatings
              .map(
                (c, idx) => `<tr>
              <td style="padding: 10px 14px; ${idx < pendingRatings.length - 1 ? "border-bottom: 1px solid #e0e7ff;" : ""}">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td style="vertical-align: middle;">
                      <div style="font-size: 13px; font-weight: 700; color: #1e1b4b;">
                        ${c.name}
                      </div>
                      <div style="font-size: 11px; color: #4338ca; margin-top: 1px;">
                        ${formatIndustryName(c.industry)} &bull; ${formatPerformanceCopy(c)}
                      </div>
                    </td>
                    <td align="right" style="vertical-align: middle; padding-left: 10px; white-space: nowrap;">
                      <a href="${pulseUrl}" style="display: inline-block; background-color: #4f46e5; color: #ffffff; padding: 4px 10px; border-radius: 4px; font-size: 11px; font-weight: 600; text-decoration: none;">
                        Rate &rarr;
                      </a>
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

    <!-- SECTION 3: TOP PERFORMERS / WINS -->
    ${
      wins.length > 0
        ? `<tr>
      <td style="padding: 0 24px 16px 24px;">
        <div style="border-top: 1px solid #f1f5f9; padding-top: 16px;">
          <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #15803d; margin-bottom: 8px;">
            Top Performers &amp; Momentum
          </div>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border: 1px solid #bbf7d0; border-radius: 8px; background-color: #f0fdf4; border-collapse: separate; overflow: hidden;">
            ${wins
              .map(
                (c, idx) => `<tr>
              <td style="padding: 10px 14px; ${idx < wins.length - 1 ? "border-bottom: 1px solid #bbf7d0;" : ""}">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td style="vertical-align: middle;">
                      <div style="font-size: 13px; font-weight: 700; color: #14532d;">
                        ${c.name}
                      </div>
                      <div style="font-size: 11px; color: #166534; margin-top: 1px;">
                        ${formatIndustryName(c.industry)} &bull; ${formatPerformanceCopy(c)}
                      </div>
                    </td>
                    <td align="right" style="vertical-align: middle; padding-left: 10px; white-space: nowrap;">
                      <span style="display: inline-block; padding: 2px 7px; border-radius: 4px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 11px; font-weight: 700; background-color: #dcfce7; color: #15803d; border: 1px solid #86efac;">
                        +${c.leadsWowChange}% WoW
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

    <!-- SECTION 4: REMAINING ACTIVE CLIENTS SNAPSHOT -->
    ${
      otherActiveClients.length > 0
        ? `<tr>
      <td style="padding: 0 24px 16px 24px;">
        <div style="border-top: 1px solid #f1f5f9; padding-top: 16px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 8px;">
            <tr>
              <td style="vertical-align: middle;">
                <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #475569;">
                  Stable Client Snapshot (${otherActiveClients.length})
                </div>
              </td>
              <td align="right" style="vertical-align: middle;">
                <a href="${pulseUrl}" style="font-size: 11px; font-weight: 600; color: #4f46e5; text-decoration: none;">
                  Full Board (${clients.length}) &rarr;
                </a>
              </td>
            </tr>
          </table>

          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; border-collapse: separate;">
            ${otherActiveClients
              .map(
                (c, idx) => `<tr>
              <td style="padding: 9px 14px; background-color: ${idx % 2 === 0 ? "#ffffff" : "#f8fafc"}; ${idx < otherActiveClients.length - 1 ? "border-bottom: 1px solid #e2e8f0;" : ""}">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td style="vertical-align: middle;">
                      <div style="font-size: 13px; font-weight: 600; color: #0f172a;">
                        ${c.name}
                      </div>
                      <div style="font-size: 11px; color: #64748b; margin-top: 1px;">
                        ${formatIndustryName(c.industry)} &bull; ${formatPerformanceCopy(c)}
                      </div>
                    </td>
                    <td align="right" style="vertical-align: middle; padding-left: 10px; white-space: nowrap;">
                      <span style="display: inline-block; padding: 2px 6px; border-radius: 4px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 11px; font-weight: 600; background-color: #f1f5f9; color: #475569;">
                        ${c.compositeRiskScore}%
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

    <!-- SECTION 5: MISSING AN ACCOUNT? CHECK INACTIVE -->
    <tr>
      <td style="padding: 0 24px 20px 24px;">
        <div style="border-top: 1px solid #f1f5f9; padding-top: 16px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 8px; padding: 12px 16px;">
            <tr>
              <td style="vertical-align: middle;">
                <div style="font-size: 12px; font-weight: 700; color: #334155; margin-bottom: 2px;">
                  Missing an account?
                </div>
                <div style="font-size: 11px; color: #64748b; line-height: 1.4;">
                  Accounts marked as paused or churned are excluded from the weekly active pulse.
                </div>
              </td>
              <td align="right" style="vertical-align: middle; padding-left: 12px; white-space: nowrap;">
                <a href="${inactiveClientsUrl}" style="display: inline-block; font-size: 11px; font-weight: 600; color: #4f46e5; text-decoration: none; border: 1px solid #c7d2fe; background-color: #ffffff; padding: 6px 12px; border-radius: 6px;">
                  Check Inactive Accounts &rarr;
                </a>
              </td>
            </tr>
          </table>
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
        <div style="display: none; font-size: 1px; color: #ffffff; line-height: 1px; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden;">
          Digest Ref: ${Date.now()}-${Math.random().toString(36).substring(2, 7)}
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
  const inactiveUrl = `${appBaseUrl}/clients?tab=churned`;

  let body = `WEEKLY CLIENT STATUS & RETENTION DIGEST\n`;
  body += `Week of ${pulseDate} | ${summary.totalClients} Active Clients\n`;
  body += `Average Portfolio Risk: ${summary.avgPortfolioRisk}% | High Risk Clients: ${summary.highRiskCount}\n\n`;
  body += `Please review clients and submit your weekly sentiment ratings before the standup meeting:\n`;
  body += `${pulseUrl}\n\n`;
  body += `CLIENTS SUMMARY:\n`;
  body += `-----------------------------------------\n`;

  for (const c of clients.slice(0, 20)) {
    body += `- ${c.name} [${c.compositeRiskScore}% Risk] (${formatIndustryName(c.industry)})\n`;
    body += `  ${formatPerformanceCopy(c)}\n`;
    body += `  Team Status: ${c.staffRatingsCount > 0 ? `${c.staffRatingsCount} review(s)` : "Awaiting review"}\n\n`;
  }

  body += `\nMissing an account? Check inactive accounts at: ${inactiveUrl}\n`;
  body += `Manage automation settings at: ${appBaseUrl}/reports\n`;
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

    let orgId: string | undefined;
    try {
      const session = await auth.api.getSession({ headers: await headers() });
      orgId = session?.session?.activeOrganizationId || undefined;
    } catch {
      // Cron context may not have headers session
    }

    // Generate 1-paragraph AI Executive Summary
    const aiSummary = await generateWeeklyExecutiveSummary({
      pulseDate,
      clients,
      summary,
      organizationId: orgId,
    });

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
      aiExecutiveSummary: aiSummary,
    });

    const subject = `Weekly Client Status & Retention Digest — Week of ${pulseDate}`;

    const messageId = `<weekly-report-${Date.now()}-${Math.random().toString(36).substring(2, 9)}@uprisedigital.com.au>`;

    const emailResult = await sendSystemEmail({
      organizationId: orgId,
      templateKey: "weekly_client_report",
      to: emails,
      customSubject: subject,
      customHtml: htmlBody,
      headers: {
        "Message-ID": messageId,
        "X-Entity-Ref-ID": messageId,
      },
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
