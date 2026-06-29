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

interface GenerateSuggestionsInput {
  clientName: string;
  websiteUrl?: string | null;
  targetNotes?: string | null;
  searchTerms: SearchTermInput[];
  existingNegatives: string[];
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
  searchTerms,
  existingNegatives,
}: GenerateSuggestionsInput): Promise<NegativeKeywordSuggestionOutput[]> {
  if (searchTerms.length === 0) {
    return [];
  }

  // Filter out any search terms that exactly match existing negative keywords
  const activeNegativesSet = new Set(
    existingNegatives.map((kw) => kw.toLowerCase().trim()),
  );
  const filteredSearchTerms = searchTerms.filter(
    (term) => !activeNegativesSet.has(term.query.toLowerCase().trim()),
  );

  if (filteredSearchTerms.length === 0) {
    return [];
  }

  // Construct prompt
  const prompt = `
    You are an elite Google Ads Performance Director at Uprise Digital.
    Your task is to review a search terms report for a client and identify wasteful, irrelevant, or non-converting search queries that should be added as campaign-level or account-wide negative keywords.
    
    CLIENT INFORMATION:
    - Name: ${clientName}
    ${websiteUrl ? `- Website: ${websiteUrl}` : ""}
    ${targetNotes ? `- Targeting/Business Notes: ${targetNotes}` : ""}
    
    CRITICAL RULE (BRAND SAFETY):
    Do NOT suggest adding the client's own brand name or any close variants of it as a negative keyword.
    Client Brand Name: "${clientName}"
    
    EXISTING NEGATIVE KEYWORDS (Already excluded, do not suggest these):
    ${existingNegatives.slice(0, 150).join(", ") || "None"}
    
    SEARCH TERMS DATA TO EVALUATE:
    ${JSON.stringify(filteredSearchTerms, null, 2)}
    
    EVALUATION INSTRUCTIONS (BE EXTRA THOROUGH):
    You must evaluate EVERY SINGLE query in the list, not just the top spenders. Run an exhaustive pass over all terms.
    Identify and flag the following waste categories:
    1. Competitor Brands: Any query referencing other local/national companies, contractors, or specific brand names (e.g. "napoli", "walsh", "cj duncan", "delic construction", "burgess earthmoving", "atv civil", "terra civil", "aademex", "trazlbat", "amj demolition", "star demolition", "max demolition", etc.).
    2. Geographic Waste: Any query targeting a region outside the client's service area (e.g. if the client operates on the East Coast of Australia, queries containing "perth", "western australia", "adelaide", "wa" are waste).
    3. Research/Informational Intent: Queries searching for "average costs", "prices", "website", "website builders", "meaning", "wikipedia", "definition", "how to", "courses", or "diy".
    4. Out-of-Scope Services: Queries seeking services the client does NOT provide (e.g. if the client does commercial/structural demolition contracting, queries for "pool removal", "fibreglass pool removal", "diy rental", "equipment hire", "excavator hire" are out-of-scope).
    5. Employment/Job-Seekers: Queries containing "jobs", "careers", "resume", "hiring", "salary".

    MATCH TYPE STRATEGY:
    You must choose the recommended negative match type based on these strict guidelines:
    - BROAD Match: Use ONLY for single, universally wasteful terms that indicate 100% wrong intent across the board (e.g. "jobs", "hire", "rental", "diy", "courses", "classes", "resume").
    - PHRASE Match: Use for competitor names (e.g. "walsh", "napoli") and specific geographic cities/states outside the service area (e.g. "perth", "gold coast", "canberra"). This prevents queries like "perth demolition contractors" from triggering ads.
    - EXACT Match: Use for queries that are close to the target service but are wasteful in this exact context (e.g., "[trench excavation meaning]" or "[fibreglass pool removal]"). This blocks the specific wasted search while protecting broad terms.
    
    CAMPAIGN SCOPE (CROSS-CAMPAIGN REASONING):
    For each wasteful term, you must determine if the exclusion should be scoped locally or globally:
    - GLOBAL / ACCOUNT-WIDE: If the keyword is a competitor, a wrong geographic region, an out-of-scope service, or a low-intent word (like "jobs"), it should be blocked across ALL campaigns in the account.
      For global suggestions, set "campaignId" to "ALL" and "campaignName" to "All Campaigns".
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
