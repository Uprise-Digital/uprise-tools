const DEVELOPER_TOKEN = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
const MANAGER_ID = process.env.GOOGLE_ADS_MANAGER_ID;

// --- Date Helper Functions ---

/**
 * Returns the correct GAQL date segment for the current query.
 */
function getCurrentPeriodDateClause(startDate?: string, endDate?: string) {
    if (startDate && endDate) {
        // Ensure strictly YYYY-MM-DD format, stripping out time components
        const cleanStart = startDate.split('T')[0].trim();
        const cleanEnd = endDate.split('T')[0].trim();
        return `segments.date BETWEEN '${cleanStart}' AND '${cleanEnd}'`;
    }
    return "segments.date DURING THIS_MONTH";
}

/**
 * Calculates the previous period of the exact same length to ensure accurate comparison metrics.
 * Safely parses YYYY-MM-DD to avoid timezone offset bugs.
 */
function getPreviousPeriodDateClause(startDate?: string, endDate?: string) {
    if (!startDate || !endDate) return "segments.date DURING LAST_MONTH";

    const cleanStart = startDate.split('T')[0].trim();
    const cleanEnd = endDate.split('T')[0].trim();

    const parseDate = (str: string) => {
        const [y, m, d] = str.split('-').map(Number);
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

    const formatYMD = (d: Date) => d.toISOString().split('T')[0];

    return `segments.date BETWEEN '${formatYMD(prevStart)}' AND '${formatYMD(prevEnd)}'`;
}

// --- API Functions ---

async function getManagementAccessToken() {
    // Grab the permanent system token from your environment variables
    const refreshToken = process.env.GOOGLE_ADS_REFRESH_TOKEN;

    if (!refreshToken) {
        throw new Error("CRITICAL: Missing GOOGLE_ADS_REFRESH_TOKEN in environment variables.");
    }

    // Exchange the refresh token for a fresh 60-minute access token
    const response = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        body: new URLSearchParams({
            client_id: process.env.GOOGLE_CLIENT_ID!,
            client_secret: process.env.GOOGLE_CLIENT_SECRET!,
            refresh_token: refreshToken,
            grant_type: "refresh_token",
        }),
    });

    const data = await response.json();

    if (data.error) {
        console.error("[OAuth Refresh Error]", data);
        throw new Error(`Failed to refresh system token: ${data.error_description || data.error}`);
    }

    return data.access_token;
}

export async function fetchMCCAccounts() {
    const accessToken = await getManagementAccessToken();
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
            "Authorization": `Bearer ${accessToken}`,
            "login-customer-id": sanitizedManagerId!,
        },
        body: JSON.stringify({ query }),
    });

    const data = await response.json();
    if (data.error) throw new Error(`Google Ads API Error: ${data.error.message}`);

    return data;
}

export async function fetchAccountMonthlySummary(
    googleAccountId: string,
    startDate?: string,
    endDate?: string
) {
    const accessToken = await getManagementAccessToken();
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
                "Authorization": `Bearer ${accessToken}`,
                "login-customer-id": MANAGER_ID!,
            },
            body: JSON.stringify({ query }),
        }
    );

    const data = await response.json();

    if (data.error) {
        console.error("[GAQL Error - Summary]", JSON.stringify(data.error, null, 2));
        throw new Error(`Summary Query Failed: ${data.error.message}`);
    }

    return data.results || [];
}

export async function fetchAccountKeywords(
    googleAccountId: string,
    startDate?: string,
    endDate?: string
) {
    const accessToken = await getManagementAccessToken();
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
                "Authorization": `Bearer ${accessToken}`,
                "login-customer-id": MANAGER_ID!,
            },
            body: JSON.stringify({ query }),
        }
    );

    const data = await response.json();

    if (data.error) {
        console.error("[GAQL Error - Keywords]", JSON.stringify(data.error, null, 2));
        throw new Error(`Keywords Query Failed: ${data.error.message}`);
    }

    return data.results || [];
}

export async function fetchAccountLastMonthSummary(
    googleAccountId: string,
    startDate?: string,
    endDate?: string
) {
    const accessToken = await getManagementAccessToken();
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
                "Authorization": `Bearer ${accessToken}`,
                "login-customer-id": MANAGER_ID!,
            },
            body: JSON.stringify({ query }),
        }
    );

    const data = await response.json();

    if (data.error) {
        console.error("[GAQL Error - Previous Period]", JSON.stringify(data.error, null, 2));
        throw new Error(`Previous Period Query Failed: ${data.error.message}`);
    }

    return data.results?.[0]?.metrics || null;
}

export async function fetchDailyCampaignData(
    googleAccountId: string,
    startDate: string,
    endDate: string
) {
    const accessToken = await getManagementAccessToken();
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
                "Authorization": `Bearer ${accessToken}`,
                "login-customer-id": process.env.GOOGLE_ADS_MANAGER_ID!,
            },
            body: JSON.stringify({ query }),
        }
    );

    const data = await response.json();

    // DEBUG: Look at this in your terminal output
    console.log("DEBUG Google Ads Raw Response:", JSON.stringify(data.results[0], null, 2));

    if (data.error) throw new Error(`Query Failed: ${data.error.message}`);

    return data.results || [];
}

/**
 * Fetches the specific landing page URL the client is currently spending the most money on.
 */
export async function fetchTopClientLandingPage(googleAccountId: string): Promise<string | null> {
    const accessToken = await getManagementAccessToken();
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
                    "Authorization": `Bearer ${accessToken}`,
                    "login-customer-id": process.env.GOOGLE_ADS_MANAGER_ID!,
                },
                body: JSON.stringify({ query }),
            }
        );

        const data = await response.json();

        if (data.error) {
            console.error("[GAQL Error - Landing Page]", JSON.stringify(data.error, null, 2));
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
        console.error(`Failed to fetch top landing page for ${googleAccountId}:`, error);
        return null;
    }
}

/**
 * Fetches the highest-spend search term, attempting to filter out branded terms.
 */
export async function fetchTopNonBrandedSearchTerm(googleAccountId: string, brandName: string): Promise<string | null> {
    const accessToken = await getManagementAccessToken();
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
                    "Authorization": `Bearer ${accessToken}`,
                    "login-customer-id": process.env.GOOGLE_ADS_MANAGER_ID!,
                },
                body: JSON.stringify({ query }),
            }
        );

        const data = await response.json();

        if (data.results && data.results.length > 0) {
            const brandNameLower = brandName.toLowerCase().split(' ')[0]; // Basic filter using first word of brand

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
        console.error(`Failed to fetch top search term for ${googleAccountId}:`, error);
        return null;
    }
}