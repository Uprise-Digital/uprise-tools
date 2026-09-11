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
