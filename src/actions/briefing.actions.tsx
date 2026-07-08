"use server";

import { and, eq, gte, lte, ne } from "drizzle-orm";
import { Resend } from "resend";
import { db } from "@/db";
import { adAccounts, adPerformanceDaily, user } from "@/db/schema";
import { generateMorningBriefingText } from "@/lib/ai-service";
import { logAction, logEmail } from "@/lib/audit";
import { getBriefingSettingsAction } from "./briefing-settings.actions";
import { getOrgTriageDefaultsAction } from "./triage-settings.actions";

const resend = new Resend(process.env.RESEND_API_KEY!);

const SYSTEM_ACTOR = "SYSTEM_AUTOMATION";

// Date utility to get YYYY-MM-DD in Australia/Melbourne timezone
import {
  formatUTCDate,
  getMelbourneDateStrings,
  parseUTCDate,
} from "@/lib/date-utils";

export async function getBriefingDataAction(yesterdayStrOverride?: string) {
  // 1. Get correct date strings
  const { yesterdayStr, yesterdayFormatted, todayFormatted, yesterdayDate } =
    getMelbourneDateStrings();
  const activeDateStr = yesterdayStrOverride || yesterdayStr;

  // 2. Fetch all active accounts
  const activeAccountsList = await db.query.adAccounts.findMany({
    where: and(
      eq(adAccounts.isActive, true),
      eq(adAccounts.includeInBriefing, true),
    ),
  });

  if (activeAccountsList.length === 0) {
    return { success: false, error: "No active accounts found." };
  }

  // Fetch triage defaults and overrides
  const orgDefaultsRes = await getOrgTriageDefaultsAction();
  const orgDefaults =
    orgDefaultsRes.success && orgDefaultsRes.data
      ? orgDefaultsRes.data
      : {
          criticalSpendThreshold: 70.0,
          criticalConversionsThreshold: 0,
          ctrHighThreshold: 7.0,
          ctrHighSpendThreshold: 50.0,
          cpcHighThreshold: 30.0,
          anomalySpendChangeThreshold: -30.0,
          anomalyConversionsChangeThreshold: -25.0,
        };

  const overridesList = await db.query.accountTriageSettings.findMany();
  const overridesMap = new Map(overridesList.map((o) => [o.adAccountId, o]));

  const accountMap = new Map(activeAccountsList.map((a) => [a.id, a]));

  // 3. Fetch yesterday's performance
  const yesterdayRows = await db.query.adPerformanceDaily.findMany({
    where: eq(adPerformanceDaily.date, activeDateStr),
  });

  // 4. Fetch 30-day baseline performance
  const refDate = yesterdayStrOverride
    ? parseUTCDate(yesterdayStrOverride)
    : yesterdayDate;
  const baselineStart = new Date(refDate);
  baselineStart.setUTCDate(refDate.getUTCDate() - 30);

  const baselineEnd = new Date(refDate);
  baselineEnd.setUTCDate(refDate.getUTCDate() - 1);

  const baselineStartStr = formatUTCDate(baselineStart);
  const baselineEndStr = formatUTCDate(baselineEnd);

  const baselineRows = await db.query.adPerformanceDaily.findMany({
    where: and(
      gte(adPerformanceDaily.date, baselineStartStr),
      lte(adPerformanceDaily.date, baselineEndStr),
    ),
  });

  // 5. Aggregate yesterday's data per account
  const yesterdayAgg = new Map<
    number,
    { spend: number; clicks: number; impressions: number; conversions: number }
  >();
  for (const row of yesterdayRows) {
    const id = row.adAccountId;
    if (!yesterdayAgg.has(id)) {
      yesterdayAgg.set(id, {
        spend: 0,
        clicks: 0,
        impressions: 0,
        conversions: 0,
      });
    }
    const m = yesterdayAgg.get(id)!;
    m.spend += Number(row.spend || 0);
    m.clicks += Number(row.clicks || 0);
    m.impressions += Number(row.impressions || 0);
    m.conversions += Number(row.conversions || 0);
  }

  // 6. Aggregate baseline daily data per account to compute daily average
  const baselineDailyMap = new Map<
    string,
    { spend: number; clicks: number; impressions: number; conversions: number }
  >();
  for (const row of baselineRows) {
    const key = `${row.adAccountId}_${row.date}`;
    if (!baselineDailyMap.has(key)) {
      baselineDailyMap.set(key, {
        spend: 0,
        clicks: 0,
        impressions: 0,
        conversions: 0,
      });
    }
    const m = baselineDailyMap.get(key)!;
    m.spend += Number(row.spend || 0);
    m.clicks += Number(row.clicks || 0);
    m.impressions += Number(row.impressions || 0);
    m.conversions += Number(row.conversions || 0);
  }

  const baselineAccountList = new Map<
    number,
    Array<{
      spend: number;
      clicks: number;
      impressions: number;
      conversions: number;
    }>
  >();
  for (const [key, metrics] of baselineDailyMap.entries()) {
    const accId = Number(key.split("_")[0]);
    if (!baselineAccountList.has(accId)) {
      baselineAccountList.set(accId, []);
    }
    baselineAccountList.get(accId)!.push(metrics);
  }

  const baselineAvgMap = new Map<
    number,
    {
      spend: number;
      conversions: number;
      clicks: number;
      impressions: number;
      daysCount: number;
    }
  >();
  for (const [accId, dailyList] of baselineAccountList.entries()) {
    const totalSpend = dailyList.reduce((sum, d) => sum + d.spend, 0);
    const totalConversions = dailyList.reduce(
      (sum, d) => sum + d.conversions,
      0,
    );
    const totalClicks = dailyList.reduce((sum, d) => sum + d.clicks, 0);
    const totalImpressions = dailyList.reduce(
      (sum, d) => sum + d.impressions,
      0,
    );

    // Correct baseline: divide by unique dates available in the baseline window
    const daysCount = dailyList.length || 1;
    baselineAvgMap.set(accId, {
      spend: totalSpend / daysCount,
      conversions: totalConversions / daysCount,
      clicks: totalClicks / daysCount,
      impressions: totalImpressions / daysCount,
      daysCount,
    });
  }

  // 7. Calculate Portfolio Totals
  let totalSpend = 0;
  let totalConversions = 0;
  let activeAccountsCount = 0;

  const accountBreakdown: any[] = [];

  for (const acc of activeAccountsList) {
    const yesterdayMetrics = yesterdayAgg.get(acc.id) || {
      spend: 0,
      clicks: 0,
      impressions: 0,
      conversions: 0,
    };
    if (yesterdayMetrics.spend > 0 || yesterdayMetrics.impressions > 0) {
      totalSpend += yesterdayMetrics.spend;
      totalConversions += yesterdayMetrics.conversions;
      activeAccountsCount++;

      const baselineAvg = baselineAvgMap.get(acc.id) || {
        spend: 0,
        conversions: 0,
        clicks: 0,
        impressions: 0,
      };

      const cpa =
        yesterdayMetrics.conversions > 0
          ? yesterdayMetrics.spend / yesterdayMetrics.conversions
          : 0;
      const ctr =
        yesterdayMetrics.impressions > 0
          ? (yesterdayMetrics.clicks / yesterdayMetrics.impressions) * 100
          : 0;
      const cpc =
        yesterdayMetrics.clicks > 0
          ? yesterdayMetrics.spend / yesterdayMetrics.clicks
          : 0;

      const baselineCpa =
        baselineAvg.conversions > 0
          ? baselineAvg.spend / baselineAvg.conversions
          : 0;
      const baselineCtr =
        baselineAvg.impressions > 0
          ? (baselineAvg.clicks / baselineAvg.impressions) * 100
          : 0;
      const baselineCpc =
        baselineAvg.clicks > 0 ? baselineAvg.spend / baselineAvg.clicks : 0;

      accountBreakdown.push({
        accountId: acc.id,
        name: acc.name,
        targetCpa: acc.targetCpa ? Number(acc.targetCpa) : null,
        spend: yesterdayMetrics.spend,
        conversions: yesterdayMetrics.conversions,
        clicks: yesterdayMetrics.clicks,
        impressions: yesterdayMetrics.impressions,
        cpa,
        ctr,
        cpc,
        baseline: {
          dailyAvgSpend: baselineAvg.spend,
          dailyAvgConversions: baselineAvg.conversions,
          cpa: baselineCpa,
          ctr: baselineCtr,
          cpc: baselineCpc,
        },
      });
    }
  }

  // Sort by spend descending
  accountBreakdown.sort((a, b) => b.spend - a.spend);

  // 8. Whale Analysis (> 25% spend share)
  let hasWhale = false;
  let whaleName = "";
  let spendSharePct = 0;
  let whaleSpend = 0;
  let longTailCpa = 0;

  if (accountBreakdown.length > 0) {
    const topAcc = accountBreakdown[0];
    if (totalSpend > 0 && topAcc.spend > totalSpend * 0.25) {
      hasWhale = true;
      whaleName = topAcc.name;
      spendSharePct = (topAcc.spend / totalSpend) * 100;
      whaleSpend = topAcc.spend;

      const nonWhaleSpend = totalSpend - topAcc.spend;
      const nonWhaleConversions = totalConversions - topAcc.conversions;
      longTailCpa =
        nonWhaleConversions > 0 ? nonWhaleSpend / nonWhaleConversions : 0;
    }
  }

  // 9. Categorize Alerts (Attention Items) vs Normal Zero Conversions vs Successes
  const alerts: any[] = [];
  const zeroConversionNoAlerts: any[] = [];
  const successes: any[] = [];

  for (const acc of accountBreakdown) {
    const isWhale = hasWhale && acc.name === whaleName;
    const targetCpaVal = acc.targetCpa;

    // Resolve dynamic triage thresholds (override -> org default)
    const override = overridesMap.get(acc.accountId);

    const criticalSpend =
      override?.criticalSpendThreshold !== null &&
      override?.criticalSpendThreshold !== undefined
        ? Number(override.criticalSpendThreshold)
        : Number(orgDefaults.criticalSpendThreshold);

    const criticalConversions =
      override?.criticalConversionsThreshold !== null &&
      override?.criticalConversionsThreshold !== undefined
        ? override.criticalConversionsThreshold
        : orgDefaults.criticalConversionsThreshold;

    const ctrHigh =
      override?.ctrHighThreshold !== null &&
      override?.ctrHighThreshold !== undefined
        ? Number(override.ctrHighThreshold)
        : Number(orgDefaults.ctrHighThreshold);

    const ctrHighSpend =
      override?.ctrHighSpendThreshold !== null &&
      override?.ctrHighSpendThreshold !== undefined
        ? Number(override.ctrHighSpendThreshold)
        : Number(orgDefaults.ctrHighSpendThreshold);

    const cpcHigh =
      override?.cpcHighThreshold !== null &&
      override?.cpcHighThreshold !== undefined
        ? Number(override.cpcHighThreshold)
        : Number(orgDefaults.cpcHighThreshold);

    const anomalySpendChange =
      override?.anomalySpendChangeThreshold !== null &&
      override?.anomalySpendChangeThreshold !== undefined
        ? Number(override.anomalySpendChangeThreshold)
        : Number(orgDefaults.anomalySpendChangeThreshold);

    const anomalyConversionsChange =
      override?.anomalyConversionsChangeThreshold !== null &&
      override?.anomalyConversionsChangeThreshold !== undefined
        ? Number(override.anomalyConversionsChangeThreshold)
        : Number(orgDefaults.anomalyConversionsChangeThreshold);

    // Anomaly / Fire Flags
    let isAnomaly = false;
    let changeSpendPct = 0;
    let changeConversionsPct = 0;

    if (acc.baseline.dailyAvgSpend > 0) {
      changeSpendPct =
        ((acc.spend - acc.baseline.dailyAvgSpend) /
          acc.baseline.dailyAvgSpend) *
        100;
    }
    if (acc.baseline.dailyAvgConversions > 0) {
      changeConversionsPct =
        ((acc.conversions - acc.baseline.dailyAvgConversions) /
          acc.baseline.dailyAvgConversions) *
        100;
    }

    // Spend is down significantly or conversions down significantly
    if (
      acc.spend > 50 &&
      (changeSpendPct < anomalySpendChange ||
        changeConversionsPct < anomalyConversionsChange)
    ) {
      isAnomaly = true;
    }

    const cpcIsHigh = acc.clicks === 1 && acc.spend >= cpcHigh;
    const ctrIsHighZeroConversions =
      acc.conversions === 0 && acc.ctr > ctrHigh && acc.spend > ctrHighSpend;

    // If it's a severe issue
    const isFire =
      (acc.spend > criticalSpend && acc.conversions <= criticalConversions) ||
      isAnomaly ||
      cpcIsHigh ||
      ctrIsHighZeroConversions;

    if (isFire) {
      alerts.push({
        accountName: acc.name,
        spend: acc.spend,
        conversions: acc.conversions,
        ctr: acc.ctr,
        cpc: acc.cpc,
        baselineSpend: acc.baseline.dailyAvgSpend,
        baselineConversions: acc.baseline.dailyAvgConversions,
        changeSpendPct:
          acc.baseline.dailyAvgSpend > 0 ? changeSpendPct : undefined,
        changeConversionsPct:
          acc.baseline.dailyAvgConversions > 0
            ? changeConversionsPct
            : undefined,
        isAnomaly,
        cpcIsHigh,
        ctrIsHighZeroConversions,
      });
    } else {
      // Success Check (only if not flagged warning/critical elsewhere)
      const isSuccess =
        acc.conversions > 0 &&
        ((targetCpaVal && acc.cpa <= targetCpaVal) ||
          (!targetCpaVal && acc.cpa < 150) || // reasonable agency baseline
          isWhale);

      if (isSuccess) {
        successes.push({
          accountName: acc.name,
          cpa: acc.cpa,
          notes: isWhale
            ? "Still the portfolio anchor. Healthy CPA, strong volume. No action needed."
            : undefined,
        });
      } else if (acc.conversions === 0 && acc.spend > 0) {
        zeroConversionNoAlerts.push({
          accountName: acc.name,
          spend: acc.spend,
          clicks: acc.clicks,
          cpc: acc.cpc,
        });
      }
    }
  }

  return {
    success: true,
    data: {
      todayDayOfWeek: getMelbourneDateStrings().todayFormatted.split(" ")[0],
      todayDateStr: getMelbourneDateStrings()
        .todayFormatted.split(" ")
        .slice(1)
        .join(" "),
      yesterdayDayOfWeek: yesterdayFormatted.split(" ")[0],
      yesterdayDateStr: yesterdayFormatted.split(" ").slice(1).join(" "),
      totals: {
        spend: totalSpend,
        conversions: totalConversions,
        cpa: totalConversions > 0 ? totalSpend / totalConversions : 0,
        activeAccounts: activeAccountsCount,
      },
      whaleAnalysis: {
        whaleName,
        spendSharePct,
        whaleSpend,
        longTailCpa,
        hasWhale,
      },
      alerts,
      zeroConversionNoAlerts,
      successes,
    },
  };
}

export async function generateBriefingAction() {
  const dataRes = await getBriefingDataAction();
  if (!dataRes.success || !dataRes.data) {
    return {
      success: false,
      error: dataRes.error || "Failed to aggregate performance data.",
    };
  }

  // Load settings to respect dataPoints toggles
  const settingsRes = await getBriefingSettingsAction();
  const dataPoints =
    settingsRes.success && settingsRes.data
      ? settingsRes.data.dataPoints
      : undefined;

  try {
    const briefing = await generateMorningBriefingText({
      ...(dataRes.data as any),
      dataPoints,
    });
    return { success: true, briefing };
  } catch (error: any) {
    console.error("Failed to generate briefing via AI:", error);
    return { success: false, error: error.message };
  }
}

export async function sendMorningBriefingAction() {
  let emails: string[] = [];
  let subject = "☀️ Morning Briefing";
  try {
    // 1. Fetch settings & briefing data
    const settingsRes = await getBriefingSettingsAction();
    const settings =
      settingsRes.success && settingsRes.data ? settingsRes.data : null;

    const dataRes = await getBriefingDataAction();
    if (!dataRes.success || !dataRes.data) {
      throw new Error(dataRes.error || "Failed to aggregate briefing data.");
    }

    const genRes = await generateBriefingAction();
    if (!genRes.success || !genRes.briefing) {
      throw new Error(genRes.error || "Failed to generate briefing content.");
    }

    const briefing = genRes.briefing;
    subject =
      briefing.subject ||
      `☀️ Morning Briefing — ${dataRes.data.todayDayOfWeek} ${dataRes.data.todayDateStr}`;

    // 2. Fetch recipients (fallback to all team members if empty)
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
      throw new Error("No recipients configured for morning briefing.");
    }

    // 3. Compile HTML and Text briefing bodies
    const dateStr = `${dataRes.data.todayDayOfWeek} ${dataRes.data.todayDateStr}`;
    const htmlBody = buildHtmlBriefing(briefing, dataRes.data.totals, dateStr);
    const textBody = buildTextBriefing(briefing, dataRes.data.totals, dateStr);

    // 4. Dispatch emails via Resend
    console.log(`Sending Morning Briefing email to: ${emails.join(", ")}`);

    const emailResult = await resend.emails.send({
      from: "Uprise Digital <reports@uprisedigital.com.au>",
      to: emails,
      subject: subject,
      text: await textBody,
      html: await htmlBody,
    });

    if (emailResult.error) {
      await logEmail({
        recipient: emails.join(", "),
        subject: subject,
        emailType: "morning_briefing",
        status: "failed",
        error: emailResult.error.message,
      });
      throw new Error(`Resend Error: ${emailResult.error.message}`);
    }

    await logEmail({
      recipient: emails.join(", "),
      subject: subject,
      emailType: "morning_briefing",
      status: "success",
      resendId: emailResult.data?.id,
    });

    // 5. Log the audit action
    await logAction(SYSTEM_ACTOR, "DAILY_BRIEFING_SENT", "user", SYSTEM_ACTOR, {
      subject,
      recipients: emails,
      status: "SUCCESS",
    });

    return {
      success: true,
      message: `Morning Briefing sent to ${emails.length} team members.`,
    };
  } catch (error: any) {
    console.error("Failed to send morning briefing:", error);

    try {
      const recipientList =
        typeof emails !== "undefined" && emails && emails.length > 0
          ? emails.join(", ")
          : "reports@uprisedigital.com.au (fallback)";
      const subjectText =
        typeof subject !== "undefined" && subject
          ? subject
          : "☀️ Morning Briefing";

      await logEmail({
        recipient: recipientList,
        subject: subjectText,
        emailType: "morning_briefing",
        status: "failed",
        error:
          error.message || "Unknown error during morning briefing dispatch",
      });
    } catch (logErr) {
      console.error("Failed to write briefing failure to emailLogs:", logErr);
    }

    await logAction(
      SYSTEM_ACTOR,
      "DAILY_BRIEFING_FAILED",
      "user",
      SYSTEM_ACTOR,
      { error: error.message, status: "FAILURE" },
    );

    return { success: false, error: error.message };
  }
}

// Helper function to build a styled HTML email using responsive inline CSS
export async function buildHtmlBriefing(
  briefing: any,
  totals: any,
  dateStr: string,
) {
  const logoUrl =
    "https://uprise-tools-production.up.railway.app/logo_white.png";

  const alertsHtml =
    briefing.alerts && briefing.alerts.length > 0
      ? briefing.alerts
          .map((alert: any) => {
            const borderColor = alert.isCritical ? "#ef4444" : "#f59e0b";
            const badgeBg = alert.isCritical ? "#fee2e2" : "#fef3c7";
            const badgeColor = alert.isCritical ? "#991b1b" : "#92400e";
            const badgeLabel = alert.isCritical ? "CRITICAL ALERT" : "WARNING";

            return `
                <div style="background-color: #ffffff; border-left: 4px solid ${borderColor}; border-top: 1px solid #f1f5f9; border-right: 1px solid #f1f5f9; border-bottom: 1px solid #f1f5f9; border-radius: 0 8px 8px 0; padding: 16px; margin-bottom: 16px; box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);">
                    <div style="display: inline-block; background-color: ${badgeBg}; color: ${badgeColor}; font-size: 10px; font-weight: 700; text-transform: uppercase; padding: 2px 8px; border-radius: 4px; margin-bottom: 8px; letter-spacing: 0.05em;">
                        ${badgeLabel}
                    </div>
                    <div style="font-size: 15px; font-weight: 700; color: #0f172a; margin-bottom: 4px;">
                        ${alert.accountName}
                    </div>
                    <div style="font-size: 12px; font-weight: 600; color: #475569; margin-bottom: 8px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; background-color: #f8fafc; padding: 4px 8px; border-radius: 4px; display: inline-block;">
                        ${alert.statsText}
                    </div>
                    <div style="font-size: 13px; line-height: 1.5; color: #334155;">${alert.details.trim()}</div>
                </div>
            `;
          })
          .join("")
      : `<div style="text-align: center; padding: 24px; color: #64748b; font-size: 14px; background-color: #f8fafc; border-radius: 8px; border: 1px dashed #e2e8f0;">
             🎉 No anomalies or performance flags detected for yesterday.
           </div>`;

  const successesHtml =
    briefing.successes && briefing.successes.length > 0
      ? briefing.successes
          .map((success: any) => {
            return `
                <div style="background-color: #ffffff; border-left: 4px solid #10b981; border-top: 1px solid #f1f5f9; border-right: 1px solid #f1f5f9; border-bottom: 1px solid #f1f5f9; border-radius: 0 8px 8px 0; padding: 16px; margin-bottom: 16px; box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);">
                    <div style="display: inline-block; background-color: #d1fae5; color: #065f46; font-size: 10px; font-weight: 700; text-transform: uppercase; padding: 2px 8px; border-radius: 4px; margin-bottom: 8px; letter-spacing: 0.05em;">
                        SUCCESS
                    </div>
                    <div style="font-size: 15px; font-weight: 700; color: #0f172a; margin-bottom: 4px;">
                        ${success.accountName}
                    </div>
                    <div style="font-size: 12px; font-weight: 600; color: #047857; margin-bottom: 8px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; background-color: #ecfdf5; padding: 4px 8px; border-radius: 4px; display: inline-block;">
                        ${success.statsText}
                    </div>
                    <div style="font-size: 13px; line-height: 1.5; color: #334155;">${success.details.trim()}</div>
                </div>
            `;
          })
          .join("")
      : "";

  const whaleHtml = briefing.whaleAnalysisCommentary
    ? `
            <div style="background-color: #f5f3ff; border: 1px solid #ddd6fe; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
                <div style="font-size: 11px; font-weight: 700; color: #6d28d9; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.05em;">
                    🐳 Whale Account Impact
                </div>
                <div style="font-size: 13px; line-height: 1.5; color: #4c1d95;">${briefing.whaleAnalysisCommentary.trim()}</div>
            </div>
        `
    : "";

  const priorityHtml =
    briefing.priorityList && briefing.priorityList.length > 0
      ? `
            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px 18px 8px 18px; margin-bottom: 24px;">
                <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #475569; margin-bottom: 16px;">
                    📋 strategist priority list
                </div>
                <div style="margin: 0; padding: 0;">
                    ${briefing.priorityList
                      .map(
                        (p: string) => `
                        <table style="width: 100%; margin-bottom: 10px; border-collapse: collapse;" cellpadding="0" cellspacing="0">
                            <tr>
                                <td style="vertical-align: top; width: 24px; font-size: 14px; color: #4f46e5; font-weight: bold; line-height: 1.5;">☐</td>
                                <td style="vertical-align: top; font-size: 13px; color: #1e293b; line-height: 1.5;">${p.trim()}</td>
                            </tr>
                        </table>`,
                      )
                      .join("")}
                </div>
            </div>
        `
      : "";

  const footnoteHtml = briefing.zeroConversionFootnote
    ? `
            <div style="font-size: 11px; color: #64748b; line-height: 1.5; font-style: italic; border-top: 1px solid #f1f5f9; padding-top: 12px; margin-top: 24px;">
                ${briefing.zeroConversionFootnote}
            </div>
        `
    : "";

  return `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${briefing.subject}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; padding: 24px 16px; margin: 0; color: #1e293b; -webkit-font-smoothing: antialiased;">
    <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);">
        
        <!-- HEADER -->
        <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 32px 24px; text-align: center; color: #ffffff; border-bottom: 4px solid #3b82f6;">
            <img src="${logoUrl}" alt="Uprise Digital" style="max-height: 40px; margin-bottom: 12px; display: inline-block;" />
            <h1 style="font-size: 20px; font-weight: 700; margin: 0; letter-spacing: -0.025em; line-height: 1.2; color: #ffffff;">
                ☀️ Morning Briefing
            </h1>
            <p style="font-size: 13px; margin: 6px 0 0 0; opacity: 0.8; font-weight: 500; letter-spacing: 0.025em; text-transform: uppercase;">
                ${dateStr}
            </p>
        </div>

        <!-- MAIN CONTENT -->
        <div style="padding: 24px;">
            
            <!-- MACRO SUMMARY -->
            <div style="font-size: 15px; line-height: 1.6; color: #334155; margin-bottom: 24px; font-weight: 500;">${briefing.macroSummary.trim()}</div>

            <!-- PORTFOLIO TOTALS -->
            <div style="margin-bottom: 24px;">
                <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin-bottom: 8px; border-bottom: 1px solid #f1f5f9; padding-bottom: 6px;">
                    📊 Yesterday's Portfolio Performance
                </div>
                <table style="width: 100%; border-collapse: separate; border-spacing: 8px 8px; margin: 0 -8px;">
                    <tr>
                        <td style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; text-align: center; width: 50%;">
                            <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 0.05em;">Total Spend</div>
                            <div style="font-size: 14px; font-weight: 700; color: #0f172a; margin-top: 4px; white-space: nowrap;">AUD $${totals.spend.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                        </td>
                        <td style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; text-align: center; width: 50%;">
                            <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 0.05em;">Conversions</div>
                            <div style="font-size: 14px; font-weight: 700; color: #0f172a; margin-top: 4px;">${totals.conversions}</div>
                        </td>
                    </tr>
                    <tr>
                        <td style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; text-align: center; width: 50%;">
                            <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 0.05em;">Blended CPA</div>
                            <div style="font-size: 14px; font-weight: 700; color: #0f172a; margin-top: 4px; white-space: nowrap;">AUD $${totals.cpa.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                        </td>
                        <td style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; text-align: center; width: 50%;">
                            <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 0.05em;">Active Accounts</div>
                            <div style="font-size: 14px; font-weight: 700; color: #0f172a; margin-top: 4px;">${totals.activeAccounts}</div>
                        </td>
                    </tr>
                </table>
            </div>

            <!-- WHALE ANALYSIS -->
            ${whaleHtml}

            <!-- ALERTS -->
            <div style="margin-bottom: 24px;">
                <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin-bottom: 12px; border-bottom: 1px solid #f1f5f9; padding-bottom: 6px;">
                    🚨 What Needs Attention Today
                </div>
                ${alertsHtml}
            </div>

            <!-- SUCCESSES -->
            ${
              successesHtml
                ? `
            <div style="margin-bottom: 24px;">
                <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin-bottom: 12px; border-bottom: 1px solid #f1f5f9; padding-bottom: 6px;">
                    ✨ Notable Performance Successes
                </div>
                ${successesHtml}
            </div>
            `
                : ""
            }

            <!-- PRIORITY CHECKLIST -->
            ${priorityHtml}

            <!-- ZERO CONVERSION FOOTNOTE -->
            ${footnoteHtml}

        </div>

        <!-- FOOTER -->
        <div style="text-align: center; padding: 24px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 11px; color: #64748b; line-height: 1.6;">
            <p style="margin: 0 0 8px 0; font-weight: 600; color: #475569;">
                Uprise Tools Daily Briefing Service
            </p>
            <p style="margin: 0 0 12px 0;">
                This email is an automated performance digest sent to configured team members.
            </p>
            <div style="margin: 0; padding: 10px; background-color: #f1f5f9; border-radius: 6px; display: inline-block; color: #334155; font-weight: 500;">
                ✉️ Queries or issues? Contact the Data Engineer: 
                <a href="mailto:seyone@uprisedigital.com.au" style="color: #4f46e5; text-decoration: none; font-weight: 700;">seyone@uprisedigital.com.au</a>
            </div>
        </div>

    </div>
</body>
</html>`;
}

// Helper function to build a clean plain text version
export async function buildTextBriefing(
  briefing: any,
  totals: any,
  dateStr: string,
) {
  const lines: string[] = [];

  lines.push(`☀️ Morning Briefing — ${dateStr}`);
  lines.push(`======================================`);
  lines.push(briefing.macroSummary || "");
  lines.push("");

  lines.push(`PORTFOLIO TOTALS (YESTERDAY)`);
  lines.push(`--------------------------------------`);
  lines.push(`Total Spend:        AUD $${totals.spend.toFixed(2)}`);
  lines.push(`Total Conversions:  ${totals.conversions}`);
  lines.push(`Blended CPA:        AUD $${totals.cpa.toFixed(2)}`);
  lines.push(`Active Accounts:    ${totals.activeAccounts}`);
  lines.push("");

  if (briefing.whaleAnalysisCommentary) {
    lines.push(`PORTFOLIO WHALE ANALYSIS`);
    lines.push(`--------------------------------------`);
    lines.push(briefing.whaleAnalysisCommentary);
    lines.push("");
  }

  if (briefing.alerts && briefing.alerts.length > 0) {
    lines.push(`🔴 WHAT NEEDS YOUR ATTENTION TODAY`);
    lines.push(`--------------------------------------`);
    for (const alert of briefing.alerts) {
      const prefix = alert.isCritical ? "🚨" : "⚠️";
      lines.push(`${prefix} ${alert.accountName}`);
      lines.push(`Stats: ${alert.statsText}`);
      lines.push(`Note:  ${alert.details}`);
      lines.push("");
    }
  }

  if (briefing.successes && briefing.successes.length > 0) {
    lines.push(`🟢 NOTABLE SUCCESSES`);
    lines.push(`--------------------------------------`);
    for (const success of briefing.successes) {
      lines.push(`✨ ${success.accountName}`);
      lines.push(`Stats: ${success.statsText}`);
      lines.push(`Note:  ${success.details}`);
      lines.push("");
    }
  }

  if (briefing.priorityList && briefing.priorityList.length > 0) {
    lines.push(`📋 STRATEGIST CHECKLIST`);
    lines.push(`--------------------------------------`);
    for (const p of briefing.priorityList) {
      lines.push(`[ ] ${p}`);
    }
    lines.push("");
  }

  if (briefing.zeroConversionFootnote) {
    lines.push(briefing.zeroConversionFootnote);
    lines.push("");
  }

  lines.push(`======================================`);
  lines.push(
    `Queries and issues are to be directed to the data engineer (seyone@uprisedigital.com.au).`,
  );
  lines.push(`Uprise Tools Morning Briefing Service`);

  return lines.join("\n");
}
