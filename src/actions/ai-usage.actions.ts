"use server";

import * as cheerio from "cheerio";
import { and, eq, gte, lte, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { db } from "@/db";
import {
  aiModelPricing,
  aiUsageSettings,
  member,
  usageLogs,
  user,
} from "@/db/schema";
import { withTenantContext } from "@/db/tenant-db";
import { auth } from "@/lib/auth";
import {
  formatUTCDate,
  getMelbourneTodayStr,
  parseUTCDate,
} from "@/lib/date-utils";

// Helper to get active session organization context
async function getSessionOrgContext() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    throw new Error("Unauthorized");
  }

  let orgId = session.session.activeOrganizationId;
  if (!orgId) {
    const userMember = await db.query.member.findFirst({
      where: eq(member.userId, session.user.id),
    });
    orgId = userMember?.organizationId ?? null;
  }

  return {
    userId: session.user.id,
    orgId,
    userRole: session.user.role || "member",
  };
}

/**
 * Gets the AI usage settings for the active organization.
 */
export async function getAiUsageSettingsAction() {
  try {
    const { orgId } = await getSessionOrgContext();
    if (!orgId) throw new Error("No active organization context");

    return await withTenantContext(orgId, async (tx) => {
      let settings = await tx.query.aiUsageSettings.findFirst({
        where: eq(aiUsageSettings.organizationId, orgId),
      });

      if (!settings) {
        const [newSettings] = await tx
          .insert(aiUsageSettings)
          .values({
            organizationId: orgId,
            monthlyBudgetLimit: "50.00",
            softLimitPercentage: 80,
            hardLimitBlocked: true,
          })
          .returning();
        settings = newSettings;
      }

      return {
        success: true as const,
        data: {
          id: settings.id,
          monthlyBudgetLimit: settings.monthlyBudgetLimit,
          softLimitPercentage: settings.softLimitPercentage,
          hardLimitBlocked: settings.hardLimitBlocked,
          updatedAt: settings.updatedAt.toISOString(),
        },
      };
    });
  } catch (error: any) {
    console.error("[getAiUsageSettingsAction Error]:", error);
    return { success: false as const, error: error.message };
  }
}

/**
 * Updates the AI usage settings for the active organization.
 */
export async function updateAiUsageSettingsAction(payload: {
  monthlyBudgetLimit: string;
  softLimitPercentage: number;
  hardLimitBlocked: boolean;
}) {
  try {
    const { orgId, userRole } = await getSessionOrgContext();
    if (!orgId) throw new Error("No active organization context");

    // Only owners or admins should modify usage limits
    if (userRole !== "admin" && userRole !== "owner") {
      throw new Error(
        "Forbidden: Only administrators can modify budget settings.",
      );
    }

    await withTenantContext(orgId, async (tx) => {
      await tx
        .insert(aiUsageSettings)
        .values({
          organizationId: orgId,
          monthlyBudgetLimit: payload.monthlyBudgetLimit,
          softLimitPercentage: payload.softLimitPercentage,
          hardLimitBlocked: payload.hardLimitBlocked,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: aiUsageSettings.organizationId,
          set: {
            monthlyBudgetLimit: payload.monthlyBudgetLimit,
            softLimitPercentage: payload.softLimitPercentage,
            hardLimitBlocked: payload.hardLimitBlocked,
            updatedAt: new Date(),
          },
        });
    });

    revalidatePath("/settings");
    return { success: true as const };
  } catch (error: any) {
    console.error("[updateAiUsageSettingsAction Error]:", error);
    return { success: false as const, error: error.message };
  }
}

/**
 * Gets aggregated AI usage stats and query logs for charts and lists.
 */
export async function getAiUsageStatsAction(payload?: {
  startDate?: string;
  endDate?: string;
}) {
  try {
    const { orgId } = await getSessionOrgContext();
    if (!orgId) throw new Error("No active organization context");

    // Determine date range in Melbourne timezone
    const melbourneTodayStr = getMelbourneTodayStr();
    const [year, month] = melbourneTodayStr.split("-").map(Number);

    // Default to start of current calendar month to today
    const startStr =
      payload?.startDate || `${year}-${String(month).padStart(2, "0")}-01`;
    const endStr = payload?.endDate || melbourneTodayStr;

    const startDate = parseUTCDate(startStr);
    // Include the entire end day
    const endDate = parseUTCDate(endStr);
    endDate.setHours(23, 59, 59, 999);

    return await withTenantContext(orgId, async (tx) => {
      // 1. Fetch settings to get limit
      let settings = await tx.query.aiUsageSettings.findFirst({
        where: eq(aiUsageSettings.organizationId, orgId),
      });

      if (!settings) {
        const [newSettings] = await tx
          .insert(aiUsageSettings)
          .values({
            organizationId: orgId,
            monthlyBudgetLimit: "50.00",
            softLimitPercentage: 80,
            hardLimitBlocked: true,
          })
          .returning();
        settings = newSettings;
      }

      // 2. Fetch all usage logs in this time period
      const logs = await tx.query.usageLogs.findMany({
        where: and(
          eq(usageLogs.organizationId, orgId),
          gte(usageLogs.createdAt, startDate),
          lte(usageLogs.createdAt, endDate),
          eq(usageLogs.actionType, "gemini_query"),
        ),
        orderBy: (table, { desc }) => [desc(table.createdAt)],
      });

      // 3. Fetch users to resolve names
      const usersList = await tx.select().from(user);
      const userMap = new Map(usersList.map((u) => [u.id, u]));

      // 4. Perform In-Memory Aggregations
      let totalSpend = 0;
      let totalQueries = 0;
      let totalTokens = 0;

      const featureMap: Record<string, { spend: number; count: number }> = {};
      const userStatsMap: Record<
        string,
        { spend: number; count: number; name: string }
      > = {};

      const ledger = logs.map((log) => {
        const cost = parseFloat(log.estimatedCost);
        totalSpend += cost;
        totalQueries++;

        const meta = log.metadata as any;
        const inputTokens = meta?.inputTokens || 0;
        const outputTokens = meta?.outputTokens || 0;
        const tokens = inputTokens + outputTokens;
        totalTokens += tokens;

        const model = meta?.model || "Unknown";
        const feature = meta?.feature || "General Query";

        // Resolve actor details
        const actor = log.userId ? userMap.get(log.userId) : null;
        const userName = actor?.name || "System Automated";
        const userEmail = actor?.email || "system@uprise.digital";

        // Aggregate by feature
        if (!featureMap[feature]) {
          featureMap[feature] = { spend: 0, count: 0 };
        }
        featureMap[feature].spend += cost;
        featureMap[feature].count++;

        // Aggregate by user
        const userIdKey = log.userId || "system";
        if (!userStatsMap[userIdKey]) {
          userStatsMap[userIdKey] = { spend: 0, count: 0, name: userName };
        }
        userStatsMap[userIdKey].spend += cost;
        userStatsMap[userIdKey].count++;

        return {
          id: log.id,
          timestamp: log.createdAt.toISOString(),
          userName,
          userEmail,
          feature,
          model,
          tokens,
          cost,
        };
      });

      // Format Feature Breakdown
      const featureBreakdown = Object.entries(featureMap).map(
        ([name, stats]) => ({
          name: formatFeatureName(name),
          spend: parseFloat(stats.spend.toFixed(4)),
          count: stats.count,
        }),
      );

      // Format User Breakdown
      const userBreakdown = Object.values(userStatsMap).map((stats) => ({
        name: stats.name,
        spend: parseFloat(stats.spend.toFixed(4)),
        count: stats.count,
      }));

      const budgetLimit = parseFloat(settings.monthlyBudgetLimit);
      const percentUsed =
        budgetLimit > 0 ? (totalSpend / budgetLimit) * 100 : 0;

      return {
        success: true as const,
        data: {
          totalSpend: parseFloat(totalSpend.toFixed(4)),
          totalQueries,
          totalTokens,
          budgetLimit,
          softLimitPercentage: settings.softLimitPercentage,
          hardLimitBlocked: settings.hardLimitBlocked,
          percentUsed: parseFloat(percentUsed.toFixed(1)),
          featureBreakdown,
          userBreakdown,
          ledger: ledger.slice(0, 100), // Limit ledger to last 100 items
        },
      };
    });
  } catch (error: any) {
    console.error("[getAiUsageStatsAction Error]:", error);
    return { success: false as const, error: error.message };
  }
}

/**
 * Triggers manual scraping/syncing of Gemini pricing page.
 */
export async function syncGeminiPricingAction() {
  try {
    const { userRole } = await getSessionOrgContext();
    if (userRole !== "admin" && userRole !== "owner") {
      throw new Error("Forbidden: Only administrators can sync pricing.");
    }

    const host = (await headers()).get("host") || "localhost:3000";
    const protocol = host.startsWith("localhost") ? "http" : "https";
    const cronSecret = process.env.CRON_SECRET || "";

    const response = await fetch(
      `${protocol}://${host}/api/cron/sync-pricing?secret=${cronSecret}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      },
    );

    const data = await response.json();
    return { success: true as const, data };
  } catch (error: any) {
    console.error("[syncGeminiPricingAction Error]:", error);
    return { success: false as const, error: error.message };
  }
}

// Format technical feature slugs to nice display labels
function formatFeatureName(featureSlug: string): string {
  switch (featureSlug) {
    case "landing_page_analysis":
      return "Landing Page Audits";
    case "ad_copy_audit":
      return "Ad Copy Audits";
    case "morning_briefing":
      return "Morning Briefings";
    case "campaign_diagnostics":
      return "Campaign Diagnostics";
    case "agency_portfolio_analysis":
      return "Agency God-View";
    case "threat_matrix":
      return "Competitor Threat Matrix";
    case "negative_keyword_suggestions":
      return "Negative Keyword Generator";
    case "pdf_report_insights":
      return "Monthly PDF Reports";
    case "email_body_generation":
      return "Client Email Auto-write";
    default:
      return featureSlug
        .split("_")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
  }
}
