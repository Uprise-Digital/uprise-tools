import { db } from "@/db";
import { account } from "@/db/schema";
import { eq } from "drizzle-orm";

const DEVELOPER_TOKEN = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
const MANAGER_ID = process.env.GOOGLE_ADS_MANAGER_ID;

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

    return response.json();
}

export async function fetchAccountMonthlySummary(googleAccountId: string) {
    const accessToken = await getManagementAccessToken();
    const sanitizedId = googleAccountId.replace(/-/g, "");

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
        WHERE segments.date DURING THIS_MONTH
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
    return data.results || [];
}

export async function fetchAccountKeywords(googleAccountId: string) {
    const accessToken = await getManagementAccessToken();
    const sanitizedId = googleAccountId.replace(/-/g, "");

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
        WHERE segments.date DURING THIS_MONTH
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
    return data.results || [];
}

export async function fetchAccountLastMonthSummary(googleAccountId: string) {
    const accessToken = await getManagementAccessToken();
    const sanitizedId = googleAccountId.replace(/-/g, "");

    const query = `
        SELECT
            metrics.cost_micros,
            metrics.clicks,
            metrics.impressions,
            metrics.conversions
        FROM customer
        WHERE segments.date DURING LAST_MONTH
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
    return data.results?.[0]?.metrics || null;
}