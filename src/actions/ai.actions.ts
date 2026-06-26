"use server";

import { GoogleGenAI } from "@google/genai";
import { and, eq } from "drizzle-orm";
import { getDashboardMetricsAction } from "@/actions/dashboard.actions";
import { db } from "@/db";
import { aiInsightsCache } from "@/db/schema";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export async function getOrGenerateAiInsightsAction(
  adAccountId: number,
  googleAccountId: string,
  startDate: string,
  endDate: string,
  forceRefresh: boolean = false,
) {
  // 1. Check Cache First (if not forcing a refresh)
  if (!forceRefresh) {
    const cached = await db.query.aiInsightsCache.findFirst({
      where: and(
        eq(aiInsightsCache.adAccountId, adAccountId),
        eq(aiInsightsCache.startDate, startDate),
        eq(aiInsightsCache.endDate, endDate),
      ),
    });

    if (cached) {
      return {
        success: true,
        data: cached.insights,
        generatedAt: cached.createdAt,
        isCached: true,
      };
    }
  }

  // 2. Fetch fresh data for the LLM
  const dataRes = await getDashboardMetricsAction(
    adAccountId,
    googleAccountId,
    startDate,
    endDate,
  );
  if (!dataRes.success || !dataRes.data) {
    throw new Error(
      "Data analysis unavailable: Unable to retrieve dashboard metrics.",
    );
  }

  // --- NEW: Pre-compute the hard math to prevent LLM hallucinations ---
  // Note: Adjust 'dataRes.data.campaigns' to match your actual data schema if needed.
  const campaigns = dataRes.data.campaigns || [];

  let totalSpend = 0;
  let totalConversions = 0;
  let totalClicks = 0;
  let totalImpressions = 0;

  campaigns.forEach((c: any) => {
    totalSpend += c.spend || 0;
    totalConversions += c.conversions || 0;
    totalClicks += c.clicks || 0;
    totalImpressions += c.impressions || 0;
  });

  const blendedCPA = totalConversions > 0 ? totalSpend / totalConversions : 0;
  const blendedCTR =
    totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
  const blendedCR =
    totalClicks > 0 ? (totalConversions / totalClicks) * 100 : 0;

  // Find the actual best campaign by CPA (Requires at least 1 conversion)
  const validCampaigns = campaigns.filter((c: any) => c.conversions > 0);
  const topCampaign =
    validCampaigns.length > 0
      ? validCampaigns.reduce((prev: any, curr: any) =>
          prev.spend / prev.conversions < curr.spend / curr.conversions
            ? prev
            : curr,
        )
      : null;

  const calculatedMetrics = {
    account_totals: {
      total_spend: totalSpend.toFixed(2),
      total_conversions: totalConversions,
      blended_cpa: blendedCPA.toFixed(2),
      blended_ctr: blendedCTR.toFixed(2) + "%",
      blended_conversion_rate: blendedCR.toFixed(2) + "%",
    },
    top_performer: {
      name: topCampaign?.campaignName || "None",
      spend: topCampaign?.spend || 0,
      conversions: topCampaign?.conversions || 0,
      cpa: topCampaign
        ? (topCampaign.spend / topCampaign.conversions).toFixed(2)
        : 0,
    },
  };
  // -------------------------------------------------------------------

  // 3. Define Prompt
  const prompt = `
    You are an elite Performance Marketing Strategist. Analyze the following Google Ads data and provide deep-dive intelligence across 3 pillars: Diagnostics, Predictive, and Prescriptive.

    RAW DATA: ${JSON.stringify(dataRes.data)}
    
    PRE-CALCULATED FACTS (USE THESE EXACT FIGURES STRICTLY): 
    ${JSON.stringify(calculatedMetrics)}

    CRITICAL INSTRUCTION: 
    Do NOT attempt to calculate overall CPA, CTR, or top campaigns yourself. You MUST use the figures provided in the "PRE-CALCULATED FACTS" section for your narrative and strategic recommendations. Ensure you highlight the exact "top_performer" identified above.

    OUTPUT FORMAT (Strict JSON):
    {
      "executive_summary": "3-sentence summary for a client email, highlighting win/loss performance based on the PRE-CALCULATED FACTS.",
      "diagnostic_intelligence": {
        "cpa_dynamics": {
          "primary_driver": "Breakdown: Was CPA variance caused by CPC inflation, CTR decay, or CR volatility?",
          "variance_pct": "Use the numbers provided to explain the variance.",
          "causal_analysis": "Detailed explanation of the relationship between spend levels and conversion efficiency."
        },
        "campaign_performance_vectors": [
          {
            "campaign_name": "Name",
            "contribution_weight": "Estimated % of total spend",
            "efficiency_score": "Relative performance rating (Under/Over/Balanced)"
          }
        ]
      },
      "predictive_forecasting": {
        "pacing_metrics": {
          "projected_spend": "Estimate based on daily averages",
          "projected_conversions": "Estimate",
          "pacing_delta": "The difference between projected spend and a typical budget."
        },
        "budget_health": "Status: Pacing Fast/Slow/On-Track with a brief technical justification."
      },
      "prescriptive_optimization": {
        "strategic_moves": [
          {
            "priority": "High/Medium/Low",
            "action": "Specific bid, budget, or creative recommendation (Make sure to prioritize scaling the top_performer)",
            "expected_impact": "Quantifiable estimate (e.g., '10% reduction in CPA')"
          }
        ],
        "top_action_item": "One clear, high-priority task for the account manager.",
        "technical_reasoning": "Data-backed justification for the top action item."
      }
    }

    CONSTRAINTS:
    - Base all analysis strictly on the JSON figures.
    - Be authoritative, data-driven, and agency-grade.
    - If spend is NaN or 0, focus analysis on traffic quality.
    `;

  // 4. Generate response using Gemini
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: { responseMimeType: "application/json" },
    });

    const parsedInsights = JSON.parse(response.text as string);

    // 5. Upsert into Cache
    const [upserted] = await db
      .insert(aiInsightsCache)
      .values({
        adAccountId,
        startDate,
        endDate,
        insights: parsedInsights,
        createdAt: new Date(), // Reset timestamp
      })
      .onConflictDoUpdate({
        target: [
          aiInsightsCache.adAccountId,
          aiInsightsCache.startDate,
          aiInsightsCache.endDate,
        ],
        set: {
          insights: parsedInsights,
          createdAt: new Date(),
        },
      })
      .returning({ createdAt: aiInsightsCache.createdAt });

    return {
      success: true,
      data: parsedInsights,
      generatedAt: upserted.createdAt,
      isCached: false,
    };
  } catch (error) {
    console.error("AI Insights Error:", error);
    throw new Error("Failed to generate strategic insights.");
  }
}

/**
 * PORTFOLIO GOD-VIEW ENGINE
 * Analyzes the entire agency portfolio for macro trends and critical fires.
 */
export async function generateAgencyAiInsightsAction(portfolioData: any) {
  const prompt = `
    You are the Strategy Director for an elite Performance Marketing Agency. Analyze this agency-wide portfolio data.

    PORTFOLIO DATA: ${JSON.stringify(portfolioData)}

    Your primary job is to protect agency retention by identifying "Critical Fires"—accounts that are actively failing or at high risk of churning. 
    
    CRITERIA FOR A "CRITICAL FIRE":
    1. The account has had ZERO activity (spend/impressions) recently, indicating a broken setup, paused billing, or churn.
    2. Click-Through Rate (CTR) is abysmal (under 3%), indicating total ad blindness or terrible targeting.
    3. The account is bleeding money (high spend) with zero or near-zero conversions.
    4. Blended CPA is catastrophically higher than the agency average.

    OUTPUT FORMAT (Strict JSON):
    {
      "macro_summary": "3-sentence high-level summary of the entire agency's performance.",
      "blended_efficiency": "Analysis of the blended agency CPA and CTR. Are we generally profitable across the board?",
      "critical_fires": [
        {
          "account_name": "Name of the failing account",
          "severity": "High/Critical",
          "the_problem": "Exactly what is going wrong (e.g., 'CTR has fallen to 1.2%' or 'Zero spend in the last week')",
          "recommended_action": "What the account manager must do IMMEDIATELY to save the client relationship."
        }
      ],
      "growth_opportunities": [
        {
          "account_name": "Name of an over-performing account",
          "reasoning": "Why we should ask this client to scale their budget."
        }
      ]
    }

    CONSTRAINTS:
    - If there are no critical fires matching the criteria, return an empty array []. Be strict; only flag genuine issues.
    - Base all analysis strictly on the provided JSON figures.
    `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: { responseMimeType: "application/json" },
    });

    return JSON.parse(response.text as string);
  } catch (error) {
    console.error("Agency AI Insights Error:", error);
    throw new Error("Failed to generate portfolio insights.");
  }
}
