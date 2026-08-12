import { GEMINI_MODEL_LOW } from "@/lib/ai-config";
import { generateContentTracked } from "@/lib/ai-logger";

/**
 * USE CASE 1: PDF CONTENT
 * Generates the formal Executive Summary and Next Steps for the PDF document.
 */
export async function generateReportInsights(data: any) {
  const { clientName, metrics, keywords, customInstructions } = data;

  const prompt = `
    You are a Senior Google Ads Strategist at Uprise Digital. 
    Analyze these performance metrics for the client report of "${clientName}":
    
    - Spend: $${metrics.cost}
    - Conversions: ${metrics.conversions} (${metrics.conversionsDelta?.isPos ? "+" : "-"}${metrics.conversionsDelta?.val || "0"}%)
    - CPA: $${metrics.costPerConv}
    - Clicks: ${metrics.clicks}
    - CTR: ${metrics.ctr}%
    - Top Keywords: ${keywords
      .slice(0, 5)
      .map((k: any) => k.text)
      .join(", ")}
    
    ${customInstructions ? `SPECIAL CLIENT INSTRUCTIONS: ${customInstructions}` : ""}
    
    CRITICAL AGENCY TONE & SANITIZATION RULES:
    1. NEVER use negative or alarming language (do NOT use words like "zero conversions", "no leads", "failed", "poor", "loss", "dropped", "screwed up").
    2. SILVER LINING REFRAMING:
       - If conversions are low/zero: Frame as "Initial audience signal acquisition phase", "Building brand authority & search footprint", or "Testing high-intent search clusters to establish baseline benchmarks".
       - If spend or CPC increased: Frame as "Strategic market share expansion" or "Securing premium position across competitive search auctions".
       - If CTR or clicks dropped: Frame as "Refining targeting to eliminate unqualified clicks & maximize impression quality".
    3. Be executive, encouraging, authoritative, and focused on strategic optimization.

    REQUIRED RESPONSE FORMAT (JSON Object):
    {
      "summary": "A 3-sentence executive summary emphasizing campaign momentum, strategic positioning, and budget deployment.",
      "takeaways": [
        "First key strategic achievement or optimization focus",
        "Second key strategic achievement or optimization focus",
        "Third key strategic achievement or optimization focus"
      ],
      "actionPlan": [
        {
          "title": "Bidding & Auction Optimization",
          "description": "One sentence on refining bid strategies to capture high-converting search intent."
        },
        {
          "title": "Search Term & Keyword Expansion",
          "description": "One sentence on pruning negative keywords and scaling top-performing terms."
        },
        {
          "title": "Conversion Path & Audience Tuning",
          "description": "One sentence on streamlining ad messaging and landing page conversion flow."
        }
      ],
      "statusPill": "AUDIENCE & INTENT BUILD" // 2-4 word uppercase status e.g. "OPTIMIZATION & EXPANSION" or "AUDIENCE BUILD PHASE"
    }
  `;

  try {
    const result = await generateContentTracked(
      {
        model: GEMINI_MODEL_LOW,
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
        "Campaign activity this period focused on establishing core search visibility and capturing high-intent audience traffic. We are actively leveraging these performance baseline metrics to fine-tune keyword targeting and maximize overall campaign efficiency.",
      takeaways: [
        "Established baseline search visibility across core industry keywords.",
        "Refined keyword bid structures to prioritize high-intent audience searches.",
        "Streamlined ad copy alignment to improve impression relevancy and click quality.",
      ],
      actionPlan: [
        {
          title: "Bidding & Auction Realignment",
          description:
            "Reallocate budget toward top-performing search auctions to lower acquisition costs.",
        },
        {
          title: "High-Intent Keyword Expansion",
          description:
            "Expand exact-match keyword clusters while sculpting negative keywords to eliminate non-converting queries.",
        },
        {
          title: "Conversion Path Optimization",
          description:
            "Align ad copy messaging directly with landing page CTAs to enhance conversion rates.",
        },
      ],
      statusPill: "OPTIMIZATION & EXPANSION",
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
    Write a short, professional, and encouraging email intro for "${clientName}" to accompany their monthly Google Ads performance report PDF.
    
    Metrics Context:
    - Conversions: ${metrics.conversions}
    - Spend: $${metrics.cost}
    - Clicks: ${metrics.clicks}
    
    ${customInstructions ? `TONE/FOCUS INSTRUCTIONS: ${customInstructions}` : ""}
    
    CRITICAL TONE RULES:
    - NEVER state negative outcomes or failures (do NOT say "we didn't get conversions", "no leads", "CTR dropped", etc.).
    - ALWAYS reframe positively: focus on campaign momentum, valuable search data collected, brand presence established, and ongoing strategic optimizations.
    - Keep it strictly to 2-3 sentences.
    - Mention that the full performance breakdown PDF is attached.
    - Do NOT include a subject line, greeting (like Hi Paul), or sign-off (like Best regards), just the body text paragraph.
    
    Response MUST be a JSON object: { "emailBody": "..." }
    `;

  try {
    const result = await generateContentTracked(
      {
        model: GEMINI_MODEL_LOW,
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
      emailBody: `I've attached your latest Google Ads performance report for the past month. Our team has been actively optimizing search term targeting and campaign structures to build strong momentum and capture high-intent demand. Please find the detailed metrics breakdown in the attached PDF.`,
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
        model: GEMINI_MODEL_LOW,
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
