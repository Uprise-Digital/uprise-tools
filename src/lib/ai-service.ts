import { generateContentTracked } from "@/lib/ai-logger";

/**
 * USE CASE 1: PDF CONTENT
 * Generates the formal Executive Summary and Next Steps for the PDF document.
 */
export async function generateReportInsights(data: any) {
  const { clientName, metrics, keywords, customInstructions } = data;

  const prompt = `
    You are a Senior Google Ads Strategist at Uprise Digital. 
    Analyze these metrics for the PDF report of "${clientName}":
    
    - Spend: $${metrics.cost}
    - Conversions: ${metrics.conversions} (${metrics.conversionsDelta.isPos ? "+" : "-"}${metrics.conversionsDelta.val}%)
    - CPA: $${metrics.costPerConv}
    - Top Keywords: ${keywords
      .slice(0, 5)
      .map((k: any) => k.text)
      .join(", ")}
    
    ${customInstructions ? `SPECIAL CLIENT INSTRUCTIONS: ${customInstructions}` : ""}
    
    TASK:
    1. Write a 3-sentence Executive Summary. If metrics are negative, maintain a positive, professional outlook focused on optimization.
    2. Write a 2-sentence "Looking Ahead" strategy.
    
    Response MUST be a JSON object: { "summary": "...", "nextSteps": "..." }
    `;

  try {
    const result = await generateContentTracked(
      {
        model: "gemini-2.5-flash",
        contents: prompt,
        config: { responseMimeType: "application/json" },
      },
      {
        organizationId: data.organizationId,
        userId: data.userId,
        feature: "pdf_report_insights",
      },
    );
    return JSON.parse(result.response.text as string);
  } catch (error) {
    console.error("PDF Insights Error:", error);
    return {
      summary:
        "Performance remains consistent with a focus on conversion efficiency.",
      nextSteps:
        "We will continue monitoring high-intent search terms for budget optimization.",
    };
  }
}

/**
 * USE CASE 2: EMAIL DELIVERY
 * Generates a friendly, high-level email body to accompany the PDF attachment.
 */
export async function generateEmailBody(data: any) {
  const { clientName, metrics, customInstructions } = data;

  const prompt = `
    You are an Account Manager at Uprise Digital. 
    Write a short, friendly email to "${clientName}" as an intro to their monthly Google Ads report.
    
    Metrics Context:
    - Conversions: ${metrics.conversions} (${metrics.conversionsDelta.isPos ? "up" : "down"} ${metrics.conversionsDelta.val}%)
    - Spend: $${metrics.cost}
    
    ${customInstructions ? `TONE/FOCUS INSTRUCTIONS: ${customInstructions}` : ""}
    
    TASK:
    - Keep it under 4 sentences.
    - Mention that the full report is attached.
    - Be encouraging and helpful.
    - Do not use a subject line or sign-off, just the body text.
    
    Response MUST be a JSON object: { "emailBody": "..." }
    `;

  try {
    const result = await generateContentTracked(
      {
        model: "gemini-2.5-flash",
        contents: prompt,
        config: { responseMimeType: "application/json" },
      },
      {
        organizationId: data.organizationId,
        userId: data.userId,
        feature: "email_body_generation",
      },
    );
    return JSON.parse(result.response.text as string);
  } catch (error) {
    console.error("Email Body Error:", error);
    return {
      emailBody: `Hi there, please find your latest Google Ads performance report attached. We've seen some interesting shifts this month and look forward to discussing the next steps with you.`,
    };
  }
}

/**
 * USE CASE 3: DAILY MORNING BRIEFING
 * Generates the Morning Briefing email text data based on yesterday's portfolio performance and baseline data.
 */
export async function generateMorningBriefingText(data: {
  todayDayOfWeek: string;
  todayDateStr: string;
  yesterdayDayOfWeek: string;
  yesterdayDateStr: string;
  totals: {
    spend: number;
    conversions: number;
    cpa: number;
    activeAccounts: number;
  };
  whaleAnalysis: {
    whaleName: string;
    spendSharePct: number;
    whaleSpend: number;
    longTailCpa: number;
    hasWhale: boolean;
  };
  alerts: Array<{
    accountName: string;
    spend: number;
    conversions: number;
    ctr: number;
    cpc: number;
    baselineSpend?: number;
    baselineConversions?: number;
    changeSpendPct?: number;
    changeConversionsPct?: number;
    isAnomaly: boolean;
    cpcIsHigh: boolean;
    ctrIsHighZeroConversions: boolean;
    notes?: string;
  }>;
  zeroConversionNoAlerts: Array<{
    accountName: string;
    spend: number;
    clicks: number;
    cpc: number;
  }>;
  successes: Array<{
    accountName: string;
    cpa: number;
    notes?: string;
  }>;
  dataPoints?: {
    spend: boolean;
    conversions: boolean;
    cpa: boolean;
    clicks: boolean;
    impressions: boolean;
    ctr: boolean;
    cpc: boolean;
    anomalies: boolean;
    whaleAnalysis: boolean;
  };
  organizationId?: string;
  userId?: string | null;
}) {
  const prompt = `
    You are the Strategy Director at Uprise Digital.
    Analyze yesterday's Google Ads performance data and return a structured briefing.
    
    DATA POINTS INCLUSION SETTINGS (CRITICAL CONSTRAINTS):
    If any setting below is false, do NOT output or mention that metric or section anywhere in the response.
    - Spend: ${data.dataPoints?.spend !== false}
    - Conversions: ${data.dataPoints?.conversions !== false}
    - CPA: ${data.dataPoints?.cpa !== false}
    - Clicks: ${data.dataPoints?.clicks !== false}
    - Impressions/CTR: ${data.dataPoints?.ctr !== false}
    - CPC: ${data.dataPoints?.cpc !== false}
    - Anomaly/Attention Section: ${data.dataPoints?.anomalies !== false}
    - Whale Analysis: ${data.dataPoints?.whaleAnalysis !== false}
    
    YESTERDAY CONTEXT:
    - Today: ${data.todayDayOfWeek} ${data.todayDateStr}
    - Yesterday: ${data.yesterdayDayOfWeek} ${data.yesterdayDateStr}
    
    PORTFOLIO TOTALS:
    - Total Spend: AUD $${data.totals.spend.toFixed(2)}
    - Total Conversions: ${data.totals.conversions}
    - Blended CPA: AUD $${data.totals.cpa.toFixed(2)}
    - Active Accounts: ${data.totals.activeAccounts}
    
    WHALE ACCOUNT ANALYSIS:
    ${
      data.whaleAnalysis.hasWhale
        ? `- Whale Account: "${data.whaleAnalysis.whaleName}" accounted for ${data.whaleAnalysis.spendSharePct.toFixed(1)}% of all spend yesterday.
       - Blended CPA without this Whale (Long-Tail CPA): AUD $${data.whaleAnalysis.longTailCpa.toFixed(2)}`
        : "No single account dominated spend yesterday (>25% share)."
    }
      
    ALERTS & CRITICAL FIRES:
    ${JSON.stringify(data.alerts, null, 2)}
    
    OTHER ACCOUNTS WITH SPEND BUT ZERO CONVERSIONS:
    ${JSON.stringify(data.zeroConversionNoAlerts, null, 2)}
    
    SUCCESSES & WHAT'S WORKING:
    ${JSON.stringify(data.successes, null, 2)}
    
    TASK:
    Analyze the data and construct a professional, glanceable morning briefing.
    Response MUST be a JSON object matching this exact TypeScript interface:
    interface BriefingResponse {
        subject: string;                  // e.g., "☀️ Morning Briefing — Thursday 26 June 2026"
        macroSummary: string;             // A 1-2 sentence high-level summary of the day's portfolio activity.
        whaleAnalysisCommentary: string;  // Detailed whale analysis commentary. If whaleAnalysis dataPoint is false, leave as empty string.
        alerts: Array<{
            accountName: string;
            isCritical: boolean;          // true for major alert (🚨), false for minor alert (⚠️)
            statsText: string;            // e.g., "Yesterday: AUD $122.19 spent | 0 conversions | Spend down 36%"
            details: string;              // Detailed data-backed strategist explanation of what happened.
        }>;
        zeroConversionFootnote: string;  // List of other accounts that spent money but didn't convert (e.g. "Also spent yesterday with zero conversions: LNM Furniture Removals ($66.52)...")
        successes: Array<{
            accountName: string;
            statsText: string;            // e.g., "CPA of AUD $29.49" or "10 conversions"
            details: string;              // Brief commentary on why this account is succeeding or how to scale.
        }>;
        priorityList: string[];           // A list of 3-5 specific, actionable checklist priorities (e.g., ["Response Plumbing Melbourne — investigate...", "Anytime Emergency Plumbers — pause..."])
    }

    CONSTRAINTS:
    - Base all analysis strictly on the provided JSON figures.
    - Write short, insight-driven marketing commentary matching a senior Performance Director tone.
    - If dataPoints.anomalies is false, return an empty array for alerts.
    - Ensure all monetary figures inside text strings are formatted with AUD prefix (e.g. "AUD $122.19").
    `;

  try {
    const result = await generateContentTracked(
      {
        model: "gemini-2.5-flash",
        contents: prompt,
        config: { responseMimeType: "application/json" },
      },
      {
        organizationId: data.organizationId,
        userId: data.userId,
        feature: "morning_briefing",
      },
    );
    return JSON.parse(result.response.text as string);
  } catch (error) {
    console.error("Morning Briefing Generation Error:", error);
    return {
      subject: `☀️ Morning Briefing — ${data.todayDayOfWeek} ${data.todayDateStr}`,
      macroSummary: `Overall spend: AUD $${data.totals.spend.toFixed(2)}, Conversions: ${data.totals.conversions}, Blended CPA: AUD $${data.totals.cpa.toFixed(2)}.`,
      whaleAnalysisCommentary: data.whaleAnalysis.hasWhale
        ? `${data.whaleAnalysis.whaleName} accounted for ${data.whaleAnalysis.spendSharePct.toFixed(1)}% of all spend.`
        : "",
      alerts: [],
      zeroConversionFootnote: "",
      successes: [],
      priorityList: ["Check the Uprise dashboard for today's tasks."],
    };
  }
}
