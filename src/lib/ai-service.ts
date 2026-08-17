import { GEMINI_MODEL_LOW } from "@/lib/ai-config";
import { generateContentTracked } from "@/lib/ai-logger";

/**
 * Robust JSON parser for AI generated responses.
 * Handles markdown code fences, unescaped newlines, and trailing text.
 */
function cleanAndParseJson<T>(rawText: string, fallback: T): T {
  if (!rawText) return fallback;
  try {
    let cleaned = rawText
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      cleaned = cleaned.substring(firstBrace, lastBrace + 1);
    }

    return JSON.parse(cleaned);
  } catch {
    try {
      let cleaned = rawText
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();
      const firstBrace = cleaned.indexOf("{");
      const lastBrace = cleaned.lastIndexOf("}");
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        cleaned = cleaned.substring(firstBrace, lastBrace + 1);
      }
      // Replace unescaped literal newlines within double quotes
      const sanitized = cleaned.replace(
        /"([^"\\]*(\\.[^"\\]*)*)"/g,
        (match) => {
          return match.replace(/\n/g, "\\n").replace(/\r/g, "\\r");
        },
      );
      return JSON.parse(sanitized);
    } catch (err2) {
      console.warn(
        "[cleanAndParseJson] Safe fallback used due to raw JSON parsing structure:",
        err2,
      );
      return fallback;
    }
  }
}

/**
 * USE CASE 1: PDF CONTENT
 * Generates the formal Executive Summary and Next Steps for the PDF document.
 */
export async function generateReportInsights(data: {
  clientName: string;
  metrics: any;
  keywords: any[];
  customInstructions?: string;
  organizationId?: string;
  userId?: string;
}) {
  const fallback = {
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

  const prompt = `
    You are a Senior Digital Marketing Strategist at Uprise Digital. Analyze the following Google Ads performance data for "${data.clientName}" and generate concise, professional strategic insights for their monthly performance report.
    
    Data:
    - Client: ${data.clientName}
    - Spend: $${data.metrics?.cost || "0.00"}
    - Conversions: ${data.metrics?.conversions || 0}
    - Clicks: ${data.metrics?.clicks || 0}
    - CTR: ${data.metrics?.ctr || 0}%
    - Top Keywords: ${(data.keywords || [])
      .slice(0, 5)
      .map((k: any) => `${k.text} (${k.conversions || 0} conv)`)
      .join(", ")}
    
    ${data.customInstructions ? `SPECIAL INSTRUCTIONS: ${data.customInstructions}` : ""}
    
    CRITICAL TONE & LANGUAGE RULES:
    - ALWAYS write in UK English spelling and grammar (e.g. optimise, prioritise, programme, behaviour, colour, lead generation, organisation, analyse).
    - NEVER state negative outcomes or failures (do NOT say "conversions dropped", "0 leads", "CTR decreased", "failed", etc.).
    - ALWAYS reframe positively: focus on establishing brand visibility, gathering conversion intelligence, keyword pruning, and strategic scaling.
    - Write with confidence, expertise, and clarity.
    
    Response MUST be valid JSON with this exact schema:
    {
      "summary": "2-3 sentences summarizing performance, highlight data capture and auction positioning.",
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
      "statusPill": "AUDIENCE & INTENT BUILD"
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
    return cleanAndParseJson(result.response.text as string, fallback);
  } catch (error) {
    console.error("PDF Insights Error:", error);
    return fallback;
  }
}

/**
 * USE CASE 2: EMAIL DELIVERY
 * Generates a friendly, high-level email body to accompany the PDF attachment.
 */
export async function generateEmailBody(data: any) {
  const { clientName, metrics, customInstructions } = data;

  const fallback = {
    emailBody: `I've attached your latest Google Ads performance report for the past month. Our team has been actively optimizing search term targeting and campaign structures to build strong momentum and capture high-intent demand. Please find the detailed metrics breakdown in the attached PDF.`,
  };

  const prompt = `
    You are an Account Manager at Uprise Digital. 
    Write a short, professional, and encouraging email intro for "${clientName}" to accompany their monthly Google Ads performance report PDF.
    
    Metrics Context:
    - Conversions: ${metrics?.conversions || 0}
    - Spend: $${metrics?.cost || "0.00"}
    - Clicks: ${metrics?.clicks || 0}
    
    ${customInstructions ? `TONE/FOCUS INSTRUCTIONS: ${customInstructions}` : ""}
    
    CRITICAL TONE & LANGUAGE RULES:
    - ALWAYS write in UK English spelling and grammar (e.g. optimise, prioritise, programme, behaviour, colour, lead generation, organisation, analyse).
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
    return cleanAndParseJson(result.response.text as string, fallback);
  } catch (error) {
    console.error("Email Body Error:", error);
    return fallback;
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
    type: string;
    details: string;
  }>;
  zeroConversionAccountsCount: number;
  successes: Array<{
    accountName: string;
    details: string;
  }>;
  organizationId?: string;
  userId?: string;
}) {
  const fallback = {
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

  const prompt = `
    You are an executive AI Operations Analyst for Uprise Digital agency.
    Synthesize yesterday's portfolio metrics into an executive morning briefing email for agency leadership using UK English spelling and grammar (e.g. optimise, prioritise, programme, behaviour, colour, analyse).

    CONTEXT DATA:
    - Report Date: ${data.todayDayOfWeek}, ${data.todayDateStr} (analyzing ${data.yesterdayDayOfWeek}, ${data.yesterdayDateStr})
    - Active Client Accounts: ${data.totals.activeAccounts}
    - Total Spend: $${data.totals.spend.toFixed(2)}
    - Total Conversions: ${data.totals.conversions}
    - Portfolio CPA: $${data.totals.cpa.toFixed(2)}

    WHALE ACCOUNT DYNAMICS:
    ${
      data.whaleAnalysis.hasWhale
        ? `- Dominant Account: "${data.whaleAnalysis.whaleName}" generated $${data.whaleAnalysis.whaleSpend.toFixed(2)} (${data.whaleAnalysis.spendSharePct.toFixed(1)}% of portfolio spend).
       - Long Tail Portfolio (Excluding Whale): Blended CPA of $${data.whaleAnalysis.longTailCpa.toFixed(2)}.`
        : `- Portfolio distribution: Balanced spend across client accounts.`
    }

    DETECTED ANOMALIES & ALERTS (${data.alerts.length}):
    ${
      data.alerts.length > 0
        ? data.alerts
            .map((a) => `- [${a.type}] ${a.accountName}: ${a.details}`)
            .join("\n")
        : "None (All accounts performing within expected variance parameters)."
    }

    ZERO CONVERSION ACCOUNTS: ${data.zeroConversionAccountsCount} accounts had spend yesterday with 0 recorded conversions.

    CELEBRATION HIGHLIGHTS (${data.successes.length}):
    ${
      data.successes.length > 0
        ? data.successes
            .map((s) => `- ${s.accountName}: ${s.details}`)
            .join("\n")
        : "None yesterday."
    }

    OUTPUT SCHEMA REQUIRED (JSON):
    {
      "subject": "☀️ Morning Briefing — ${data.todayDayOfWeek} ${data.todayDateStr}",
      "macroSummary": "2 sentences summarizing total spend, conversions, CPA, and overall health.",
      "whaleAnalysisCommentary": "1-2 insightful sentences explaining how the whale account impacted overall portfolio metrics vs long tail.",
      "alerts": [
        {
          "accountName": "Account Name",
          "isCritical": true,
          "statsText": "Spend: $120.00 | Conv: 0 | CPA: -$0",
          "details": "Brief 1-sentence explanation of anomaly."
        }
      ],
      "zeroConversionFootnote": "1 sentence contextualizing zero conversion accounts if >0, otherwise empty string.",
      "successes": [
        {
          "accountName": "Account Name",
          "statsText": "Spend: $250.00 | Conv: 4 | CPA: $62.50",
          "details": "Brief summary of win."
        }
      ],
      "priorityList": [
        "Actionable priority task 1 for account managers today",
        "Actionable priority task 2",
        "Actionable priority task 3"
      ]
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
        feature: "morning_briefing",
      },
    );
    return cleanAndParseJson(result.response.text as string, fallback);
  } catch (error) {
    console.error("Morning Briefing Generation Error:", error);
    return fallback;
  }
}
