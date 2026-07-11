const DEVELOPER_TOKEN = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
const MANAGER_ID = process.env.GOOGLE_ADS_MANAGER_ID;

// --- Date Helper Functions ---

/**
 * Returns the correct GAQL date segment for the current query.
 */
export function getCurrentPeriodDateClause(
  startDate?: string,
  endDate?: string,
) {
  if (startDate && endDate) {
    // Ensure strictly YYYY-MM-DD format, stripping out time components
    const cleanStart = startDate.split("T")[0].trim();
    const cleanEnd = endDate.split("T")[0].trim();
    return `segments.date BETWEEN '${cleanStart}' AND '${cleanEnd}'`;
  }
  return "segments.date DURING THIS_MONTH";
}

/**
 * Calculates the previous period of the exact same length to ensure accurate comparison metrics.
 * Safely parses YYYY-MM-DD to avoid timezone offset bugs.
 */
export function getPreviousPeriodDateClause(
  startDate?: string,
  endDate?: string,
) {
  if (!startDate || !endDate) return "segments.date DURING LAST_MONTH";

  const cleanStart = startDate.split("T")[0].trim();
  const cleanEnd = endDate.split("T")[0].trim();

  const parseDate = (str: string) => {
    const [y, m, d] = str.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d));
  };

  const start = parseDate(cleanStart);
  const end = parseDate(cleanEnd);

  // Calculate duration in days
  const diffTime = end.getTime() - start.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  // Previous period end is 1 day before current start
  const prevEnd = new Date(start.getTime());
  prevEnd.setUTCDate(prevEnd.getUTCDate() - 1);

  // Previous period start is X days before previous end
  const prevStart = new Date(prevEnd.getTime());
  prevStart.setUTCDate(prevStart.getUTCDate() - diffDays);

  const formatYMD = (d: Date) => d.toISOString().split("T")[0];

  return `segments.date BETWEEN '${formatYMD(prevStart)}' AND '${formatYMD(prevEnd)}'`;
}

// --- API Functions ---

// --- Helper: Exchange refresh token for a fresh 60-minute access token ---
async function refreshAccessToken(refreshToken: string) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const data = await response.json();
  if (data.error) {
    throw new Error(
      `Failed to refresh token: ${data.error_description || data.error}`,
    );
  }
  return data.access_token as string;
}

export async function getManagementAccessToken(): Promise<{
  accessToken: string;
  managerCustomerId: string;
}> {
  // 1. Try to get credentials from active session organization connection
  try {
    const { auth } = await import("@/lib/auth");
    const { headers } = await import("next/headers");
    const { db } = await import("@/db");
    const { googleAdsConnections, member } = await import("@/db/schema");
    const { eq } = await import("drizzle-orm");
    const { decryptToken } = await import("@/lib/crypto");

    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (session) {
      const activeOrgId = session.session.activeOrganizationId;
      let conn: any = null;

      if (activeOrgId) {
        conn = await db.query.googleAdsConnections.findFirst({
          where: eq(googleAdsConnections.organizationId, activeOrgId),
        });
      }

      if (!conn) {
        // Fallback to first member organization
        const userMember = await db.query.member.findFirst({
          where: eq(member.userId, session.user.id),
        });
        if (userMember) {
          conn = await db.query.googleAdsConnections.findFirst({
            where: eq(
              googleAdsConnections.organizationId,
              userMember.organizationId,
            ),
          });
        }
      }

      if (conn && conn.status === "active") {
        const decToken = decryptToken(conn.refreshToken);
        const accessToken = await refreshAccessToken(decToken);
        return {
          accessToken,
          managerCustomerId: conn.managerCustomerId.replace(/-/g, ""),
        };
      }
    }
  } catch (e) {
    // Ignore headers/session errors when run outside of request contexts
  }

  // 2. Default fallback to environment variables
  const refreshToken = process.env.GOOGLE_ADS_REFRESH_TOKEN;
  if (!refreshToken) {
    throw new Error(
      "CRITICAL: Missing GOOGLE_ADS_REFRESH_TOKEN in environment variables.",
    );
  }
  const accessToken = await refreshAccessToken(refreshToken);
  return {
    accessToken,
    managerCustomerId: (process.env.GOOGLE_ADS_MANAGER_ID || "").replace(
      /-/g,
      "",
    ),
  };
}

export async function fetchMCCAccounts() {
  const { accessToken, managerCustomerId } = await getManagementAccessToken();
  const sanitizedManagerId = MANAGER_ID?.replace(/-/g, "");
  const url = `https://googleads.googleapis.com/v23/customers/${sanitizedManagerId}/googleAds:search`;

  const query = `
        SELECT
            customer_client.id,
            customer_client.descriptive_name,
            customer_client.currency_code,
            customer_client.time_zone,
            customer_client.status
        FROM customer_client
        WHERE customer_client.level <= 1
    `;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "developer-token": DEVELOPER_TOKEN!,
      Authorization: `Bearer ${accessToken}`,
      "login-customer-id": managerCustomerId,
    },
    body: JSON.stringify({ query }),
  });

  const data = await response.json();
  if (data.error)
    throw new Error(`Google Ads API Error: ${data.error.message}`);

  return data;
}

export async function fetchAccountMonthlySummary(
  googleAccountId: string,
  startDate?: string,
  endDate?: string,
) {
  const { accessToken, managerCustomerId } = await getManagementAccessToken();
  const sanitizedId = googleAccountId.replace(/-/g, "");
  const dateClause = getCurrentPeriodDateClause(startDate, endDate);

  const query = `
        SELECT
            metrics.cost_micros,
            metrics.clicks,
            metrics.impressions,
            metrics.ctr,
            metrics.average_cpc,
            metrics.conversions,
            metrics.cost_per_conversion,
            campaign.name
        FROM campaign
        WHERE ${dateClause}
          AND campaign.status = 'ENABLED'
    `;

  const response = await fetch(
    `https://googleads.googleapis.com/v23/customers/${sanitizedId}/googleAds:search`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "developer-token": DEVELOPER_TOKEN!,
        Authorization: `Bearer ${accessToken}`,
        "login-customer-id": managerCustomerId,
      },
      body: JSON.stringify({ query }),
    },
  );

  const data = await response.json();

  if (data.error) {
    console.error(
      "[GAQL Error - Summary]",
      JSON.stringify(data.error, null, 2),
    );
    throw new Error(`Summary Query Failed: ${data.error.message}`);
  }

  return data.results || [];
}

export async function fetchAccountKeywords(
  googleAccountId: string,
  startDate?: string,
  endDate?: string,
) {
  const { accessToken, managerCustomerId } = await getManagementAccessToken();
  const sanitizedId = googleAccountId.replace(/-/g, "");
  const dateClause = getCurrentPeriodDateClause(startDate, endDate);

  const query = `
        SELECT
            ad_group_criterion.keyword.text,
            ad_group_criterion.keyword.match_type,
            metrics.impressions,
            metrics.clicks,
            metrics.ctr,
            metrics.average_cpc,
            metrics.cost_micros,
            metrics.conversions,
            metrics.cost_per_conversion
        FROM keyword_view
        WHERE ${dateClause}
          AND ad_group_criterion.status = 'ENABLED'
        ORDER BY metrics.cost_micros DESC
            LIMIT 15
    `;

  const response = await fetch(
    `https://googleads.googleapis.com/v23/customers/${sanitizedId}/googleAds:search`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "developer-token": DEVELOPER_TOKEN!,
        Authorization: `Bearer ${accessToken}`,
        "login-customer-id": managerCustomerId,
      },
      body: JSON.stringify({ query }),
    },
  );

  const data = await response.json();

  if (data.error) {
    console.error(
      "[GAQL Error - Keywords]",
      JSON.stringify(data.error, null, 2),
    );
    throw new Error(`Keywords Query Failed: ${data.error.message}`);
  }

  return data.results || [];
}

export async function fetchAccountLastMonthSummary(
  googleAccountId: string,
  startDate?: string,
  endDate?: string,
) {
  const { accessToken, managerCustomerId } = await getManagementAccessToken();
  const sanitizedId = googleAccountId.replace(/-/g, "");
  const dateClause = getPreviousPeriodDateClause(startDate, endDate);

  const query = `
        SELECT
            metrics.cost_micros,
            metrics.clicks,
            metrics.impressions,
            metrics.conversions
        FROM customer
        WHERE ${dateClause}
    `;

  const response = await fetch(
    `https://googleads.googleapis.com/v23/customers/${sanitizedId}/googleAds:search`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "developer-token": DEVELOPER_TOKEN!,
        Authorization: `Bearer ${accessToken}`,
        "login-customer-id": managerCustomerId,
      },
      body: JSON.stringify({ query }),
    },
  );

  const data = await response.json();

  if (data.error) {
    console.error(
      "[GAQL Error - Previous Period]",
      JSON.stringify(data.error, null, 2),
    );
    throw new Error(`Previous Period Query Failed: ${data.error.message}`);
  }

  return data.results?.[0]?.metrics || null;
}

export async function fetchDailyCampaignData(
  googleAccountId: string,
  startDate: string,
  endDate: string,
) {
  const { accessToken, managerCustomerId } = await getManagementAccessToken();
  const sanitizedId = googleAccountId.replace(/-/g, "");

  // We add metrics.cost_micros and ensure segments.date is handled correctly
  const query = `
        SELECT
            campaign.id,
            campaign.name,
            segments.date,
            metrics.cost_micros,
            metrics.impressions,
            metrics.clicks,
            metrics.conversions
        FROM campaign
        WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
    `;

  const response = await fetch(
    `https://googleads.googleapis.com/v23/customers/${sanitizedId}/googleAds:search`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "developer-token": process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
        Authorization: `Bearer ${accessToken}`,
        "login-customer-id": managerCustomerId,
      },
      body: JSON.stringify({ query }),
    },
  );

  const data = await response.json();

  // DEBUG: Look at this in your terminal output
  console.log(
    "DEBUG Google Ads Raw Response:",
    JSON.stringify(data.results[0], null, 2),
  );

  if (data.error) throw new Error(`Query Failed: ${data.error.message}`);

  return data.results || [];
}

/**
 * Fetches the specific landing page URL the client is currently spending the most money on.
 */
export async function fetchTopClientLandingPage(
  googleAccountId: string,
): Promise<string | null> {
  const { accessToken, managerCustomerId } = await getManagementAccessToken();
  const sanitizedId = googleAccountId.replace(/-/g, "");

  const query = `
        SELECT 
            ad_group_ad.ad.final_urls, 
            metrics.cost_micros 
        FROM ad_group_ad 
        WHERE segments.date DURING LAST_30_DAYS 
        ORDER BY metrics.cost_micros DESC 
        LIMIT 1
    `;

  try {
    const response = await fetch(
      `https://googleads.googleapis.com/v23/customers/${sanitizedId}/googleAds:search`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "developer-token": process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
          Authorization: `Bearer ${accessToken}`,
          "login-customer-id": managerCustomerId,
        },
        body: JSON.stringify({ query }),
      },
    );

    const data = await response.json();

    if (data.error) {
      console.error(
        "[GAQL Error - Landing Page]",
        JSON.stringify(data.error, null, 2),
      );
      return null;
    }

    if (data.results && data.results.length > 0) {
      // Google returns final_urls as an array of strings. We grab the first one.
      const urls = data.results[0].adGroupAd?.ad?.finalUrls;
      if (urls && urls.length > 0) {
        return urls[0];
      }
    }

    return null;
  } catch (error) {
    console.error(
      `Failed to fetch top landing page for ${googleAccountId}:`,
      error,
    );
    return null;
  }
}

/**
 * Fetches the highest-spend search term, attempting to filter out branded terms.
 */
export async function fetchTopNonBrandedSearchTerm(
  googleAccountId: string,
  brandName: string,
): Promise<string | null> {
  const { accessToken, managerCustomerId } = await getManagementAccessToken();
  const sanitizedId = googleAccountId.replace(/-/g, "");

  // We use search_term_view because it shows what humans actually typed
  const query = `
        SELECT 
            search_term_view.search_term, 
            metrics.cost_micros 
        FROM search_term_view 
        WHERE segments.date DURING LAST_30_DAYS 
        ORDER BY metrics.cost_micros DESC 
        LIMIT 10
    `;

  try {
    const response = await fetch(
      `https://googleads.googleapis.com/v23/customers/${sanitizedId}/googleAds:search`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "developer-token": process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
          Authorization: `Bearer ${accessToken}`,
          "login-customer-id": managerCustomerId,
        },
        body: JSON.stringify({ query }),
      },
    );

    const data = await response.json();

    if (data.results && data.results.length > 0) {
      const brandNameLower = brandName.toLowerCase().split(" ")[0]; // Basic filter using first word of brand

      // Find the first search term that doesn't contain the brand name
      for (const row of data.results) {
        const term = row.searchTermView?.searchTerm;
        if (term && !term.toLowerCase().includes(brandNameLower)) {
          return term; // Found the top non-branded money bleeder!
        }
      }

      // Fallback if everything looks branded
      return data.results[0].searchTermView?.searchTerm;
    }

    return null;
  } catch (error) {
    console.error(
      `Failed to fetch top search term for ${googleAccountId}:`,
      error,
    );
    return null;
  }
}

/**
 * Fetches all campaign-level active negative keywords.
 */
export async function fetchActiveNegativeKeywords(googleAccountId: string) {
  const { accessToken, managerCustomerId } = await getManagementAccessToken();
  const sanitizedId = googleAccountId.replace(/-/g, "");

  const query = `
        SELECT
            campaign.id,
            campaign.name,
            campaign_criterion.criterion_id,
            campaign_criterion.keyword.text,
            campaign_criterion.keyword.match_type
        FROM campaign_criterion
        WHERE campaign_criterion.negative = TRUE
          AND campaign_criterion.type = 'KEYWORD'
    `;

  const response = await fetch(
    `https://googleads.googleapis.com/v23/customers/${sanitizedId}/googleAds:search`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "developer-token": DEVELOPER_TOKEN!,
        Authorization: `Bearer ${accessToken}`,
        "login-customer-id": managerCustomerId,
      },
      body: JSON.stringify({ query }),
    },
  );

  const data = await response.json();

  if (data.error) {
    console.error(
      "[GAQL Error - Active Negatives]",
      JSON.stringify(data.error, null, 2),
    );
    throw new Error(`Active Negatives Query Failed: ${data.error.message}`);
  }

  return data.results || [];
}

/**
 * Fetches all search terms that received clicks in the specified time period.
 */
export async function fetchSearchTermsReport(
  googleAccountId: string,
  startDate?: string,
  endDate?: string,
) {
  const { accessToken, managerCustomerId } = await getManagementAccessToken();
  const sanitizedId = googleAccountId.replace(/-/g, "");
  const dateClause = getCurrentPeriodDateClause(startDate, endDate);

  const query = `
        SELECT
            search_term_view.search_term,
            campaign.id,
            campaign.name,
            metrics.impressions,
            metrics.clicks,
            metrics.cost_micros,
            metrics.conversions
        FROM search_term_view
        WHERE ${dateClause}
          AND metrics.clicks > 0
        ORDER BY metrics.cost_micros DESC
    `;

  const response = await fetch(
    `https://googleads.googleapis.com/v23/customers/${sanitizedId}/googleAds:search`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "developer-token": DEVELOPER_TOKEN!,
        Authorization: `Bearer ${accessToken}`,
        "login-customer-id": managerCustomerId,
      },
      body: JSON.stringify({ query }),
    },
  );

  const data = await response.json();

  if (data.error) {
    console.error(
      "[GAQL Error - Search Terms]",
      JSON.stringify(data.error, null, 2),
    );
    throw new Error(`Search Terms Query Failed: ${data.error.message}`);
  }

  return data.results || [];
}

/**
 * Mutates campaign criteria to add a negative keyword to a specific campaign.
 */
export async function addCampaignNegativeKeyword(
  googleAccountId: string,
  campaignId: string,
  keywordText: string,
  matchType: string,
) {
  const { accessToken, managerCustomerId } = await getManagementAccessToken();
  const sanitizedId = googleAccountId.replace(/-/g, "");
  const formattedMatchType = matchType.toUpperCase();

  const url = `https://googleads.googleapis.com/v23/customers/${sanitizedId}/campaignCriteria:mutate`;

  const body = {
    operations: [
      {
        create: {
          campaign: `customers/${sanitizedId}/campaigns/${campaignId}`,
          type: "KEYWORD",
          negative: true,
          keyword: {
            text: keywordText,
            matchType: formattedMatchType,
          },
        },
      },
    ],
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "developer-token": DEVELOPER_TOKEN!,
      Authorization: `Bearer ${accessToken}`,
      "login-customer-id": managerCustomerId,
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();

  if (data.error) {
    console.error(
      "[Google Ads Mutate Error]",
      JSON.stringify(data.error, null, 2),
    );
    throw new Error(`Failed to add negative keyword: ${data.error.message}`);
  }

  return data;
}

/**
 * Fetches all active/enabled campaigns in the specified account.
 */
export async function fetchAccountCampaigns(googleAccountId: string) {
  const { accessToken, managerCustomerId } = await getManagementAccessToken();
  const sanitizedId = googleAccountId.replace(/-/g, "");

  const query = `
        SELECT
            campaign.id,
            campaign.name
        FROM campaign
        WHERE campaign.status = 'ENABLED'
    `;

  const response = await fetch(
    `https://googleads.googleapis.com/v23/customers/${sanitizedId}/googleAds:search`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "developer-token": DEVELOPER_TOKEN!,
        Authorization: `Bearer ${accessToken}`,
        "login-customer-id": managerCustomerId,
      },
      body: JSON.stringify({ query }),
    },
  );

  const data = await response.json();

  if (data.error) {
    console.error(
      "[GAQL Error - Account Campaigns]",
      JSON.stringify(data.error, null, 2),
    );
    throw new Error(`Account Campaigns Query Failed: ${data.error.message}`);
  }

  return (data.results || []).map((row: any) => ({
    id: row.campaign?.id || "",
    name: row.campaign?.name || "",
  }));
}

/**
 * Fetches all enabled campaigns and their corresponding final landing page URLs.
 */
export async function fetchCampaignLandingPages(googleAccountId: string) {
  const { accessToken, managerCustomerId } = await getManagementAccessToken();
  const sanitizedId = googleAccountId.replace(/-/g, "");

  const query = `
        SELECT
            campaign.id,
            campaign.name,
            campaign.status,
            ad_group_ad.ad.final_urls
        FROM ad_group_ad
        WHERE campaign.status IN ('ENABLED', 'PAUSED')
          AND ad_group_ad.status IN ('ENABLED', 'PAUSED')
    `;

  const response = await fetch(
    `https://googleads.googleapis.com/v23/customers/${sanitizedId}/googleAds:search`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "developer-token": DEVELOPER_TOKEN!,
        Authorization: `Bearer ${accessToken}`,
        "login-customer-id": managerCustomerId,
      },
      body: JSON.stringify({ query }),
    },
  );

  const data = await response.json();

  if (data.error) {
    console.error(
      "[GAQL Error - Campaign Landing Pages]",
      JSON.stringify(data.error, null, 2),
    );
    throw new Error(
      `Campaign Landing Pages Query Failed: ${data.error.message}`,
    );
  }

  // Parse results and group by campaign.id
  const campaignMap = new Map<
    string,
    { campaignId: string; campaignName: string; status: string; urls: string[] }
  >();

  for (const row of data.results || []) {
    const campaignId = row.campaign?.id || "";
    const campaignName = row.campaign?.name || "";
    const status = row.campaign?.status || "ENABLED";
    const urls = row.adGroupAd?.ad?.finalUrls || [];

    if (!campaignId) continue;

    if (!campaignMap.has(campaignId)) {
      campaignMap.set(campaignId, {
        campaignId,
        campaignName,
        status,
        urls: [],
      });
    }

    const item = campaignMap.get(campaignId)!;
    for (const url of urls) {
      if (url && !item.urls.includes(url)) {
        item.urls.push(url);
      }
    }
  }

  return Array.from(campaignMap.values()).map((item) => ({
    campaignId: item.campaignId,
    campaignName: item.campaignName,
    status: item.status,
    url: item.urls[0] || "", // Return the first final URL associated with the campaign
  }));
}

/**
 * Fetches search impression share metrics for Search campaigns.
 */
export async function fetchImpressionShareReport(
  googleAccountId: string,
  startDate?: string,
  endDate?: string,
  campaignId?: string,
) {
  const { accessToken, managerCustomerId } = await getManagementAccessToken();
  const sanitizedId = googleAccountId.replace(/-/g, "");
  const dateClause = getCurrentPeriodDateClause(startDate, endDate);

  let query = `
        SELECT
            campaign.id,
            campaign.name,
            campaign.advertising_channel_type,
            metrics.search_impression_share,
            metrics.search_rank_lost_impression_share,
            metrics.search_budget_lost_impression_share,
            metrics.search_top_impression_share,
            metrics.search_absolute_top_impression_share
        FROM campaign
        WHERE campaign.status = 'ENABLED'
          AND ${dateClause}
    `;

  if (campaignId) {
    query += ` AND campaign.id = ${campaignId}`;
  }

  const response = await fetch(
    `https://googleads.googleapis.com/v23/customers/${sanitizedId}/googleAds:search`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "developer-token": DEVELOPER_TOKEN!,
        Authorization: `Bearer ${accessToken}`,
        "login-customer-id": managerCustomerId,
      },
      body: JSON.stringify({ query }),
    },
  );

  const data = await response.json();

  if (data.error) {
    console.error(
      "[GAQL Error - Impression Share]",
      JSON.stringify(data.error, null, 2),
    );
    throw new Error(`Impression Share Query Failed: ${data.error.message}`);
  }

  return (data.results || []).map((row: any) => {
    const channelType =
      row.campaign?.advertisingChannelType ||
      row.campaign?.advertising_channel_type ||
      "";
    const isPMax = String(channelType).toUpperCase() === "PERFORMANCE_MAX";
    const rawSearchIS = row.metrics?.searchImpressionShare;
    const rawRankLost = row.metrics?.searchRankLostImpressionShare;
    const rawBudgetLost = row.metrics?.searchBudgetLostImpressionShare;
    const rawTopIS = row.metrics?.searchTopImpressionShare;
    const rawAbsTopIS = row.metrics?.searchAbsoluteTopImpressionShare;

    const parsePercent = (val: any): number => {
      if (val === undefined || val === null) return 0;
      if (typeof val === "number") {
        return val <= 1 ? val * 100 : val;
      }
      const str = String(val).trim();
      if (str === "--" || str === "") return 0;
      const clean = str.replace(/[<>\s%]/g, "");
      const num = parseFloat(clean);
      if (isNaN(num)) return 0;
      if (str.includes("%")) return num;
      return num <= 1 ? num * 100 : num;
    };

    const isVal = parsePercent(rawSearchIS);
    const rlVal = parsePercent(rawRankLost);
    const blVal = parsePercent(rawBudgetLost);
    const topVal = parsePercent(rawTopIS);
    const absTopVal = parsePercent(rawAbsTopIS);

    let flag:
      | "budget-constrained"
      | "rank-constrained"
      | "healthy"
      | "notAvailable" = "healthy";
    if (!isPMax && isVal < 70) {
      if (blVal > 10 && blVal > rlVal) {
        flag = "budget-constrained";
      } else if (rlVal > 10) {
        flag = "rank-constrained";
      }
    }

    return {
      campaignId: String(row.campaign?.id || ""),
      campaignName: row.campaign?.name || "",
      advertisingChannelType: String(channelType),
      isPMax,
      searchImpressionShare: isPMax ? "--" : rawSearchIS || "--",
      searchRankLostImpressionShare: isPMax ? "--" : rawRankLost || "--",
      searchBudgetLostImpressionShare: isPMax ? "--" : rawBudgetLost || "--",
      searchTopImpressionShare: isPMax ? "--" : rawTopIS || "--",
      searchAbsoluteTopImpressionShare: isPMax ? "--" : rawAbsTopIS || "--",
      parsedMetrics: {
        searchImpressionShare: isPMax ? 0 : isVal,
        searchRankLostImpressionShare: isPMax ? 0 : rlVal,
        searchBudgetLostImpressionShare: isPMax ? 0 : blVal,
        searchTopImpressionShare: isPMax ? 0 : topVal,
        searchAbsoluteTopImpressionShare: isPMax ? 0 : absTopVal,
      },
      flag: isPMax ? ("notAvailable" as const) : flag,
    };
  });
}

/**
 * Runs a diagnostics check on conversion tracking actions configuration and history.
 */
export async function fetchConversionTrackingAudit(googleAccountId: string) {
  const { accessToken, managerCustomerId } = await getManagementAccessToken();
  const sanitizedId = googleAccountId.replace(/-/g, "");

  // Query 1: Retrieve conversion actions metadata
  const metaQuery = `
        SELECT
            conversion_action.id,
            conversion_action.name,
            conversion_action.status,
            conversion_action.counting_type,
            conversion_action.primary_for_goal,
            conversion_action.category,
            conversion_action.type
        FROM conversion_action
    `;

  const metaResponse = await fetch(
    `https://googleads.googleapis.com/v23/customers/${sanitizedId}/googleAds:search`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "developer-token": DEVELOPER_TOKEN!,
        Authorization: `Bearer ${accessToken}`,
        "login-customer-id": managerCustomerId,
      },
      body: JSON.stringify({ query: metaQuery }),
    },
  );

  const metaData = await metaResponse.json();

  if (metaData.error) {
    console.error(
      "[GAQL Error - Conversion Metadata]",
      JSON.stringify(metaData.error, null, 2),
    );
    throw new Error(
      `Conversion Action Metadata Query Failed: ${metaData.error.message}`,
    );
  }

  // Query 2: Daily conversions over the last 30 days
  const historyQuery = `
        SELECT
            segments.conversion_action,
            segments.date,
            metrics.conversions
        FROM campaign
        WHERE segments.date DURING LAST_30_DAYS
          AND metrics.conversions > 0
    `;

  const historyResponse = await fetch(
    `https://googleads.googleapis.com/v23/customers/${sanitizedId}/googleAds:search`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "developer-token": DEVELOPER_TOKEN!,
        Authorization: `Bearer ${accessToken}`,
        "login-customer-id": managerCustomerId,
      },
      body: JSON.stringify({ query: historyQuery }),
    },
  );

  const historyData = await historyResponse.json();
  const historyResults = historyData.results || [];

  // Query 3: Account-level spend over the last 14 days
  const spendQuery = `
        SELECT
            metrics.cost_micros
        FROM customer
        WHERE segments.date DURING LAST_14_DAYS
    `;

  const spendResponse = await fetch(
    `https://googleads.googleapis.com/v23/customers/${sanitizedId}/googleAds:search`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "developer-token": DEVELOPER_TOKEN!,
        Authorization: `Bearer ${accessToken}`,
        "login-customer-id": managerCustomerId,
      },
      body: JSON.stringify({ query: spendQuery }),
    },
  );

  const spendData = await spendResponse.json();
  let hasSpendInLast14Days = false;
  if (!spendData.error && spendData.results && spendData.results.length > 0) {
    let totalCost = 0;
    for (const row of spendData.results) {
      totalCost += parseFloat(row.metrics?.costMicros || "0");
    }
    if (totalCost > 0) {
      hasSpendInLast14Days = true;
    }
  }

  // Process history to find last conversion date per conversion action ID
  const lastConversionMap = new Map<string, string>();
  for (const row of historyResults) {
    const actionUri = row.segments?.conversionAction || "";
    const actionId = actionUri.split("/").pop() || "";
    const date = row.segments?.date || "";
    if (actionId && date) {
      const existing = lastConversionMap.get(actionId);
      if (!existing || date > existing) {
        lastConversionMap.set(actionId, date);
      }
    }
  }

  const actions = (metaData.results || []).map((row: any) => {
    const act = row.conversionAction || {};
    const actionId = String(act.id || "");
    const lastDate = lastConversionMap.get(actionId) || null;

    let daysSinceLastConversion: number | null = null;
    if (lastDate) {
      const [y, m, d] = lastDate.split("-").map(Number);
      const lastConvDateObj = new Date(Date.UTC(y, m - 1, d));
      const today = new Date();
      const diffTime = today.getTime() - lastConvDateObj.getTime();
      daysSinceLastConversion = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    }

    return {
      id: actionId,
      name: act.name || "",
      status: act.status || "",
      countingType: act.countingType || "",
      primaryForGoal: !!act.primaryForGoal,
      category: act.category || "",
      type: act.type || "",
      lastConversionDate: lastDate,
      daysSinceLastConversion,
    };
  });

  return {
    hasSpendInLast14Days,
    actions,
  };
}

/**
 * Fetches all enabled Responsive Search Ads in campaigns/ad groups.
 */
export async function fetchAdGroupAds(
  googleAccountId: string,
  campaignId?: string,
  adGroupId?: string,
) {
  const { accessToken, managerCustomerId } = await getManagementAccessToken();
  const sanitizedId = googleAccountId.replace(/-/g, "");

  let query = `
        SELECT
            campaign.id,
            campaign.name,
            ad_group.id,
            ad_group.name,
            ad_group_ad.ad.id,
            ad_group_ad.ad.responsive_search_ad.headlines,
            ad_group_ad.ad.responsive_search_ad.descriptions,
            ad_group_ad.ad_strength,
            ad_group_ad.policy_summary.approval_status,
            ad_group_ad.ad.final_urls
        FROM ad_group_ad
        WHERE campaign.status = 'ENABLED'
          AND ad_group_ad.status = 'ENABLED'
    `;

  if (campaignId) {
    query += ` AND campaign.id = ${campaignId}`;
  }
  if (adGroupId) {
    query += ` AND ad_group.id = ${adGroupId}`;
  }

  const response = await fetch(
    `https://googleads.googleapis.com/v23/customers/${sanitizedId}/googleAds:search`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "developer-token": DEVELOPER_TOKEN!,
        Authorization: `Bearer ${accessToken}`,
        "login-customer-id": managerCustomerId,
      },
      body: JSON.stringify({ query }),
    },
  );

  const data = await response.json();
  if (data.error) {
    console.error(
      "[GAQL Error - Ad Group Ads]",
      JSON.stringify(data.error, null, 2),
    );
    throw new Error(`Ad Group Ads Query Failed: ${data.error.message}`);
  }

  return (data.results || []).map((row: any) => ({
    campaignId: String(row.campaign?.id || ""),
    campaignName: row.campaign?.name || "",
    adGroupId: String(row.adGroup?.id || ""),
    adGroupName: row.adGroup?.name || "",
    adId: String(row.adGroupAd?.ad?.id || ""),
    adStrength: row.adGroupAd?.adStrength || "UNKNOWN",
    approvalStatus: row.adGroupAd?.policySummary?.approvalStatus || "APPROVED",
    finalUrl: row.adGroupAd?.ad?.finalUrls?.[0] || "",
    headlines: (row.adGroupAd?.ad?.responsiveSearchAd?.headlines || []).map(
      (h: any) => ({
        text: h.text || "",
        pinnedField: h.pinnedField || "UNSPECIFIED",
      }),
    ),
    descriptions: (
      row.adGroupAd?.ad?.responsiveSearchAd?.descriptions || []
    ).map((d: any) => ({
      text: d.text || "",
      pinnedField: d.pinnedField || "UNSPECIFIED",
    })),
  }));
}

/**
 * Fetches performance labels and pinning info for RSA assets.
 */
export async function fetchAdGroupAdAssetPerformance(
  googleAccountId: string,
  campaignId?: string,
) {
  const { accessToken, managerCustomerId } = await getManagementAccessToken();
  const sanitizedId = googleAccountId.replace(/-/g, "");

  let query = `
        SELECT
            ad_group_ad_asset_view.ad_group_ad,
            ad_group_ad_asset_view.field_type,
            ad_group_ad_asset_view.performance_label,
            ad_group_ad_asset_view.pinned_field,
            asset.id,
            asset.text_asset.text
        FROM ad_group_ad_asset_view
        WHERE campaign.status = 'ENABLED'
    `;

  if (campaignId) {
    query += ` AND campaign.id = ${campaignId}`;
  }

  const response = await fetch(
    `https://googleads.googleapis.com/v23/customers/${sanitizedId}/googleAds:search`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "developer-token": DEVELOPER_TOKEN!,
        Authorization: `Bearer ${accessToken}`,
        "login-customer-id": managerCustomerId,
      },
      body: JSON.stringify({ query }),
    },
  );

  const data = await response.json();
  if (data.error) {
    console.error(
      "[GAQL Error - Asset Performance]",
      JSON.stringify(data.error, null, 2),
    );
    throw new Error(`Asset Performance Query Failed: ${data.error.message}`);
  }

  return (data.results || []).map((row: any) => {
    const adGroupAdUri = row.adGroupAdAssetView?.adGroupAd || "";
    const adId = adGroupAdUri.split("~").pop() || "";
    return {
      adGroupAd: adGroupAdUri,
      adId,
      fieldType: row.adGroupAdAssetView?.fieldType || "UNSPECIFIED",
      performanceLabel:
        row.adGroupAdAssetView?.performanceLabel || "UNSPECIFIED",
      pinnedField: row.adGroupAdAssetView?.pinnedField || "UNSPECIFIED",
      assetId: String(row.asset?.id || ""),
      text: row.asset?.textAsset?.text || "",
    };
  });
}
