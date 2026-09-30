import { eq } from "drizzle-orm";
import {
  getAccountAnomaliesAction,
  getAccountByNameAction,
  getAgencyPortfolioMetricsAction,
  getCampaignDetailsAction,
  getConcentrationReportAction,
  getHistoricalComparisonAction,
  getImpressionShareReportInternal,
  getSearchTermInsightsAction,
  listAccountsAction,
} from "@/actions/agency.actions";
import { getDashboardMetricsAction } from "@/actions/dashboard.actions";
import { withBypassTenantDb } from "@/db/db-helper";
import { adAccounts } from "@/db/schema";
import { GEMINI_MODEL_LOW } from "@/lib/ai-config";
import { generateContentTracked } from "@/lib/ai-logger";
import {
  getMelbourneDateStrings,
  getMelbourneTodayStr,
} from "@/lib/date-utils";

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
 * Generates Lakshane's 3-pillar executive email body matching Image 2 styling.
 * Covers: Overall Snapshot (actual spend/leads/CPL), What Worked Well, What Didn't & Why, Next Steps.
 * Strictly 0 target/benchmark mentions.
 */
export async function generateEmailBody(data: any) {
  const { clientName, metrics, customInstructions } = data;

  const rawCost = typeof metrics?.cost === "number" ? metrics.cost : parseFloat(metrics?.cost || "0");
  const cost = isNaN(rawCost) ? "0.00" : rawCost.toFixed(2);
  const convs = typeof metrics?.conversions === "number" ? Math.round(metrics.conversions) : parseInt(metrics?.conversions || "0", 10) || 0;
  const rawCpl = metrics?.costPerConv ? (typeof metrics.costPerConv === "number" ? metrics.costPerConv : parseFloat(metrics.costPerConv)) : (convs > 0 ? rawCost / convs : 0);
  const costPerConv = isNaN(rawCpl) ? "0.00" : rawCpl.toFixed(2);

  const fallback = {
    emailBody: `Google has tracked at $${costPerConv} CPL across $${cost} spend with ${convs} leads generated over the period.\n\nCore high-intent search terms converted steadily, while broad queries accounted for wasted spend that we are actively pruning.\n\nOver the next 30 days, we are tightening match types, adding negative keywords, and focusing budget on top-converting ad groups.`,
  };

  const prompt = `
    You are Lakshane Fonseka, Founder & Lead Digital Strategist at Uprise Digital.
    Write the body paragraphs for a monthly Google Ads client email report for "${clientName}".
    
    Follow Lakshane's exact executive reporting standard:
    1. Brutal Honesty & Candour: Never hide setbacks or use corporate marketing spin. State the actual numbers plainly. If CPL increased or conversions dipped, explain the operational or search query "why".
    2. The 3 Non-Negotiable Pillars (write exactly 3-4 short, punchy 1-2 sentence paragraphs separated by double newlines):
       - Overall snapshot: Actual spend ($${cost}), total conversions/leads (${convs}), and actual CPL ($${costPerConv}).
       - What worked well: High-intent converting search terms and strong engagement.
       - What didn't perform well & why: Non-converting queries, search term leakage, or wasted spend.
       - What happens next: Concrete tactical actions for the next 30 days (negative keyword pruning, match type adjustments, budget reallocation).
    3. Short, Punchy Paragraphs: Strictly 1-2 sentences per paragraph with generous breathing room. NEVER write walls of text.
    4. CRITICAL RULE - NEVER MENTION TARGETS OR BENCHMARKS:
       - DO NOT mention target CPL, target CPA, target lead counts, or industry benchmarks. Focus strictly on actual performance delivery.
    5. Language: Australian / UK English (optimise, prioritise, analysing, behaviour).
    6. DO NOT include greetings ("Hi Team"), signoffs ("KR", "Let me know..."), or signature blocks. Just the 3-4 body paragraphs separated by double newlines.
    
    ${customInstructions ? `SPECIAL INSTRUCTIONS / PROMPT INJECTION: ${customInstructions}` : ""}
    
    Response MUST be valid JSON:
    {
      "emailBody": "Paragraph 1\\n\\nParagraph 2\\n\\nParagraph 3\\n\\nParagraph 4"
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
        feature: "email_body_generation",
      },
    );
    const parsed = cleanAndParseJson<{ emailBody?: string }>(result.response.text as string, fallback);
    let cleaned = (parsed.emailBody || fallback.emailBody)
      .replace(/^Hi\s+[^\n,]+[,.]?\s*/i, "")
      .replace(/Let\s+me\s+know\s+if\s+you\s+have\s+any\s+questions[\s\S]*$/i, "")
      .replace(/KR[\s\S]*$/i, "")
      .trim();

    return { emailBody: cleaned || fallback.emailBody };
  } catch (error) {
    console.error("Email Body Error:", error);
    return fallback;
  }
}

export interface ExecutiveBriefingParams {
  clientName: string;
  recipientName?: string;
  periodLabel?: string;
  googleData?: {
    spend: number;
    conversions: number;
    cpl: number;
    clicks?: number;
    ctr?: number;
    cpc?: number;
    priorSpend?: number;
    priorConversions?: number;
    priorCpl?: number;
    targetCpl?: number | null;
    benchmarkNotes?: string;
    topConvertingTerms?: string[];
    wastedSpendTerms?: string[];
    reportUrl?: string;
  };
  metaData?: {
    spend?: number;
    conversions?: number;
    cpl?: number;
    targetCpl?: number | null;
    notes?: string;
    reportUrl?: string;
  };
  customInstructions?: string;
  wordLimitTier?: "concise" | "standard" | "detailed";
  wordLimit?: number;
  senderName?: string;
  senderRole?: string;
  senderPhone?: string;
  senderWebsite?: string;
  organizationId?: string;
  userId?: string;
}

export interface ExecutiveBriefingResult {
  subject: string;
  plainText: string;
  htmlContent: string;
  fullHtml: string;
  channelReports: {
    google?: {
      overallSnapshot: string;
      theGoodAndBad: string;
      whatHappensNext: string;
    };
    meta?: {
      overallSnapshot: string;
      theGoodAndBad: string;
      whatHappensNext: string;
    };
  };
}

/**
 * USE CASE 2B: LAKSHANE'S EXECUTIVE REPORTING STANDARD
 * Generates an honest, candid, 3-pillar executive performance briefing.
 * Covers: Overall Snapshot, The Good and The Bad (and why), What Happens Next.
 * Formatting is intentionally clean, plain-formatted text with zero wild CSS.
 */
export async function generateExecutiveBriefing(
  data: ExecutiveBriefingParams,
): Promise<ExecutiveBriefingResult> {
  const period = data.periodLabel || "Last Month";
  const senderName = data.senderName || "Lakshane Fonseka";
  const senderRole = data.senderRole || "Founder | Uprise Digital";
  const senderPhone = data.senderPhone || "+61 426 759 756";
  const senderWebsite = data.senderWebsite || "www.uprisedigital.com.au";

  const appendChannelParam = (url: string, channel: "google" | "meta") => {
    if (!url) return url;
    if (url.includes("selected=")) return url;
    const separator = url.includes("?") ? "&" : "?";
    return `${url}${separator}selected=${channel}`;
  };

  const rawGoogleUrl =
    data.googleData?.reportUrl || "https://tools.uprisedigital.com.au/reports";
  const googleUrl = appendChannelParam(rawGoogleUrl, "google");

  const rawMetaUrl = data.metaData?.reportUrl || rawGoogleUrl;
  const metaUrl = appendChannelParam(rawMetaUrl, "meta");

  const prompt = `
You are Lakshane Fonseka, Founder & Lead Digital Strategist at Uprise Digital.
Write a monthly client performance email briefing for "${data.clientName}" following your exact, non-negotiable reporting standard.

LAKSHANE'S CORE STANDARD & TONE:
1. Brutal Honesty & Candour: Never hide setbacks or use corporate spin. If CPL increased or conversions dipped, state it immediately and provide the exact operational, campaign, or market "why" (e.g., search query leakage, seasonal changes, account maturity ramp, contractor creative delays, landing page friction).
2. The 3 Non-Negotiable Pillars for each channel:
   - Overall snapshot: A clear summary of the last 30 days covering actual spend, total conversions/leads, and actual Cost Per Lead (CPL), alongside period-over-period direction (comparing against prior period spend/leads/CPL if available).
   - The good and the bad: What performed well (e.g. converting keyword clusters, strong CTR), what missed the mark (e.g. wasted spend on non-converting terms, rising CPCs), and WHY.
   - What happens next: Concrete tactical actions and adjustments for the next 30 days (e.g. negative keyword pruning, budget reallocation, ad copy restructuring).
3. Short, Punchy Paragraphs: Lakshane writes in short 1-2 sentence paragraphs with generous breathing room. NEVER output dense blocks of text.
4. Plain Formatted Text: Written naturally as a direct email from an agency leader (Lakshane Fonseka) in Gmail. No marketing fluff, no wild CSS, no corporate clichés.
5. Language: Australian / UK English (optimise, prioritise, analysing, behaviour).
6. DO NOT include any salutation ("Hi Team") or signoff ("Let me know...", "KR", signature) inside the paragraphs. The email wrapper adds the greeting and signature automatically.
7. CRITICAL CLIENT COMMUNICATION RULE - NEVER MENTION TARGETS OR BENCHMARKS:
   - DO NOT mention target CPL, target CPA, target lead counts, or mature industry benchmark figures anywhere in the email narrative (especially for Google Ads and Meta).
   - RATIONALE: Even when actual CPL is only slightly above or below an internal target or benchmark, citing target figures causes friction, unnecessary anxiety, and client pushback.
   - WHAT TO DO INSTEAD: Focus strictly on actual delivery (exact spend, exact leads, actual CPL) and period-over-period trajectory (e.g. whether lead volume increased or efficiency improved relative to the prior month). State the actual numbers plainly and objectively without comparing against any target or benchmark numbers.

DATA CONTEXT:
- Client Name: ${data.clientName}
- Period: ${period}
${
  data.googleData
    ? `
- Google Ads Data:
  * Spend: $${data.googleData.spend.toFixed(2)}
  * Conversions (Leads): ${data.googleData.conversions}
  * Cost Per Lead (CPL): $${data.googleData.cpl.toFixed(2)}
  * Clicks: ${data.googleData.clicks ?? "-"}, CTR: ${data.googleData.ctr ? data.googleData.ctr.toFixed(2) + "%" : "-"}, CPC: ${data.googleData.cpc ? "$" + data.googleData.cpc.toFixed(2) : "-"}
  ${data.googleData.priorSpend ? `* Prior Period Comparison: Spend $${data.googleData.priorSpend.toFixed(2)}, Conversions: ${data.googleData.priorConversions}, Prior CPL: $${data.googleData.priorCpl?.toFixed(2)}` : ""}
  * Top Converting Search Terms: ${data.googleData.topConvertingTerms?.join(", ") || "core high-intent product terms"}
  * Wasted Spend / Non-Converting Terms: ${data.googleData.wastedSpendTerms?.join(", ") || "broad discovery terms"}
  * Report Link: ${googleUrl}
`
    : ""
}

${
  data.metaData
    ? `
- Meta Ads Data:
  * Spend: $${data.metaData.spend?.toFixed(2) || "0.00"}
  * Conversions (Leads): ${data.metaData.conversions || 0}
  * Cost Per Lead (CPL): $${data.metaData.cpl?.toFixed(2) || "0.00"}
  * Meta Context / Bottlenecks: ${data.metaData.notes || ""}
  * Report Link: ${metaUrl}
`
    : ""
}

${data.customInstructions ? `SPECIAL CLIENT NOTES / PROMPT INJECTION: ${data.customInstructions}` : ""}
${data.wordLimitTier ? `BREVITY / WORD LIMIT TIER: ${
  data.wordLimitTier === "concise"
    ? "CONCISE: Keep it punchy and brief (around 70-120 words per channel, strictly 1-2 short sentences per paragraph)."
    : data.wordLimitTier === "detailed"
      ? "DETAILED: Provide comprehensive strategic breakdown (around 220-300 words per channel with thorough operational context)."
      : "STANDARD: Balanced brevity (around 150-200 words per channel, direct and clear)."
}` : ""}
${data.wordLimit ? `MAXIMUM WORD LIMIT: Strictly keep total email narrative under ${data.wordLimit} words.` : ""}

Return a JSON object with this exact schema:
{
  "subject": "Performance Reports - ${period} - ${data.clientName}",
  "sections": {
    ${data.googleData ? `"google": {
      "paragraphs": [
        "Short paragraph (1-2 sentences) giving the overall snapshot: Spend, Leads, and actual CPL compared with the prior period. DO NOT mention target figures or benchmarks.",
        "Short paragraph (1-2 sentences) on what performed well (core converting keywords, CTR).",
        "Short paragraph (1-2 sentences) on what didn't perform well and WHY (exact non-converting queries and wasted spend).",
        "Short paragraph (1-2 sentences) on what happens next: immediate 30-day tactical corrections (negative keywords, match types, budget shifts)."
      ]
    }${data.metaData ? "," : ""}` : ""}
    ${data.metaData ? `"meta": {
      "paragraphs": [
        "Short paragraph (1-2 sentences) on overall snapshot: Meta spend, lead volume, and actual CPL compared with prior trends. DO NOT mention target figures or benchmarks.",
        "Short paragraph (1-2 sentences) on what performed well (creative angles, form submissions vs landing page).",
        "Short paragraph (1-2 sentences) on what didn't perform well and WHY (creative delays, ad fatigue, high CPL, learning phase).",
        "Short paragraph (1-2 sentences) on what happens next over the next 30 days (new video creatives, audience tuning, testing lead forms)."
      ]
    }` : ""}
  }
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
        feature: "executive_briefing_generation",
      },
    );

    const parsed = cleanAndParseJson<any>(result.response.text as string, null);
    const googleSec = parsed?.sections?.google || {};
    const metaSec = parsed?.sections?.meta || {};

    const stripExcess = (text: string) =>
      (text || "")
        .replace(/^Hi\s+[^\n,]+[,.]?\s*/i, "")
        .replace(/Let\s+me\s+know\s+if\s+you\s+have\s+any\s+questions[\s\S]*$/i, "")
        .replace(/KR[\s\S]*$/i, "")
        .trim();

    const parseSectionParagraphs = (sec: any, fallbackDefaults: string[]) => {
      if (Array.isArray(sec?.paragraphs) && sec.paragraphs.length > 0) {
        return sec.paragraphs.map(stripExcess).filter((p: string) => p.length > 0);
      }
      const fallbackSections = [
        sec?.overallSnapshot,
        sec?.theGoodAndBad,
        sec?.whatHappensNext,
      ]
        .map(stripExcess)
        .filter(Boolean);
      return fallbackSections.length > 0 ? fallbackSections : fallbackDefaults;
    };

    const googleParagraphs = data.googleData
      ? parseSectionParagraphs(googleSec, [
          `Google has tracked at $${data.googleData.cpl.toFixed(2)} CPL across $${data.googleData.spend.toFixed(2)} spend with ${data.googleData.conversions} leads generated over the period.`,
          `Core high-intent search terms converted steadily, while broad queries accounted for wasted spend that we are actively pruning.`,
          `Over the next 30 days, we are tightening match types, adding negative keywords, and focusing budget on top-converting ad groups.`,
        ])
      : [];

    const metaParagraphs = data.metaData
      ? parseSectionParagraphs(metaSec, [
          `Meta Ads generated ${data.metaData.conversions || 0} leads across $${data.metaData.spend?.toFixed(2) || "0.00"} spend at a CPL of $${data.metaData.cpl?.toFixed(2) || "0.00"}.`,
          `Top-performing ad creatives captured steady interest, but overall CPA was impacted by creative fatigue and onboarding asset delays.`,
          `Over the next 30 days, we are deploying refreshed video assets and testing instant lead forms to lower acquisition costs.`,
        ])
      : [];

    const cleanWebsite = senderWebsite.replace(/^https?:\/\//, "");

    const plainTextParts = [
      "Hi Team,",
      "",
      "Please see the performance reports for the last month below.",
    ];

    if (googleParagraphs.length > 0) {
      plainTextParts.push("", `Google Report (${googleUrl})`, "", googleParagraphs.join("\n\n"));
    }

    if (metaParagraphs.length > 0) {
      plainTextParts.push("", `Meta Report (${metaUrl})`, "", metaParagraphs.join("\n\n"));
    }

    plainTextParts.push(
      "",
      "Let me know if you have any questions.",
      "",
      "KR",
      "",
      senderName,
      senderRole,
      senderPhone,
      cleanWebsite
    );

    const plainText = plainTextParts.join("\n");

    let reportContentHtml = "";
    if (googleParagraphs.length > 0) {
      reportContentHtml += `
      <p style="margin: 20px 0 10px 0; font-size: 15px; font-weight: bold;">
        <a href="${googleUrl}" style="color: #1155cc; text-decoration: underline;">Google Report</a>
      </p>
      ${googleParagraphs.map((p: string) => `<p style="margin: 0 0 14px 0; line-height: 1.6;">${p}</p>`).join("")}
      `;
    }

    if (metaParagraphs.length > 0) {
      reportContentHtml += `
      <p style="margin: 26px 0 10px 0; font-size: 15px; font-weight: bold;">
        <a href="${metaUrl}" style="color: #1155cc; text-decoration: underline;">Meta Report</a>
      </p>
      ${metaParagraphs.map((p: string) => `<p style="margin: 0 0 14px 0; line-height: 1.6;">${p}</p>`).join("")}
      `;
    }

    const fullHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 14px; line-height: 1.6; color: inherit;">
  <div style="max-width: 600px; margin: 0; text-align: left;">
    <p style="margin: 0 0 16px 0;">Hi Team,</p>
    <p style="margin: 0 0 18px 0;">Please see the performance reports for the last month below.</p>

    ${reportContentHtml}

    <p style="margin: 24px 0 20px 0;">Let me know if you have any questions.</p>

    <p style="margin: 28px 0 14px 0; font-size: 14px; color: inherit;">KR</p>

    <!-- Uprise Executive Signature Footer -->
    <table border="0" cellspacing="0" cellpadding="0" style="margin-top: 10px; border-collapse: collapse;">
      <tr>
        <td valign="middle" style="padding-right: 18px; vertical-align: middle;">
          <img src="https://tools.uprisedigital.com.au/logo_black.png" alt="Uprise Digital" width="95" style="display: block; width: 95px; height: auto;" />
        </td>
        <td valign="middle" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 13.5px; line-height: 1.45; vertical-align: middle;">
          <div style="font-weight: 700; font-size: 14.5px; color: #0a2540;">${senderName}</div>
          <div style="color: #475569; margin-top: 2px;">Founder | <strong style="color: #0a2540;">Uprise Digital</strong></div>
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

    return {
      subject:
        parsed?.subject || `Performance Reports - ${period} - ${data.clientName}`,
      plainText,
      htmlContent: reportContentHtml,
      fullHtml,
      channelReports: {
        ...(googleParagraphs.length > 0
          ? {
              google: {
                overallSnapshot: googleParagraphs[0] || "",
                theGoodAndBad: googleParagraphs[1] || "",
                whatHappensNext: googleParagraphs[2] || "",
              },
            }
          : {}),
        ...(metaParagraphs.length > 0
          ? {
              meta: {
                overallSnapshot: metaParagraphs[0] || "",
                theGoodAndBad: metaParagraphs[1] || "",
                whatHappensNext: metaParagraphs[2] || "",
              },
            }
          : {}),
      },
    };
  } catch (err) {
    console.error("Executive Briefing Generation Error:", err);
    throw err;
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

/**
 * ─── USE CASE 4: IN-DEPTH CONVERSATIONAL AI ANALYST ────────────────────────────
 */
export interface AnalystToolDeclaration {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
  };
}

export const ANALYST_TOOLS: AnalystToolDeclaration[] = [
  {
    name: "get_agency_god_view",
    description:
      "Fetches macro agency portfolio metrics (total spend, conversions, blended CPA, ROAS, clicks, impressions) and fires/alerts across all client ad accounts for a given date range. Use this for agency-wide health questions.",
    parameters: {
      type: "OBJECT",
      properties: {
        startDate: {
          type: "STRING",
          description: "Start date in YYYY-MM-DD format.",
        },
        endDate: {
          type: "STRING",
          description: "End date in YYYY-MM-DD format.",
        },
      },
      required: ["startDate", "endDate"],
    },
  },
  {
    name: "list_accounts",
    description:
      "Lists all client ad accounts with their internal database IDs, names, Google/Meta account IDs, currencies, and active status. Call this when you need to know which client accounts exist or find an account ID.",
    parameters: {
      type: "OBJECT",
      properties: {},
    },
  },
  {
    name: "lookup_account_by_name",
    description:
      "Searches for an ad account by client or brand name (partial match). Returns matching accounts with internal ID.",
    parameters: {
      type: "OBJECT",
      properties: {
        name: {
          type: "STRING",
          description: "Partial or full name of the client or account.",
        },
      },
      required: ["name"],
    },
  },
  {
    name: "get_account_metrics",
    description:
      "Fetches detailed performance metrics (spend, conversions, CPA, ROAS, clicks, CTR, campaign breakdowns) for a specific client account for a date range.",
    parameters: {
      type: "OBJECT",
      properties: {
        accountId: {
          type: "NUMBER",
          description: "Internal database ID of the ad account.",
        },
        startDate: {
          type: "STRING",
          description: "Start date in YYYY-MM-DD format.",
        },
        endDate: {
          type: "STRING",
          description: "End date in YYYY-MM-DD format.",
        },
      },
      required: ["accountId", "startDate", "endDate"],
    },
  },
  {
    name: "get_historical_comparison",
    description:
      "Compares an account's metrics between the current date range and the preceding equivalent period side-by-side with percentage deltas.",
    parameters: {
      type: "OBJECT",
      properties: {
        accountId: {
          type: "NUMBER",
          description: "Internal database ID of the ad account.",
        },
        startDate: {
          type: "STRING",
          description: "Start date in YYYY-MM-DD format.",
        },
        endDate: {
          type: "STRING",
          description: "End date in YYYY-MM-DD format.",
        },
      },
      required: ["accountId", "startDate", "endDate"],
    },
  },
  {
    name: "get_search_term_insights",
    description:
      "Returns top converting search queries vs wasted spend queries (queries that spent budget but generated 0 conversions).",
    parameters: {
      type: "OBJECT",
      properties: {
        accountId: {
          type: "NUMBER",
          description: "Internal database ID of the ad account.",
        },
        startDate: {
          type: "STRING",
          description: "Start date in YYYY-MM-DD format.",
        },
        endDate: {
          type: "STRING",
          description: "End date in YYYY-MM-DD format.",
        },
        limit: {
          type: "NUMBER",
          description: "Maximum search terms to analyze (default 25).",
        },
      },
      required: ["accountId", "startDate", "endDate"],
    },
  },
  {
    name: "get_account_anomalies",
    description:
      "Detects statistically significant anomalies in an account's recent performance against its 30-day baseline.",
    parameters: {
      type: "OBJECT",
      properties: {
        accountId: {
          type: "NUMBER",
          description: "Internal database ID of the ad account.",
        },
        lookbackDays: {
          type: "NUMBER",
          description: "Baseline period in days (default 30).",
        },
      },
      required: ["accountId"],
    },
  },
  {
    name: "get_concentration_report",
    description:
      "Returns Herfindahl-Hirschman Index (HHI) concentration risk analysis across the entire agency portfolio, identifying top whale accounts and revenue-at-risk.",
    parameters: {
      type: "OBJECT",
      properties: {
        startDate: {
          type: "STRING",
          description: "Start date in YYYY-MM-DD format.",
        },
        endDate: {
          type: "STRING",
          description: "End date in YYYY-MM-DD format.",
        },
      },
      required: ["startDate", "endDate"],
    },
  },
  {
    name: "get_impression_share_report",
    description:
      "Returns Search Impression Share, Lost IS (Budget), and Lost IS (Rank) to detect auction visibility bottlenecks.",
    parameters: {
      type: "OBJECT",
      properties: {
        accountId: {
          type: "NUMBER",
          description: "Internal database ID of the ad account.",
        },
        startDate: {
          type: "STRING",
          description: "Start date in YYYY-MM-DD format.",
        },
        endDate: {
          type: "STRING",
          description: "End date in YYYY-MM-DD format.",
        },
      },
      required: ["accountId"],
    },
  },
  {
    name: "get_campaign_details",
    description:
      "Returns campaign settings, bidding strategies (e.g. Target CPA, Max Conversions), daily budget caps, status, and geo targets.",
    parameters: {
      type: "OBJECT",
      properties: {
        accountId: {
          type: "NUMBER",
          description: "Internal database ID of the ad account.",
        },
      },
      required: ["accountId"],
    },
  },
];

export async function executeAnalystTool(
  toolName: string,
  args: Record<string, any>,
  organizationId?: string,
): Promise<any> {
  const dates = getMelbourneDateStrings();
  const defaultStart = args.startDate || dates.yesterdayStr;
  const defaultEnd = args.endDate || dates.todayStr;

  switch (toolName) {
    case "get_agency_god_view": {
      const res = await getAgencyPortfolioMetricsAction(
        defaultStart,
        defaultEnd,
        args.platformFilter || "all",
      );
      return res.success
        ? res.data
        : { error: res.error || "Failed to fetch portfolio data" };
    }
    case "list_accounts": {
      const res = await listAccountsAction();
      return res.success
        ? res.data
        : { error: res.error || "Failed to list accounts" };
    }
    case "lookup_account_by_name": {
      const res = await getAccountByNameAction(args.name);
      return res.success
        ? res.data
        : { error: res.error || "Failed to lookup account" };
    }
    case "get_account_metrics": {
      const accountId = Number(args.accountId);
      const account = await withBypassTenantDb(async (tx) => {
        return await tx.query.adAccounts.findFirst({
          where: eq(adAccounts.id, accountId),
        });
      });
      if (!account)
        return { error: `Ad account with ID ${accountId} not found.` };
      const res = await getDashboardMetricsAction(
        account.id,
        account.googleAccountId,
        defaultStart,
        defaultEnd,
      );
      return res.success
        ? {
            account: {
              id: account.id,
              name: account.name,
              currency: account.currencyCode,
            },
            metrics: res.data,
          }
        : { error: res.error || "Failed to fetch account metrics" };
    }
    case "get_historical_comparison": {
      const res = await getHistoricalComparisonAction(
        Number(args.accountId),
        defaultStart,
        defaultEnd,
      );
      return res.success
        ? res.data
        : { error: res.error || "Failed to fetch comparison" };
    }
    case "get_search_term_insights": {
      const res = await getSearchTermInsightsAction(
        Number(args.accountId),
        defaultStart,
        defaultEnd,
        args.limit || 25,
      );
      return res.success
        ? res.data
        : { error: res.error || "Failed to fetch search term insights" };
    }
    case "get_account_anomalies": {
      const res = await getAccountAnomaliesAction(
        Number(args.accountId),
        args.lookbackDays || 30,
      );
      return res.success
        ? res.data
        : { error: res.error || "Failed to detect anomalies" };
    }
    case "get_concentration_report": {
      const res = await getConcentrationReportAction(defaultStart, defaultEnd);
      return res.success
        ? res.data
        : { error: res.error || "Failed to generate concentration report" };
    }
    case "get_impression_share_report": {
      const res = await getImpressionShareReportInternal(
        Number(args.accountId),
        defaultStart,
        defaultEnd,
      );
      return res.success
        ? res.data
        : { error: res.error || "Failed to fetch impression share" };
    }
    case "get_campaign_details": {
      const res = await getCampaignDetailsAction(Number(args.accountId));
      return res.success
        ? res.data
        : { error: res.error || "Failed to fetch campaign details" };
    }
    default:
      return { error: `Tool ${toolName} is not recognized.` };
  }
}

export async function runAnalystConversationTurn(params: {
  conversationHistory: {
    role: "user" | "assistant" | "system";
    content: string;
  }[];
  userMessage: string;
  selectedAccountId?: number | null;
  organizationId?: string;
  userId?: string | null;
}): Promise<{
  reply: string;
  toolCalls: { name: string; args: any; result: any }[];
}> {
  const melbourneToday = getMelbourneTodayStr();
  const dates = getMelbourneDateStrings();

  let contextAccountNote = "";
  if (params.selectedAccountId) {
    const acc = await withBypassTenantDb(async (tx) => {
      return await tx.query.adAccounts.findFirst({
        where: eq(adAccounts.id, params.selectedAccountId!),
      });
    });
    if (acc) {
      contextAccountNote = `\nCURRENT SELECTED CONTEXT ACCOUNT:\n- Name: ${acc.name}\n- Internal ID: ${acc.id}\n- Google Account ID: ${acc.googleAccountId}\n- Currency: ${acc.currencyCode || "USD"}\nWhen answering account-specific queries, prioritize this account unless the user asks about another account or the entire portfolio.`;
    }
  }

  const systemInstruction = `You are the Senior PPC & Paid Media Strategist Analyst at Uprise Digital.
You have direct, real-time access to the agency's Google Ads and Meta Ads performance database and analytical tools.
Current Melbourne Date: ${melbourneToday} (Yesterday: ${dates.yesterdayStr}).
${contextAccountNote}

YOUR CAPABILITIES & PROTOCOL:
1. When asked about metrics, portfolio performance, client accounts, wasted spend, or anomalies, USE THE AVAILABLE TOOLS to retrieve exact data before responding. Never guess or hallucinate numbers.
2. Available Tools:
   - get_agency_god_view: Overall agency macro spend, conversions, CPA, ROAS, fire alerts.
   - list_accounts: Discover accounts, internal IDs, and platform links.
   - lookup_account_by_name: Find accounts by partial name.
   - get_account_metrics: Detailed metrics and campaign breakdowns for an account.
   - get_historical_comparison: Period-over-period delta comparisons.
   - get_search_term_insights: Top converting queries vs wasted spend queries with 0 conversions.
   - get_account_anomalies: Statistical anomalies against 30-day baseline.
   - get_concentration_report: Whale accounts and portfolio risk.
   - get_impression_share_report: Search IS, Lost IS (Budget/Rank).
   - get_campaign_details: Campaign bidding strategies and budgets.
3. VISUAL STRUCTURE & PRESENTATION (GEMINI-INSPIRED DESIGN):
   - NEVER output dense, monolithic walls of text. Break your analysis into distinct, airy sections with markdown headings (##, ###).
   - TOP-LEVEL KPIS: When analysing performance, lead with 3 to 4 headline metrics formatted in a \`\`\`kpis block:
\`\`\`kpis
[
  {"label": "Total Spend", "value": "$21,254.57", "delta": "+4.91%", "trend": "neutral"},
  {"label": "Conversions", "value": "1,277.98", "delta": "+8.58%", "trend": "up"},
  {"label": "Blended CPA", "value": "$16.63", "delta": "-3.38%", "trend": "up"},
  {"label": "Blended CTR", "value": "2.23%", "delta": "+0.33 pts", "trend": "up"}
]
\`\`\`
   - DATA TABLES: For comparisons, period breakdowns, or account ledgers, ALWAYS use valid GitHub Flavored Markdown (GFM) pipe tables with alignment:
| Metric | Preceding Period | Current Period | Delta |
| :--- | :--- | :--- | :--- |
| **Total Spend** | $20,260.00 | $21,254.57 | +4.91% |
| **Total Conversions** | 1,177.02 | 1,277.98 | +8.58% |
| **Blended CPA** | $17.21 | $16.63 | -3.38% |
   - KEY INSIGHTS: Call out critical strategic takeaways with a blockquote starting with \`> **Key Strategic Insight:**\`:
> **Key Strategic Insight:** Whilst Meta Ads is operating as our high-volume growth engine, Google Ads is experiencing severe budget leakage in non-converting search queries.
   - SUGGESTED NEXT STEPS (QUICK ACTIONS): Always conclude your analysis with 2 to 4 recommended follow-up questions or investigative actions formatted in a \`\`\`quick-actions block:
\`\`\`quick-actions
[
  "Deep-dive into Google Ads wasted search terms",
  "Audit Meta CPA spike accounts",
  "Check portfolio impression share losses"
]
\`\`\`
4. LANGUAGE & TONE RULES:
   - STRICTLY British / Commonwealth English spelling (optimise, prioritise, analysed, behaviour, programme, colour).
   - Proactive, commercially insightful, sharp, and structured.
   - Cite specific numbers (currency, conversions, CPA, deltas %).
`;

  const messagesPayload: any[] = [];
  params.conversationHistory.slice(-8).forEach((msg) => {
    messagesPayload.push({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }],
    });
  });
  messagesPayload.push({
    role: "user",
    parts: [{ text: params.userMessage }],
  });

  const toolDeclarations = ANALYST_TOOLS.map((t) => ({
    name: t.name,
    description: t.description,
    parameters: t.parameters,
  }));

  const executedTools: { name: string; args: any; result: any }[] = [];
  const MAX_TOOL_TURNS = 5;
  let finalReply = "";

  for (let turn = 1; turn <= MAX_TOOL_TURNS; turn++) {
    const step = await generateContentTracked(
      {
        model: GEMINI_MODEL_LOW,
        contents: messagesPayload,
        config: {
          systemInstruction,
          tools: [{ functionDeclarations: toolDeclarations }],
        },
      },
      {
        organizationId: params.organizationId,
        userId: params.userId,
        feature: "analyst_chatbot",
      },
    );

    const functionCalls = step.response.functionCalls || [];

    // If the model did not call any tools, it generated the conversational / analytical response
    if (!functionCalls.length) {
      const rawParts = step.response.candidates?.[0]?.content?.parts || [];
      const textParts = rawParts
        .filter((p: any) => typeof p.text === "string" && !p.thought)
        .map((p: any) => p.text)
        .join("\n")
        .trim();

      finalReply = step.response.text?.trim() || textParts || "";
      break;
    }

    // Append model response turn (preserves thoughtSignature, functionCalls, and candidate structure)
    const modelContent = step.response.candidates?.[0]?.content;
    if (modelContent) {
      messagesPayload.push(modelContent);
    } else {
      messagesPayload.push({
        role: "model",
        parts: functionCalls.map((fc) => ({
          functionCall: { name: fc.name, args: fc.args },
        })),
      });
    }

    // Execute all function calls and gather responses into ONE user turn
    const functionResponses: any[] = [];
    for (const fc of functionCalls) {
      const toolName = fc.name || "";
      if (!toolName) continue;

      try {
        const result = await executeAnalystTool(
          toolName,
          fc.args as any,
          params.organizationId,
        );
        executedTools.push({
          name: toolName,
          args: fc.args,
          result,
        });

        // Ensure response is always a non-array object for Protobuf Struct compatibility
        const safeResponse =
          typeof result === "object" &&
          result !== null &&
          !Array.isArray(result)
            ? result
            : { data: result };

        functionResponses.push({
          functionResponse: {
            name: toolName,
            response: safeResponse,
          },
        });
      } catch (err: any) {
        executedTools.push({
          name: toolName,
          args: fc.args,
          result: { error: err.message },
        });
        functionResponses.push({
          functionResponse: {
            name: toolName,
            response: { error: err.message },
          },
        });
      }
    }

    messagesPayload.push({
      role: "user",
      parts: functionResponses,
    });
  }

  // If the model exhausted MAX_TOOL_TURNS without generating text, trigger a final synthesis turn
  if (!finalReply) {
    messagesPayload.push({
      role: "user",
      parts: [
        {
          text: "Based on all the performance metrics and account details gathered above, deliver your complete, structured strategic media analysis now in British English.",
        },
      ],
    });

    const finalStep = await generateContentTracked(
      {
        model: GEMINI_MODEL_LOW,
        contents: messagesPayload,
        config: {
          systemInstruction,
          tools: [{ functionDeclarations: toolDeclarations }],
        },
      },
      {
        organizationId: params.organizationId,
        userId: params.userId,
        feature: "analyst_chatbot",
      },
    );

    const rawParts = finalStep.response.candidates?.[0]?.content?.parts || [];
    const textParts = rawParts
      .filter((p: any) => typeof p.text === "string" && !p.thought)
      .map((p: any) => p.text)
      .join("\n")
      .trim();

    finalReply =
      finalStep.response.text?.trim() ||
      textParts ||
      "I have analysed the portfolio data, but could not produce a commentary. Please try asking a specific question regarding CPA, spend, or account performance.";
  }

  return {
    reply: finalReply,
    toolCalls: executedTools,
  };
}
