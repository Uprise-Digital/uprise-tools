"use server";

import { GoogleGenAI } from '@google/genai';
import { getDashboardMetricsAction } from "@/actions/dashboard.actions";

// Initialize the AI client
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

/**
 * STRATEGIC INSIGHTS ENGINE
 * Analyzes dashboard data for 3-pillar actionable intelligence.
 */
export async function generateAiInsightsAction(adAccountId: number, googleAccountId: string, startDate: string, endDate: string) {
    // 1. Fetch the data
    const dataRes = await getDashboardMetricsAction(adAccountId, googleAccountId, startDate, endDate);
    if (!dataRes.success || !dataRes.data) {
        throw new Error("Data analysis unavailable: Unable to retrieve dashboard metrics.");
    }

    // 2. Define the System Prompt & Logic
    const prompt = `
    You are an elite Performance Marketing Strategist. Analyze the following Google Ads data and provide deep-dive intelligence across 3 pillars: Diagnostics, Predictive, and Prescriptive.

    DATA: ${JSON.stringify(dataRes.data)}

    OUTPUT FORMAT (Strict JSON):
    {
      "executive_summary": "3-sentence summary for a client email, highlighting win/loss performance.",
      "diagnostic_intelligence": {
        "cpa_dynamics": {
          "primary_driver": "Breakdown: Was CPA variance caused by CPC inflation, CTR decay, or CR volatility?",
          "variance_pct": "Percentage variance compared to the average.",
          "causal_analysis": "Detailed explanation of the relationship between spend levels and conversion efficiency."
        },
        "campaign_performance_vectors": [
          {
            "campaign_name": "Name",
            "contribution_weight": "% of total spend",
            "efficiency_score": "Relative performance rating (Under/Over/Balanced)"
          }
        ]
      },
      "predictive_forecasting": {
        "pacing_metrics": {
          "projected_spend": "Value",
          "projected_conversions": "Value",
          "pacing_delta": "The difference between projected spend and the monthly budget target."
        },
        "budget_health": "Status: Pacing Fast/Slow/On-Track with a brief technical justification."
      },
      "prescriptive_optimization": {
        "strategic_moves": [
          {
            "priority": "High/Medium/Low",
            "action": "Specific bid, budget, or creative recommendation",
            "expected_impact": "Quantifiable estimate (e.g., '10% reduction in CPA')"
          }
        ],
        "top_action_item": "One clear, high-priority task for the account manager.",
        "technical_reasoning": "Data-backed justification for the top action item."
      }
    }

    CONSTRAINTS:
    - Use concrete figures from the JSON.
    - Be authoritative, data-driven, and agency-grade.
    - If spend is NaN or 0, focus analysis on traffic quality (Clicks/Impressions).
    `;

    // 3. Generate response using Gemini
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: 'application/json'
            }
        });

        return JSON.parse(response.text as string);
    } catch (error) {
        console.error("AI Insights Error:", error);
        throw new Error("Failed to generate strategic insights.");
    }
}