import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

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
}: GenerateSuggestionsInput): Promise<NegativeKeywordSuggestionOutput[]> {
  if (wastedTerms.length === 0) {
    return [];
  }

  // Filter out any wasted terms that exactly match existing negative keywords
  const activeNegativesSet = new Set(
    existingNegatives.map((kw) => kw.toLowerCase().trim()),
  );
  const filteredWastedTerms = wastedTerms.filter(
    (term) => !activeNegativesSet.has(term.query.toLowerCase().trim()),
  );

  if (filteredWastedTerms.length === 0) {
    return [];
  }

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
    - Research/Informational Signals: ${Array.isArray(parsed.researchIntentSignals) ? parsed.researchIntentSignals.join(", ") : parsed.researchIntentSignals || "N/A"}
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

  // Format historical decisions for presentation
  const previouslyDenied = historicalDecisions.filter(
    (d) => d.status === "denied",
  );
  const previouslyApproved = historicalDecisions.filter(
    (d) => d.status === "approved",
  );

  const prompt = `
    You are an elite Google Ads Performance Director at Uprise Digital.
    Your task is to review a search terms report for a client and identify wasteful, irrelevant, or non-converting search queries that should be added as campaign-level or account-wide negative keywords.
    
    CLIENT INFORMATION:
    - Name: ${clientName}
    ${websiteUrl ? `- Website: ${websiteUrl}` : ""}
    ${structuredNotesSection}
    
    CRITICAL RULE (BRAND SAFETY):
    Do NOT suggest adding the client's own brand name or any close variants of it as a negative keyword.
    Client Brand Name: "${clientName}"

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

    WASTED SEARCH TERMS TO EVALUATE:
    ${JSON.stringify(filteredWastedTerms, null, 2)}
    
    EVALUATION INSTRUCTIONS (BE EXTRA THOROUGH):
    You must evaluate EVERY SINGLE query in the wasted search terms list. Run an exhaustive pass over all terms.
    Identify and suggest negative keywords based on the targeting persona details and historical decisions:
    1. Competitor Brands: Any query referencing other local/national companies, contractors, or specific brand names.
    2. Geographic Waste: Any query targeting a region outside the client's service area (e.g. if the client operates on the East Coast of Australia, queries containing "perth", "western australia", "adelaide", "wa" are waste).
    3. Research/Informational Intent: Queries searching for definitions, formulas, checklists, general templates, or free resources when the target buyer persona seeks active consulting/assessments.
    4. Out-of-Scope Services: Queries seeking services the client does NOT provide (check services in scope vs out-of-scope).
    5. Employment/Job-Seekers: Queries containing "jobs", "careers", "resume", "hiring", "salary".

    MATCH TYPE STRATEGY:
    You must choose the recommended negative match type based on these strict guidelines:
    - BROAD Match: Use ONLY for single, universally wasteful terms that indicate 100% wrong intent across the board (e.g. "jobs", "hire", "rental", "diy", "courses", "classes", "resume").
    - PHRASE Match: Use for competitor names (e.g. "walsh", "napoli") and specific geographic cities/states outside the service area (e.g. "perth", "gold coast", "canberra"). This prevents queries like "perth demolition contractors" from triggering ads.
    - EXACT Match: Use for queries that are close to the target service but are wasteful in this exact context (e.g., "[trench excavation meaning]" or "[fibreglass pool removal]"). This blocks the specific wasted search while protecting broad terms.
    
    CAMPAIGN SCOPE (CROSS-CAMPAIGN REASONING):
    For each wasteful term, you must determine if the exclusion should be scoped locally or globally:
    - GLOBAL / ACCOUNT-WIDE: If the keyword is a competitor, a wrong geographic region, an out-of-scope service, or a low-intent word (like "jobs"), it should be blocked across ALL campaigns in the account.
    - LOCAL / CAMPAIGN-SPECIFIC: If the term is only wasteful for the specific campaign it appeared in, keep the original "campaignId" and "campaignName" from the search term report.

    Response MUST be a JSON object containing a "suggestions" key with an array of suggestions matching this exact TypeScript structure:
    interface SuggestionsResponse {
        suggestions: Array<{
            keyword: string;                               // The suggested negative keyword itself (do not include quotes or brackets, just the raw text)
            matchType: 'broad' | 'phrase' | 'exact';       // The recommended match type for the negative keyword
            campaignId: string;                            // The campaign ID associated with the search term, or "ALL" for global/account-wide exclusions
            campaignName: string;                          // The campaign name associated with the search term, or "All Campaigns" for global/account-wide exclusions
            rationale: string;                             // A concise, professional marketing rationale for why this is waste
            searchQuery: string;                           // The original search query that triggered this recommendation
            clicks: number;                                // Original clicks
            impressions: number;                           // Original impressions
            spend: number;                                 // Original spend (in normal currency)
            conversions: number;                           // Original conversions
        }>;
    }
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: { responseMimeType: "application/json" },
    });

    const parsed = JSON.parse(response.text as string);
    return parsed.suggestions || [];
  } catch (error) {
    console.error("Gemini Negative Keywords Generation Error:", error);
    return [];
  }
}
