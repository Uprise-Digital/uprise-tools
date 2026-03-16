import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

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
    - Conversions: ${metrics.conversions} (${metrics.conversionsDelta.isPos ? '+' : '-'}${metrics.conversionsDelta.val}%)
    - CPA: $${metrics.costPerConv}
    - Top Keywords: ${keywords.slice(0, 5).map((k: any) => k.text).join(", ")}
    
    ${customInstructions ? `SPECIAL CLIENT INSTRUCTIONS: ${customInstructions}` : ''}
    
    TASK:
    1. Write a 3-sentence Executive Summary. If metrics are negative, maintain a positive, professional outlook focused on optimization.
    2. Write a 2-sentence "Looking Ahead" strategy.
    
    Response MUST be a JSON object: { "summary": "...", "nextSteps": "..." }
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: { responseMimeType: 'application/json' }
        });
        return JSON.parse(response.text as string);
    } catch (error) {
        console.error("PDF Insights Error:", error);
        return {
            summary: "Performance remains consistent with a focus on conversion efficiency.",
            nextSteps: "We will continue monitoring high-intent search terms for budget optimization."
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
    - Conversions: ${metrics.conversions} (${metrics.conversionsDelta.isPos ? 'up' : 'down'} ${metrics.conversionsDelta.val}%)
    - Spend: $${metrics.cost}
    
    ${customInstructions ? `TONE/FOCUS INSTRUCTIONS: ${customInstructions}` : ''}
    
    TASK:
    - Keep it under 4 sentences.
    - Mention that the full report is attached.
    - Be encouraging and helpful.
    - Do not use a subject line or sign-off, just the body text.
    
    Response MUST be a JSON object: { "emailBody": "..." }
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: { responseMimeType: 'application/json' }
        });
        return JSON.parse(response.text as string);
    } catch (error) {
        console.error("Email Body Error:", error);
        return {
            emailBody: `Hi there, please find your latest Google Ads performance report attached. We've seen some interesting shifts this month and look forward to discussing the next steps with you.`
        };
    }
}