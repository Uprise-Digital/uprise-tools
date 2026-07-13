/* biome-ignore-all lint/suspicious/noExplicitAny: mocked types */
import { afterAll, beforeAll, vi } from "vitest";

// ============================================================================
// 1. MOCK NEXT.JS HEADERS AND AUTH
// ============================================================================
vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Map()),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: vi.fn().mockResolvedValue({
        user: {
          id: "test-user-id",
          name: "Test User",
          email: "test@uprise.com",
        },
      }),
    },
  },
}));

// ============================================================================
// 2. MOCK DRIZZLE DATABASE INSTANCE
// ============================================================================
const mockDbQuery = {
  adAccounts: {
    findFirst: vi.fn().mockResolvedValue({
      id: 1,
      googleAccountId: "123-456-7890",
      name: "Test Trade Account",
      websiteUrl: "https://test-client.com.au",
    }),
    findMany: vi
      .fn()
      .mockResolvedValue([
        { id: 1, googleAccountId: "123-456-7890", name: "Test Trade Account" },
      ]),
  },
  campaignLandingPages: {
    findMany: vi.fn().mockResolvedValue([
      {
        id: 10,
        campaignId: "camp-1",
        campaignName: "Plumbing Campaign",
        url: "https://test-client.com.au/plumbing",
        updatedAt: new Date(),
      },
    ]),
    findFirst: vi.fn().mockResolvedValue({
      id: 10,
      campaignId: "camp-1",
      campaignName: "Plumbing Campaign",
      url: "https://test-client.com.au/plumbing",
    }),
  },
  landingPageAudits: {
    findMany: vi
      .fn()
      .mockResolvedValue([
        { id: 100, campaignId: "camp-1", score: 85, createdAt: new Date() },
      ]),
    findFirst: vi.fn().mockResolvedValue({
      id: 100,
      campaignId: "camp-1",
      score: 85,
      createdAt: new Date(),
      heroScore: 8,
      ctaScore: 9,
      searchTerm: "emergency plumber",
      url: "https://test-client.com.au/plumbing",
      aiAnalysis: {
        overall_score: 85,
        scores: { hero: 8, cta: 9 },
        client_action_script: "Mock action script",
        competitors: [],
        top_ideas: [],
        quick_wins: [],
        roadmap: {},
      },
      account: { name: "Test Trade Account" },
    }),
  },
  negativeKeywordSuggestions: {
    findMany: vi.fn().mockResolvedValue([
      {
        id: 1,
        adAccountId: 1,
        keyword: "free",
        matchType: "phrase",
        status: "pending",
        campaignId: "camp-1",
        campaignName: "Plumbing Campaign",
        account: { googleAccountId: "123-456-7890" },
      },
    ]),
    findFirst: vi.fn().mockResolvedValue({
      id: 1,
      adAccountId: 1,
      keyword: "free",
      matchType: "phrase",
      status: "pending",
      campaignId: "camp-1",
      campaignName: "Plumbing Campaign",
      account: { googleAccountId: "123-456-7890" },
    }),
  },
  accountTriageSettings: {
    findFirst: vi.fn().mockResolvedValue({
      id: 1,
      adAccountId: 1,
      criticalSpendThreshold: 70,
    }),
    findMany: vi
      .fn()
      .mockResolvedValue([
        { id: 1, adAccountId: 1, criticalSpendThreshold: 70 },
      ]),
  },
  orgTriageDefaults: {
    findFirst: vi.fn().mockResolvedValue({
      id: 1,
      criticalSpendThreshold: 70,
    }),
  },
  briefingSettings: {
    findFirst: vi.fn().mockResolvedValue({
      id: 1,
      recipients: ["admin@uprise.com"],
      sendTime: "07:00",
      dataPoints: {},
      isActive: true,
    }),
  },
  adPerformanceDaily: {
    findMany: vi.fn().mockResolvedValue([
      {
        id: 1,
        adAccountId: 1,
        date: new Date(),
        campaignId: "camp-1",
        campaignName: "Plumbing Campaign",
        spend: "100.00",
        impressions: 1000,
        clicks: 100,
        conversions: "10.00",
      },
    ]),
  },
  adGroupAdAudits: {
    findMany: vi.fn().mockResolvedValue([
      {
        id: 1,
        adAccountId: 1,
        campaignId: "camp-1",
        campaignName: "Plumbing Campaign",
        adGroupId: "adgroup-1",
        adGroupName: "AdGroup 1",
        adId: "ad-1",
        searchTerm: "emergency plumber",
        score: 85,
        adStrength: "GOOD",
        messageMatchScore: 90,
        aiAnalysis: {
          overall_score: 85,
          message_match_score: 90,
          ad_strength_analysis: "Critique",
          copy_relevance_breakdown: {
            headlines: { pro: ["Good"], con: ["Weak"], fix: "Add more" },
            descriptions: { pro: ["Good"], con: ["Weak"], fix: "Add more" },
          },
          pinning_analysis: { issues: [], recommendations: [] },
          missing_signals: {
            price_hooks: [],
            speed_urgency: [],
            trust_guarantees: [],
          },
          competitors: [],
          roadmap: {
            headlines_to_add: [],
            descriptions_to_add: [],
            pins_to_adjust: [],
          },
          client_action_script: "Mock script",
        },
        createdAt: new Date(),
      },
    ]),
    findFirst: vi.fn().mockResolvedValue({
      id: 1,
      adAccountId: 1,
      campaignId: "camp-1",
      campaignName: "Plumbing Campaign",
      adGroupId: "adgroup-1",
      adGroupName: "AdGroup 1",
      adId: "ad-1",
      searchTerm: "emergency plumber",
      score: 85,
      adStrength: "GOOD",
      messageMatchScore: 90,
      aiAnalysis: {
        overall_score: 85,
        message_match_score: 90,
        ad_strength_analysis: "Critique",
        copy_relevance_breakdown: {
          headlines: { pro: ["Good"], con: ["Weak"], fix: "Add more" },
          descriptions: { pro: ["Good"], con: ["Weak"], fix: "Add more" },
        },
        pinning_analysis: { issues: [], recommendations: [] },
        missing_signals: {
          price_hooks: [],
          speed_urgency: [],
          trust_guarantees: [],
        },
        competitors: [],
        roadmap: {
          headlines_to_add: [],
          descriptions_to_add: [],
          pins_to_adjust: [],
        },
        client_action_script: "Mock script",
      },
      createdAt: new Date(),
      account: { name: "Test Trade Account" },
    }),
  },
};

vi.mock("@/db", () => {
  const mockExecutor = {
    execute: vi.fn().mockResolvedValue(true),
    query: mockDbQuery,
    select: vi.fn(),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn().mockResolvedValue([{ id: 1 }]),
        onConflictDoNothing: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 1 }]),
        }),
        onConflictDoUpdate: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 1 }]),
        }),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn().mockResolvedValue([{ id: 1 }]),
      })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn().mockResolvedValue(true),
    })),
  };

  return {
    db: {
      ...mockExecutor,
      transaction: vi.fn(async (cb) => {
        return await cb(mockExecutor);
      }),
    },
  };
});

// ============================================================================
// 3. MOCK GEMINI GOOGLE GENAI CLIENT
// ============================================================================
vi.mock("@google/genai", () => {
  return {
    GoogleGenAI: vi.fn().mockImplementation(function () {
      return {
        models: {
          generateContent: vi.fn().mockImplementation(async (args?: any) => {
            const prompt = args?.contents || "";
            if (prompt.includes("AD HEADLINES AUDITED")) {
              return {
                text: JSON.stringify({
                  search_intent_score: 9,
                  landing_page_match_score: 9,
                  ad_strength_score: 8,
                  pinning_score: 6,
                  copy_triggers_score: 8,
                  overall_score: 85,
                  message_match_score: 90,
                  ad_strength_analysis: "Critique",
                  copy_relevance_breakdown: {
                    headlines: {
                      pro: ["Good"],
                      con: ["Weak"],
                      fix: "Add more",
                    },
                    descriptions: {
                      pro: ["Good"],
                      con: ["Weak"],
                      fix: "Add more",
                    },
                  },
                  pinning_analysis: { issues: [], recommendations: [] },
                  missing_signals: {
                    price_hooks: [],
                    speed_urgency: [],
                    trust_guarantees: [],
                  },
                  competitors: [],
                  roadmap: {
                    headlines_to_add: [],
                    descriptions_to_add: [],
                    pins_to_adjust: [],
                  },
                  client_action_script: "Mock script",
                }),
              };
            }
            if (
              prompt.includes("Morning Briefing") ||
              prompt.includes("morning briefing")
            ) {
              return {
                text: JSON.stringify({
                  subject: "☀️ Morning Briefing — Thursday 26 June 2026",
                  macroSummary:
                    "Yesterday spend was highly efficient with solid conversions.",
                  whaleAnalysisCommentary:
                    "Test Trade Account accounted for 100% of all spend yesterday.",
                  alerts: [],
                  zeroConversionFootnote: "None.",
                  successes: [
                    {
                      accountName: "Test Trade Account",
                      statsText: "CPA of AUD $10.00",
                      details: "Excellent CPA yesterday.",
                    },
                  ],
                  priorityList: ["Review campaign status."],
                }),
              };
            }
            return {
              text: JSON.stringify({
                // Landing Page Audit fields
                overall_score: 85,
                scores: {
                  hero: 8,
                  cta: 9,
                  trust: 8,
                  mobile: 8,
                  copy: 8,
                  seo: 9,
                  design: 8,
                  flow: 8,
                  market_fit: 8,
                  tech: 8,
                },
                breakdown: {
                  hero: {
                    working: ["Clear hook"],
                    missing: ["Generic sub"],
                    fix: "Update sub headline",
                  },
                },
                client_action_script:
                  "Please change the hero above the fold copy.",
                competitors: [
                  {
                    name: "Best Competitor",
                    url: "https://best-competitor.com.au",
                    score: 9,
                    pros: [],
                    cons: [],
                    takeaway: "Match offer",
                  },
                ],
                top_ideas: [
                  {
                    idea: "Add reviews",
                    why: "Improves trust",
                    effort: "Easy",
                    impact: "High",
                  },
                ],
                quick_wins: ["Add trust badge"],
                roadmap: {
                  week1: ["Fix phone number"],
                },
              }),
            };
          }),
        },
      };
    }),
  };
});

// ============================================================================
// 4. MOCK GOOGLE ADS UTILITIES & AUDIT LOGS
// ============================================================================
vi.mock("@/lib/google-ads", () => ({
  fetchCampaignLandingPages: vi.fn().mockResolvedValue([
    {
      campaignId: "camp-1",
      campaignName: "Plumbing Campaign",
      url: "https://test-client.com.au/plumbing",
    },
  ]),
  fetchTopClientLandingPage: vi
    .fn()
    .mockResolvedValue("https://test-client.com.au/plumbing"),
  fetchTopNonBrandedSearchTerm: vi
    .fn()
    .mockResolvedValue("emergency plumber sydney"),
  fetchMCCAccounts: vi.fn().mockResolvedValue({
    results: [
      {
        customerClient: {
          id: "123-456-7890",
          descriptiveName: "Client A",
          status: "ENABLED",
          currencyCode: "AUD",
          timeZone: "Australia/Melbourne",
        },
      },
    ],
  }),
  addCampaignNegativeKeyword: vi.fn().mockResolvedValue(true),
  fetchAccountCampaigns: vi
    .fn()
    .mockResolvedValue([{ id: "camp-1", name: "Plumbing Campaign" }]),
  fetchActiveNegativeKeywords: vi.fn().mockResolvedValue([]),
  fetchSearchTermsReport: vi.fn().mockResolvedValue([]),
  fetchImpressionShareReport: vi.fn().mockResolvedValue([
    {
      campaignId: "camp-1",
      campaignName: "Plumbing Campaign",
      advertisingChannelType: "SEARCH",
      isPMax: false,
      searchImpressionShare: "65%",
      searchRankLostImpressionShare: "15%",
      searchBudgetLostImpressionShare: "20%",
      searchTopImpressionShare: "50%",
      searchAbsoluteTopImpressionShare: "30%",
      parsedMetrics: {
        searchImpressionShare: 65,
        searchRankLostImpressionShare: 15,
        searchBudgetLostImpressionShare: 20,
        searchTopImpressionShare: 50,
        searchAbsoluteTopImpressionShare: 30,
      },
      flag: "budget-constrained",
    },
    {
      campaignId: "camp-pmax",
      campaignName: "PMax Sydney",
      advertisingChannelType: "PERFORMANCE_MAX",
      isPMax: true,
      searchImpressionShare: "--",
      searchRankLostImpressionShare: "--",
      searchBudgetLostImpressionShare: "--",
      searchTopImpressionShare: "--",
      searchAbsoluteTopImpressionShare: "--",
      parsedMetrics: {
        searchImpressionShare: 0,
        searchRankLostImpressionShare: 0,
        searchBudgetLostImpressionShare: 0,
        searchTopImpressionShare: 0,
        searchAbsoluteTopImpressionShare: 0,
      },
      flag: "notAvailable",
    },
  ]),
  fetchConversionTrackingAudit: vi.fn().mockResolvedValue({
    hasSpendInLast14Days: true,
    actions: [
      {
        id: "action-1",
        name: "Lead Form Submission",
        status: "ENABLED",
        countingType: "MANY_PER_CLICK",
        primaryForGoal: true,
        category: "SUBMIT_LEAD_FORM",
        type: "WEBSITE",
        lastConversionDate: "2026-07-01",
        daysSinceLastConversion: 7,
      },
      {
        id: "action-2",
        name: "Phone Call Click",
        status: "ENABLED",
        countingType: "ONE_PER_INTERACTION",
        primaryForGoal: true,
        category: "SUBMIT_LEAD_FORM",
        type: "WEBSITE",
        lastConversionDate: null,
        daysSinceLastConversion: null,
      },
    ],
  }),
  fetchAdGroupAds: vi.fn().mockResolvedValue([
    {
      campaignId: "camp-1",
      campaignName: "Plumbing Campaign",
      adGroupId: "adgroup-1",
      adGroupName: "AdGroup 1",
      adId: "ad-1",
      adStrength: "GOOD",
      approvalStatus: "APPROVED",
      finalUrl: "https://test-client.com.au/plumbing",
      headlines: [
        { text: "Headline 1", pinnedField: "HEADLINE_1" },
        { text: "Headline 2", pinnedField: "HEADLINE_2" },
      ],
      descriptions: [{ text: "Description 1", pinnedField: "UNSPECIFIED" }],
    },
  ]),
  fetchAdGroupAdAssetPerformance: vi.fn().mockResolvedValue([
    {
      adGroupAd: "customers/1/adGroupAds/adgroup-1~ad-1",
      adId: "ad-1",
      fieldType: "HEADLINE",
      performanceLabel: "BEST",
      pinnedField: "HEADLINE_1",
      assetId: "asset-1",
      text: "Headline 1",
    },
    {
      adGroupAd: "customers/1/adGroupAds/adgroup-1~ad-1",
      adId: "ad-1",
      fieldType: "HEADLINE",
      performanceLabel: "LOW",
      pinnedField: "HEADLINE_2",
      assetId: "asset-2",
      text: "Headline 2",
    },
    {
      adGroupAd: "customers/1/adGroupAds/adgroup-1~ad-1",
      adId: "ad-1",
      fieldType: "DESCRIPTION",
      performanceLabel: "GOOD",
      pinnedField: "UNSPECIFIED",
      assetId: "asset-3",
      text: "Description 1",
    },
  ]),
}));

vi.mock("@/lib/audit", () => ({
  logAction: vi.fn().mockResolvedValue(true),
  logEmail: vi.fn().mockResolvedValue(true),
}));

// ============================================================================
// 5. MOCK RESEND EMAIL CLIENT
// ============================================================================
vi.mock("resend", () => {
  return {
    Resend: vi.fn().mockImplementation(function () {
      return {
        emails: {
          send: vi.fn().mockResolvedValue({
            data: { id: "mock-email-id-999" },
            error: null,
          }),
        },
      };
    }),
  };
});

// ============================================================================
// 6. GLOBAL FETCH INTERCEPTOR FOR HTTP SCRAPING
// ============================================================================
const originalFetch = global.fetch;

beforeAll(() => {
  global.fetch = vi.fn().mockImplementation((url: string, _init?: any) => {
    if (url.includes("google.serper.dev")) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            ads: [{ link: "https://competitor-ad.com.au" }],
            organic: [
              {
                link: "https://competitor-organic.com.au",
                title: "Organic competitor",
              },
            ],
          }),
      } as any);
    }
    if (url.includes("api.scrape.do")) {
      return Promise.resolve({
        ok: true,
        text: () =>
          Promise.resolve(
            "<html><body><h1>Emergency Plumber Gold Coast</h1><p>Master plumbers since 2005</p></body></html>",
          ),
      } as any);
    }
    return Promise.resolve({
      ok: true,
      text: () => Promise.resolve(""),
      json: () => Promise.resolve({}),
    } as any);
  });
});

afterAll(() => {
  global.fetch = originalFetch;
});
