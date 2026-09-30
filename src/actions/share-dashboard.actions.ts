"use server";

import crypto from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { getDashboardMetricsAction } from "@/actions/dashboard.actions";
import { db } from "@/db";
import {
  adAccountShareLinks,
  adAccounts,
  metaAdAccounts,
  metaAdsConnections,
} from "@/db/schema";
import {
  isAccountMatch,
  normalizeAccountName,
  stemAccountName,
} from "@/lib/account-unification";
import { getAuthOrgContext } from "@/lib/auth-helpers";
import { decryptToken } from "@/lib/crypto";
import { parseMetaActionsConv } from "@/lib/meta-utils";

// Clean 24-character alphabet (uppercase, omitting ambiguous I and O)
const TOKEN_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ";

function generateAlphabeticalToken(length = 8): string {
  const bytes = crypto.randomBytes(length);
  let result = "";
  for (let i = 0; i < length; i++) {
    result += TOKEN_ALPHABET[bytes[i] % TOKEN_ALPHABET.length];
  }
  return result;
}

export type ShareLinkConfig = {
  id: number;
  adAccountId: number;
  token: string;
  pinCode: string | null;
  isPinRequired: boolean;
  themeColor: string;
  allowedChannels: string;
  visibleCharts: string[];
  expiresAt: string | null;
  isActive: boolean;
  viewCount: number;
  lastViewedAt: string | null;
};

/**
 * Internal authenticated action: get or create share link for an ad account.
 */
export async function getAdAccountShareLinkAction(
  adAccountId: number,
): Promise<{
  success: boolean;
  data?: ShareLinkConfig;
  error?: string;
}> {
  const ctx = await getAuthOrgContext();
  if (!ctx) return { success: false, error: "Unauthorized" };

  try {
    let link = await db.query.adAccountShareLinks.findFirst({
      where: eq(adAccountShareLinks.adAccountId, adAccountId),
    });

    if (!link) {
      let token = generateAlphabeticalToken(8);
      // Ensure token uniqueness
      let attempts = 0;
      while (attempts < 5) {
        const existing = await db.query.adAccountShareLinks.findFirst({
          where: eq(adAccountShareLinks.token, token),
        });
        if (!existing) break;
        token = generateAlphabeticalToken(8);
        attempts++;
      }

      const inserted = await db
        .insert(adAccountShareLinks)
        .values({
          adAccountId,
          organizationId: ctx.orgId,
          token,
          themeColor: "violet",
          allowedChannels: "all",
          visibleCharts: ["spend", "cpc", "ctr", "conversions"],
          isPinRequired: false,
          isActive: true,
          viewCount: 0,
        })
        .returning();

      link = inserted[0];
    }

    return {
      success: true,
      data: {
        id: link.id,
        adAccountId: link.adAccountId,
        token: link.token,
        pinCode: link.pinCode,
        isPinRequired: link.isPinRequired,
        themeColor: link.themeColor,
        allowedChannels: link.allowedChannels,
        visibleCharts: (link.visibleCharts as string[]) || [
          "spend",
          "cpc",
          "ctr",
          "conversions",
        ],
        expiresAt: link.expiresAt ? link.expiresAt.toISOString() : null,
        isActive: link.isActive,
        viewCount: link.viewCount,
        lastViewedAt: link.lastViewedAt
          ? link.lastViewedAt.toISOString()
          : null,
      },
    };
  } catch (error: any) {
    console.error("Error in getAdAccountShareLinkAction:", error);
    return {
      success: false,
      error: error.message || "Failed to load share link",
    };
  }
}

/**
 * Database-level helper to obtain or create an active public share dashboard URL
 * for reports, cron schedules, and email deliveries (no auth session required).
 */
export async function getOrCreatePublicShareUrlInternal(
  adAccountId: number,
  orgId?: string,
): Promise<string> {
  let link = await db.query.adAccountShareLinks.findFirst({
    where: eq(adAccountShareLinks.adAccountId, adAccountId),
  });

  if (!link) {
    let resolvedOrgId = orgId;
    if (!resolvedOrgId) {
      const acc = await db.query.adAccounts.findFirst({
        where: eq(adAccounts.id, adAccountId),
      });
      resolvedOrgId = acc?.organizationId || "default-org";
    }

    let token = generateAlphabeticalToken(8);
    let attempts = 0;
    while (attempts < 5) {
      const existing = await db.query.adAccountShareLinks.findFirst({
        where: eq(adAccountShareLinks.token, token),
      });
      if (!existing) break;
      token = generateAlphabeticalToken(8);
      attempts++;
    }

    const inserted = await db
      .insert(adAccountShareLinks)
      .values({
        adAccountId,
        organizationId: resolvedOrgId,
        token,
        themeColor: "violet",
        allowedChannels: "all",
        visibleCharts: ["spend", "cpc", "ctr", "conversions"],
        isPinRequired: false,
        isActive: true,
        viewCount: 0,
      })
      .returning();
    link = inserted[0];
  }

  const baseUrl =
    process.env.PRODUCTION_APP_URL || "https://tools.uprisedigital.com.au";
  return `${baseUrl}/share/ad/${link.token}`;
}


/**
 * Internal authenticated action: save updated share link settings.
 */
export async function saveShareLinkSettingsAction(
  adAccountId: number,
  settings: {
    themeColor: string;
    allowedChannels: string;
    visibleCharts: string[];
    isPinRequired: boolean;
    pinCode?: string | null;
    expiresAt?: string | null;
  },
): Promise<{ success: boolean; error?: string }> {
  const ctx = await getAuthOrgContext();
  if (!ctx) return { success: false, error: "Unauthorized" };

  try {
    await db
      .update(adAccountShareLinks)
      .set({
        themeColor: settings.themeColor,
        allowedChannels: settings.allowedChannels,
        visibleCharts: settings.visibleCharts,
        isPinRequired: settings.isPinRequired,
        pinCode: settings.pinCode ? settings.pinCode.trim() : null,
        expiresAt: settings.expiresAt ? new Date(settings.expiresAt) : null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(adAccountShareLinks.adAccountId, adAccountId),
          eq(adAccountShareLinks.organizationId, ctx.orgId),
        ),
      );

    return { success: true };
  } catch (error: any) {
    console.error("Error in saveShareLinkSettingsAction:", error);
    return {
      success: false,
      error: error.message || "Failed to save settings",
    };
  }
}

/**
 * Internal authenticated action: regenerate a new 8-character token.
 */
export async function regenerateShareTokenAction(adAccountId: number): Promise<{
  success: boolean;
  token?: string;
  error?: string;
}> {
  const ctx = await getAuthOrgContext();
  if (!ctx) return { success: false, error: "Unauthorized" };

  try {
    let token = generateAlphabeticalToken(8);
    let attempts = 0;
    while (attempts < 5) {
      const existing = await db.query.adAccountShareLinks.findFirst({
        where: eq(adAccountShareLinks.token, token),
      });
      if (!existing) break;
      token = generateAlphabeticalToken(8);
      attempts++;
    }

    await db
      .update(adAccountShareLinks)
      .set({
        token,
        isActive: true,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(adAccountShareLinks.adAccountId, adAccountId),
          eq(adAccountShareLinks.organizationId, ctx.orgId),
        ),
      );

    return { success: true, token };
  } catch (error: any) {
    console.error("Error in regenerateShareTokenAction:", error);
    return {
      success: false,
      error: error.message || "Failed to regenerate token",
    };
  }
}

/**
 * Internal authenticated action: toggle revocation / active status.
 */
export async function toggleShareLinkActiveAction(
  adAccountId: number,
  isActive: boolean,
): Promise<{ success: boolean; error?: string }> {
  const ctx = await getAuthOrgContext();
  if (!ctx) return { success: false, error: "Unauthorized" };

  try {
    await db
      .update(adAccountShareLinks)
      .set({
        isActive,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(adAccountShareLinks.adAccountId, adAccountId),
          eq(adAccountShareLinks.organizationId, ctx.orgId),
        ),
      );

    return { success: true };
  } catch (error: any) {
    console.error("Error in toggleShareLinkActiveAction:", error);
    return {
      success: false,
      error: error.message || "Failed to toggle status",
    };
  }
}

/**
 * Public action: Verify PIN for a share link.
 */
export async function verifySharePinAction(
  token: string,
  pin: string,
): Promise<{ success: boolean; valid: boolean; error?: string }> {
  try {
    const link = await db.query.adAccountShareLinks.findFirst({
      where: eq(adAccountShareLinks.token, token.toUpperCase().trim()),
    });

    if (!link || !link.isActive) {
      return { success: false, valid: false, error: "Invalid link" };
    }

    if (!link.isPinRequired) {
      return { success: true, valid: true };
    }

    const isValid = link.pinCode === pin.trim();
    return { success: true, valid: isValid };
  } catch (error: any) {
    return { success: false, valid: false, error: error.message };
  }
}

/**
 * Public action: Get standalone dashboard metrics for a public visitor.
 */
export async function getPublicShareDashboardDataAction(
  token: string,
  pinCode?: string,
  startDate?: string,
  endDate?: string,
) {
  try {
    const cleanToken = token.toUpperCase().trim();
    const link = await db.query.adAccountShareLinks.findFirst({
      where: eq(adAccountShareLinks.token, cleanToken),
    });

    if (!link) {
      return { success: false, error: "NOT_FOUND" };
    }

    if (!link.isActive) {
      return { success: false, error: "REVOKED" };
    }

    if (link.expiresAt && new Date(link.expiresAt) < new Date()) {
      return { success: false, error: "EXPIRED" };
    }

    if (link.isPinRequired) {
      if (!pinCode || pinCode.trim() !== link.pinCode) {
        return {
          success: false,
          error: "PIN_REQUIRED",
          requiresPin: true,
          themeColor: link.themeColor,
        };
      }
    }

    // Increment view count asynchronously
    db.update(adAccountShareLinks)
      .set({
        viewCount: sql`${adAccountShareLinks.viewCount} + 1`,
        lastViewedAt: new Date(),
      })
      .where(eq(adAccountShareLinks.id, link.id))
      .catch((err) => console.error("Failed to update viewCount:", err));

    // Fetch the target ad account
    const account = await db.query.adAccounts.findFirst({
      where: eq(adAccounts.id, link.adAccountId),
    });

    if (!account) {
      return { success: false, error: "ACCOUNT_NOT_FOUND" };
    }

    // Default date range: current month
    const today = new Date();
    const defaultStart = new Date(today.getFullYear(), today.getMonth(), 1)
      .toISOString()
      .split("T")[0];
    const defaultEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0)
      .toISOString()
      .split("T")[0];

    const activeStart = startDate || defaultStart;
    const activeEnd = endDate || defaultEnd;

    // 1. Google Ads metrics
    let googleData: any = null;
    if (account.googleAccountId && link.allowedChannels !== "meta") {
      try {
        const gRes = await getDashboardMetricsAction(
          account.id,
          account.googleAccountId,
          activeStart,
          activeEnd,
        );
        if (gRes.success && gRes.data) {
          googleData = gRes.data;
        }
      } catch (err) {
        console.error(
          "Error fetching Google Ads metrics for public view:",
          err,
        );
      }
    }

    // 2. Meta Ads metrics
    let metaData: any = null;
    let linkedMetaAccount: any = null;

    if (link.allowedChannels !== "google") {
      const orgMetaAccounts = await db.query.metaAdAccounts.findMany({
        where: eq(metaAdAccounts.organizationId, link.organizationId),
      });

      let matchedMeta = account.clientId
        ? orgMetaAccounts.find((m) => m.clientId === account.clientId)
        : undefined;

      if (!matchedMeta && account.clientOnboardingId) {
        matchedMeta = orgMetaAccounts.find(
          (m) => m.clientOnboardingId === account.clientOnboardingId,
        );
      }

      const normAccountName = normalizeAccountName(account.name);
      if (!matchedMeta && normAccountName) {
        matchedMeta = orgMetaAccounts.find(
          (m) => normalizeAccountName(m.name) === normAccountName,
        );
      }

      const stemName = stemAccountName(account.name);
      if (!matchedMeta && stemName) {
        matchedMeta = orgMetaAccounts.find(
          (m) => stemAccountName(m.name) === stemName,
        );
      }

      if (!matchedMeta) {
        matchedMeta = orgMetaAccounts.find((m) =>
          isAccountMatch(account.name, m.name),
        );
      }

      if (matchedMeta) {
        linkedMetaAccount = {
          metaAccountId: matchedMeta.metaAccountId,
          name: matchedMeta.name,
        };

        try {
          const metaConn = await db.query.metaAdsConnections.findFirst({
            where: eq(metaAdsConnections.organizationId, link.organizationId),
          });

          if (metaConn) {
            const rawToken = decryptToken(metaConn.accessToken);
            const actId = `act_${matchedMeta.metaAccountId.replace(/^act_/, "")}`;
            const timeRangeParam = encodeURIComponent(
              JSON.stringify({ since: activeStart, until: activeEnd }),
            );

            const dailyUrl = `https://graph.facebook.com/v19.0/${actId}/insights?fields=spend,clicks,impressions,cpc,ctr,actions&time_increment=1&time_range=${timeRangeParam}&access_token=${encodeURIComponent(rawToken)}&limit=100`;
            const campaignsUrl = `https://graph.facebook.com/v19.0/${actId}/insights?fields=campaign_id,campaign_name,spend,clicks,impressions,cpc,ctr,actions&level=campaign&time_range=${timeRangeParam}&access_token=${encodeURIComponent(rawToken)}&limit=100`;

            const [dailyRes, campaignsRes] = await Promise.all([
              fetch(dailyUrl).then((r) => r.json()),
              fetch(campaignsUrl).then((r) => r.json()),
            ]);

            const timeSeries = Array.isArray(dailyRes?.data)
              ? dailyRes.data.map((row: any) => ({
                  date: row.date_start,
                  spend: parseFloat(row.spend || "0"),
                  clicks: parseInt(row.clicks || "0", 10),
                  impressions: parseInt(row.impressions || "0", 10),
                  conversions: parseMetaActionsConv(row.actions),
                  ctr: parseFloat(row.ctr || "0"),
                  cpc: parseFloat(row.cpc || "0"),
                }))
              : [];

            const campaigns = Array.isArray(campaignsRes?.data)
              ? campaignsRes.data.map((row: any) => {
                  const spend = parseFloat(row.spend || "0");
                  const clicks = parseInt(row.clicks || "0", 10);
                  const impressions = parseInt(row.impressions || "0", 10);
                  const conversions = parseMetaActionsConv(row.actions);
                  return {
                    campaignId: row.campaign_id,
                    campaignName: row.campaign_name || "Untitled Campaign",
                    platform: "meta" as const,
                    spend,
                    clicks,
                    impressions,
                    conversions,
                    ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
                    cpc: clicks > 0 ? spend / clicks : 0,
                    cpa: conversions > 0 ? spend / conversions : 0,
                    convRate: clicks > 0 ? (conversions / clicks) * 100 : 0,
                  };
                })
              : [];

            let totalSpend = 0;
            let totalClicks = 0;
            let totalImpressions = 0;
            let totalConversions = 0;

            for (const d of timeSeries) {
              totalSpend += d.spend;
              totalClicks += d.clicks;
              totalImpressions += d.impressions;
              totalConversions += d.conversions;
            }

            metaData = {
              totals: {
                spend: totalSpend,
                clicks: totalClicks,
                impressions: totalImpressions,
                conversions: totalConversions,
                ctr:
                  totalImpressions > 0
                    ? (totalClicks / totalImpressions) * 100
                    : 0,
                cpc: totalClicks > 0 ? totalSpend / totalClicks : 0,
                cpa: totalConversions > 0 ? totalSpend / totalConversions : 0,
                convRate:
                  totalClicks > 0 ? (totalConversions / totalClicks) * 100 : 0,
              },
              timeSeries,
              campaigns,
            };
          }
        } catch (mErr) {
          console.error("Error fetching Meta insights for public view:", mErr);
        }
      }
    }

    return {
      success: true,
      data: {
        clientName: account.name,
        currencyCode: account.currencyCode || "AUD",
        themeColor: link.themeColor,
        allowedChannels: link.allowedChannels,
        visibleCharts: (link.visibleCharts as string[]) || [
          "spend",
          "cpc",
          "ctr",
          "conversions",
        ],
        hasGoogle: Boolean(account.googleAccountId),
        hasMeta: Boolean(linkedMetaAccount),
        googleData,
        metaData,
        dateRange: {
          startDate: activeStart,
          endDate: activeEnd,
        },
      },
    };
  } catch (error: any) {
    console.error("Error in getPublicShareDashboardDataAction:", error);
    return {
      success: false,
      error: error.message || "Failed to load dashboard data",
    };
  }
}
