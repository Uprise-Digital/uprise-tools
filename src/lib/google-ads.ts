import { db } from "@/db";
import { account } from "@/db/schema";
import { eq } from "drizzle-orm";

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
    const authData = await db.query.account.findFirst({
        where: eq(account.providerId, "google"),
    });

    if (!authData?.refreshToken) throw new Error("No Google Refresh Token found.");

    const response = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        body: new URLSearchParams({
            client_id: process.env.GOOGLE_CLIENT_ID!,
            client_secret: process.env.GOOGLE_CLIENT_SECRET!,
            refresh_token: authData.refreshToken,
            grant_type: "refresh_token",
        }),
    });

    const data = await response.json();
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
                "developer-token": process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
                "Authorization": `Bearer ${accessToken}`,
                "login-customer-id": process.env.GOOGLE_ADS_MANAGER_ID!,
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