import { generateContentTracked } from "@/lib/ai-logger";

interface SearchTermInput {
  query: string;
  campaignId: string;
  campaignName: string;
  clicks: number;
  impressions: number;
  spend: number; // in normal currency units
  conversions: number;
}

interface HistoricalDecisionInput {
  keyword: string;
  status: string;
  rationale: string;
}

interface GenerateSuggestionsInput {
  clientName: string;
  websiteUrl?: string | null;
  targetNotes?: string | null;
  convertingTerms: SearchTermInput[];
  wastedTerms: SearchTermInput[];
  existingNegatives: string[];
  historicalDecisions: HistoricalDecisionInput[];
  broadEnabled?: boolean;
  phraseEnabled?: boolean;
  exactEnabled?: boolean;
  organizationId?: string;
  userId?: string | null;
  webResearchQueries?: string[];
  allZeroConversionTerms?: SearchTermInput[];
}

export interface NegativeKeywordSuggestionOutput {
  keyword: string;
  matchType: "broad" | "phrase" | "exact";
  campaignId: string;
  campaignName: string;
  rationale: string;
  searchQuery: string;
  clicks: number;
  impressions: number;
  spend: number;
  conversions: number;
}

export async function generateNegativeKeywordSuggestions({
  clientName,
  websiteUrl,
  targetNotes,
  convertingTerms,
  wastedTerms,
  existingNegatives,
  historicalDecisions,
  broadEnabled = true,
  phraseEnabled = true,
  exactEnabled = true,
  organizationId,
  userId,
  webResearchQueries = [],
  allZeroConversionTerms = [],
}: GenerateSuggestionsInput): Promise<{
  suggestions: NegativeKeywordSuggestionOutput[];
  explanation: string;
  usageAlert?: string;
}> {
  // Filter out any wasted terms that exactly match existing negative keywords
  const activeNegativesSet = new Set(
    existingNegatives.map((kw) => kw.toLowerCase().trim()),
  );
  const filteredWastedTerms = wastedTerms.filter(
    (term) => !activeNegativesSet.has(term.query.toLowerCase().trim()),
  );

  const filteredAllZeroTerms = allZeroConversionTerms.filter(
    (term) => !activeNegativesSet.has(term.query.toLowerCase().trim()),
  );

  // Compute metrics for the statistics section
  const totalWastedSpend = filteredAllZeroTerms.reduce(
    (sum, t) => sum + t.spend,
    0,
  );
  const totalConvertingSpend = convertingTerms.reduce(
    (sum, t) => sum + t.spend,
    0,
  );
  const totalSpend = totalConvertingSpend + totalWastedSpend;
  const wastedSpendPercent =
    totalSpend > 0 ? (totalWastedSpend / totalSpend) * 100 : 0;

  // Parse structured notes if targetNotes is valid JSON (Account-Level Persona Store)
  let structuredNotesSection = "";
  if (targetNotes) {
    try {
      const parsed = JSON.parse(targetNotes);
      if (typeof parsed === "object" && parsed !== null) {
        structuredNotesSection = `
    TARGET BUYER PERSONA & BUSINESS SCOPE:
    - Target Buyer Profile: ${parsed.targetBuyer || "N/A"}
    - NOT Target Buyer: ${parsed.notTargetBuyer || "N/A"}
    - Services in Scope: ${Array.isArray(parsed.serviceScope) ? parsed.serviceScope.join(", ") : parsed.serviceScope || "N/A"}
    - Out-of-Scope Services: ${Array.isArray(parsed.outOfScope) ? parsed.outOfScope.join(", ") : parsed.outOfScope || "N/A"}
    - Converting Intent Signals: ${Array.isArray(parsed.convertingIntentSignals) ? parsed.convertingIntentSignals.join(", ") : parsed.convertingIntentSignals || "N/A"}
    - Research/Informational Intent: ${Array.isArray(parsed.researchIntentSignals) ? parsed.researchIntentSignals.join(", ") : parsed.researchIntentSignals || "N/A"}${parsed.notes ? `\n    - Targeting & Business Notes: ${parsed.notes}` : ""}
        `;
      }
    } catch {
      // Free text target notes fallback
      structuredNotesSection = `
    TARGETING & BUSINESS NOTES:
    ${targetNotes}
      `;
    }
  }

  // Extract core service keywords to prevent AI from negating them
  let coreKeywordsList: string[] = [];
  if (clientName) {
    coreKeywordsList = coreKeywordsList.concat(
      clientName
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 2 && w !== "and" && w !== "the"),
    );
  }
  if (targetNotes) {
    try {
      const parsed = JSON.parse(targetNotes);
      if (parsed && parsed.serviceScope) {
        const scopes = Array.isArray(parsed.serviceScope)
          ? parsed.serviceScope
          : [parsed.serviceScope];
        for (const s of scopes) {
          coreKeywordsList = coreKeywordsList.concat(
            s
              .toLowerCase()
              .split(/[\s,]+/)
              .filter(
                (w: string) => w.length > 2 && w !== "and" && w !== "the",
              ),
          );
        }
      }
    } catch {}
  }
  const coreKeywordsUnique = Array.from(
    new Set(
      coreKeywordsList
        .map((k) => k.trim().replace(/[^\w]/g, ""))
        .filter((k) => k.length > 2),
    ),
  );

  // Format historical decisions for presentation
  const previouslyDenied = historicalDecisions.filter(
    (d) => d.status === "denied",
  );
  const previouslyApproved = historicalDecisions.filter(
    (d) => d.status === "approved",
  );

  const prompt = `
    You are an elite Google Ads Performance Director at Uprise Digital.
    Your task is to review a search terms report and web research findings for a client and identify wasteful, irrelevant, or non-converting search queries that should be added as negative keywords.
    
    CLIENT INFORMATION:
    - Name: ${clientName}
    ${websiteUrl ? `- Website: ${websiteUrl}` : ""}
    ${structuredNotesSection}
    
    CRITICAL RULE (BRAND SAFETY):
    Do NOT suggest adding the client's own brand name or any close variants of it as a negative keyword.
    Client Brand Name: "${clientName}"

    CORE SERVICE SAFETY & STATISTICAL SIGNIFICANCE:
    - Client's core service words: ${JSON.stringify(coreKeywordsUnique)}
    - NEVER suggest negating a core service keyword/word as a negative keyword (broad/phrase/exact) just because it has low or zero conversions, unless it has a statistically significant amount of wasted spend (e.g. > 10 clicks).
    - High-intent geographic searches (e.g. "demolition sydney" or "solar installation melbourne") within target service areas must be protected and NEVER negated.

    EXISTING NEGATIVE KEYWORDS (Already excluded, do not suggest these):
    ${existingNegatives.slice(0, 150).join(", ") || "None"}
    
    CONVERTING SEARCH TERMS (DO NOT suggest negative keywords that would block these or close variants):
    ${convertingTerms.length > 0 ? JSON.stringify(convertingTerms, null, 2) : "None recorded this period."}
    
    PREVIOUSLY DENIED SUGGESTIONS (Avoid re-suggesting these or terms that would block them):
    ${
      previouslyDenied.length > 0
        ? previouslyDenied
            .map((d) => `- "${d.keyword}": Denied because [${d.rationale}]`)
            .join("\n")
        : "None recorded."
    }
      
    PREVIOUSLY APPROVED EXCLUSIONS (Use as templates for what this client considers waste):
    ${
      previouslyApproved.length > 0
        ? previouslyApproved
            .map((d) => `- "${d.keyword}": Approved because [${d.rationale}]`)
            .join("\n")
        : "None recorded."
    }

    WEB RESEARCH FINDINGS (REAL-TIME GOOGLE SEARCH QUERIES & QUESTIONS RELATED TO CLIENT SERVICES):
    ${webResearchQueries.length > 0 ? JSON.stringify(webResearchQueries, null, 2) : "None."}

    PERFORMANCE STATISTICS:
    - Total evaluated query spend: $${totalSpend.toFixed(2)}
    - Total wasted spend (on zero-conversion queries): $${totalWastedSpend.toFixed(2)} (${wastedSpendPercent.toFixed(1)}% of spend)
    - Number of zero-conversion terms: ${filteredAllZeroTerms.length}

    WASTED SEARCH TERMS FOR NEGATIVE CONSIDERATION:
    ${JSON.stringify(filteredWastedTerms, null, 2)}

    ALL ZERO-CONVERSION TERMS EVALUATED IN THIS PERIOD (FOR NARRATIVE/EXPLANATION CONTEXT):
    ${JSON.stringify(filteredAllZeroTerms.slice(0, 40), null, 2)}
    
    EVALUATION & GENERATION INSTRUCTIONS:
    1. Wasted Search Terms: Evaluate every query in the wasted search terms list. Suggest a negative keyword only if there is clear, undeniable intent mismatch (e.g. competitors, wrong location, out-of-scope service). Do NOT negate highly relevant queries just because they lack conversions.
    2. Proactive Exclusions (Real-Time Web Research): Review the WEB RESEARCH FINDINGS and suggest negative keywords for any queries that represent competitor brand names, out-of-scope services, or low-intent research (like DIY, jobs, or education).
    3. Proactive Exclusions (Creative Industry Defaults): If there are few or no wasted search terms/web research findings, suggest standard proactive negative exclusions that this business type should always block (e.g., jobs, DIY, free, courses, resume, tools). Keep these highly creative but industry-aligned, and strictly ensure they do NOT conflict with client core services.
    4. Competitor Root Word Isolation: When negating competitor brand names, you MUST isolate the unique identifying word(s) of the competitor. NEVER include the client's core service keywords inside a phrase match negative — UNLESS the competitor's brand name itself is a multi-word proper noun where one word overlaps with a core service keyword (e.g. competitor "Red Energy" vs. core keyword "energy"). In that case, do NOT strip the shared word down to a single bare word (e.g. never suggest "red" alone or "energy" alone), and do NOT fall back to an EXACT match on the full literal search query. Instead, use the full competitor brand name as a single PHRASE match negative (e.g. "red energy"), since the brand name as a whole is a proper noun distinct from the generic service term.
       Example (multi-word brand overlapping a core keyword): Client "Clean Energy Providers" (core keywords include "energy", "solar", "battery"). Competitor "Red Energy" appears in search term "red energy batteries". Correct suggestion: keyword "red energy", matchType "phrase". Incorrect: keyword "red energy batteries", matchType "exact" (too narrow, won't catch variants). Incorrect: keyword "red", matchType "broad" (over-blocks unrelated queries).
    5. Redundancy Consolidation: Always target the root cause of the waste. If multiple wasted search terms or research queries share the same bad root word (e.g. a competitor name), suggest ONLY the root word as a phrase match negative.

    MATCH TYPE STRATEGY:
    Allowed Match Types: ${[broadEnabled && "broad", phraseEnabled && "phrase", exactEnabled && "exact"].filter(Boolean).join(", ").toUpperCase()}
    CRITICAL CONSTRAINT: You are ONLY allowed to recommend negative keywords using the above Allowed Match Types. Do NOT suggest any negative keyword with a match type that is not listed here. If a query would normally require a disallowed match type, skip generating a suggestion for that query entirely.

    - BROAD Match: Use ONLY for single, universally wasteful terms that indicate 100% wrong intent across the board (e.g. "jobs", "hire", "rental", "diy", "courses", "classes", "resume").
    - PHRASE Match: Use for competitor names (e.g. "walsh", "napoli") and specific geographic cities/states outside the service area (e.g. "perth", "gold coast", "canberra"). This prevents queries like "perth demolition contractors" from triggering ads.
    - Root Word Isolation for Competitors: When negating competitor brand names, you MUST isolate the unique identifying word(s) of the competitor. NEVER include the client's core service keywords inside a phrase match negative — UNLESS the competitor's brand name itself is a multi-word proper noun where one word overlaps with a core service keyword (e.g. competitor "Red Energy" vs. core keyword "energy"). In that case, do NOT strip the shared word down to a single bare word (e.g. never suggest "red" alone or "energy" alone), and do NOT fall back to an EXACT match on the full literal search query. Instead, use the full competitor brand name as a single PHRASE match negative (e.g. "red energy"), since the brand name as a whole is a proper noun distinct from the generic service term.
    - EXACT Match: Use ONLY for non-competitor queries that are close to the target service but wasteful in this exact context (e.g. "[trench excavation meaning]" or "[fibreglass pool removal]"). Never use EXACT match as a substitute for a competitor exclusion — competitor brand names, whether single-word or multi-word, are always PHRASE match, scoped to the isolated brand name, never the full raw search query.
    
    CAMPAIGN SCOPE (CROSS-CAMPAIGN REASONING):
    For each wasteful term, you must determine if the exclusion should be scoped locally or globally:
    - GLOBAL / ACCOUNT-WIDE: If the keyword is a competitor, a wrong geographic region, an out-of-scope service, or a low-intent word (like "jobs"), it should be blocked across ALL campaigns in the account (set campaignId to "ALL" and campaignName to "All Campaigns").
    - LOCAL / CAMPAIGN-SPECIFIC: If the term is only wasteful for the specific campaign it appeared in, keep the original "campaignId" and "campaignName" from the search term report.

    Response MUST be a JSON object containing the "suggestions" and "explanation" keys matching this exact structure:
    {
        "suggestions": Array<{
            "keyword": string,                               // The suggested negative keyword itself (do not include quotes or brackets, just the raw text)
            "matchType": "broad" | "phrase" | "exact",       // The recommended match type for the negative keyword
            "campaignId": string,                            // The campaign ID associated with the search term, or "ALL" for global/account-wide exclusions
            "campaignName": string,                          // The campaign name associated with the search term, or "All Campaigns" for global/account-wide exclusions
            "rationale": string,                             // A concise, professional marketing rationale for why this is waste
            "searchQuery": string,                           // The original search query/research finding that triggered this recommendation (use "Proactive Exclusion" for generic industry suggestions not linked to a specific query)
            "clicks": number,                                // Original clicks (0 for proactive suggestions)
            "impressions": number,                           // Original impressions (0 for proactive suggestions)
            "spend": number,                                 // Original spend (0 for proactive suggestions)
            "conversions": number                            // Original conversions (0 for proactive suggestions)
        }>,
        "explanation": string                                // A detailed, professional, agency-grade marketing explanation (3-4 sentences). 
                                                             // If "suggestions" is empty, write a clear narrative explaining WHY no suggestions were generated. Break down the zero-conversion queries (e.g. they are high-quality, on-topic searches like "plumber fortitude valley" that just have 1-2 clicks and need more data rather than being negative candidates). Include exact stats in the format "Total wasted spend: $X.XX (Y.Y% of spend) across Z zero-conversion terms" and name specific queries to explain why they are safe.
    }
  `;

  try {
    const responseSchema = {
      type: "object",
      properties: {
        suggestions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              keyword: { type: "string" },
              matchType: { type: "string", enum: ["broad", "phrase", "exact"] },
              campaignId: { type: "string" },
              campaignName: { type: "string" },
              rationale: { type: "string" },
              searchQuery: { type: "string" },
              clicks: { type: "integer" },
              impressions: { type: "integer" },
              spend: { type: "number" },
              conversions: { type: "integer" },
            },
            required: [
              "keyword",
              "matchType",
              "campaignId",
              "campaignName",
              "rationale",
              "searchQuery",
              "clicks",
              "impressions",
              "spend",
              "conversions",
            ],
          },
        },
        explanation: { type: "string" },
      },
      required: ["suggestions", "explanation"],
    };

    const result = await generateContentTracked(
      {
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: responseSchema,
        },
      },
      {
        organizationId,
        userId,
        feature: "negative_keyword_suggestions",
      },
    );

    const parsed = JSON.parse(result.response.text as string);
    const rawSuggestions = parsed.suggestions || [];
    const suggestionsFiltered = rawSuggestions.filter((s: any) => {
      const matchType = s.matchType?.toLowerCase();
      if (matchType === "broad" && !broadEnabled) return false;
      if (matchType === "phrase" && !phraseEnabled) return false;
      if (matchType === "exact" && !exactEnabled) return false;
      return true;
    });

    return {
      suggestions: suggestionsFiltered,
      explanation: parsed.explanation || "",
      usageAlert: result.usageAlert,
    };
  } catch (error) {
    console.error("Gemini Negative Keywords Generation Error:", error);
    return {
      suggestions: [],
      explanation: "Failed to generate suggestions description.",
    };
  }
}
