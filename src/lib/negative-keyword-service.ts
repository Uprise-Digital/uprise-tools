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
    Your task is to review a search terms report for a client and identify wasteful, irrelevant, or non-converting search queries that should be added as campaign-level negative keywords.
    
    CLIENT INFORMATION:
    - Name: ${clientName}
    ${websiteUrl ? `- Website: ${websiteUrl}` : ""}
    ${targetNotes ? `- Targeting/Business Notes: ${targetNotes}` : ""}
    
    CRITICAL RULE (BRAND SAFETY):
    Do NOT suggest adding the client's own brand name or any close variants of it as a negative keyword.
    Client Brand Name: "${clientName}"
    
    EXISTING NEGATIVE KEYWORDS (Already excluded, do not suggest these):
    ${existingNegatives.slice(0, 100).join(", ") || "None"}
    
    SEARCH TERMS DATA TO EVALUATE:
    ${JSON.stringify(filteredSearchTerms, null, 2)}
    
    GUIDELINES FOR NEGATIVE KEYWORD MATCH TYPES:
    - Use "exact" match if a specific search query is highly specific and wastes money, but other variants might be useful.
    - Use "phrase" match (highly recommended) to block bad concepts or modifiers (e.g. if the query is "free plumbing help", block the phrase "free" or "help").
    - Use "broad" match sparingly, only for words that are 100% irrelevant to the client's business (e.g., job/career-seeking terms like "jobs", "hiring", "resume" for a service provider).
    - Suggest the most specific, high-leverage keyword to block. For instance, if the search term is "plumbing jobs in melbourne", suggest adding "jobs" as a phrase/broad match rather than the entire search query, unless you only want to block that exact term.
    
    TASK:
    Analyze the search terms. Identify search queries that:
    1. Are completely irrelevant to what the client sells/services.
    2. Have high click volume and high spend but ZERO or extremely low conversions.
    3. Represent low-intent actions (e.g., "free", "diy", "jobs", "careers", "course", "meaning of", "wiki").
    
    Response MUST be a JSON object containing a "suggestions" key with an array of suggestions matching this exact TypeScript structure:
    interface SuggestionsResponse {
        suggestions: Array<{
            keyword: string;                               // The suggested negative keyword itself (do not include quotes or brackets, just the raw text)
            matchType: 'broad' | 'phrase' | 'exact';       // The recommended match type for the negative keyword
            campaignId: string;                            // The campaign ID associated with the search term
            campaignName: string;                          // The campaign name associated with the search term
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
