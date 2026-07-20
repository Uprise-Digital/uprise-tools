import { GoogleGenAI } from "@google/genai";
import { and, eq, gte, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { db } from "@/db";
import {
  aiModelPricing,
  aiUsageSettings,
  member,
  usageLogs,
} from "@/db/schema";
import { auth } from "@/lib/auth";
import { getMelbourneTodayStr, parseUTCDate } from "@/lib/date-utils";

// Shared GoogleGenAI instance using the env key
export const googleAi = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Default fallbacks if pricing table is empty
export const DEFAULT_PRICING: Record<
  string,
  { inputCostPerMillion: number; outputCostPerMillion: number }
> = {
  "gemini-3.5-flash": { inputCostPerMillion: 1.5, outputCostPerMillion: 9.0 },
  "gemini-3.5-live-translate-preview": {
    inputCostPerMillion: 3.5,
    outputCostPerMillion: 21.0,
  },
  "gemini-3.1-flash-lite": {
    inputCostPerMillion: 0.25,
    outputCostPerMillion: 1.5,
  },
  "gemini-3.1-pro-preview": {
    inputCostPerMillion: 2.0,
    outputCostPerMillion: 12.0,
  },
  "gemini-2.5-flash": { inputCostPerMillion: 0.3, outputCostPerMillion: 2.5 },
  "gemini-2.5-pro": { inputCostPerMillion: 1.25, outputCostPerMillion: 10.0 },
  "gemini-2.5-flash-lite": {
    inputCostPerMillion: 0.1,
    outputCostPerMillion: 0.4,
  },
  "gemini-1.5-flash": { inputCostPerMillion: 0.3, outputCostPerMillion: 2.5 },
};

interface TrackedCallContext {
  organizationId?: string;
  userId?: string | null;
  feature: string;
}

interface TrackedCallParams {
  model: string;
  contents: any;
  config?: any;
}

/**
 * Executes a Gemini model query, enforces budget limits, calculates estimated cost, and logs usage.
 */
export async function generateContentTracked(
  params: TrackedCallParams,
  context: TrackedCallContext,
) {
  let { organizationId, userId = null, feature } = context;
  const modelName = params.model;

  // Auto-detect session if organizationId is not provided
  if (!organizationId) {
    try {
      const session = await auth.api.getSession({
        headers: await headers(),
      });
      if (session) {
        userId = session.user.id;
        organizationId = session.session.activeOrganizationId ?? undefined;

        if (!organizationId) {
          const userMember = await db.query.member.findFirst({
            where: eq(member.userId, userId),
          });
          organizationId = userMember?.organizationId;
        }
      }
    } catch (e) {
      // Ignore session resolution failure if outside HTTP context
    }
  }

  // Fallback to default if still not resolved
  if (!organizationId) {
    organizationId = "default-org";
  }

  // 1. Get or Create Organization AI Settings
  let settings = await db.query.aiUsageSettings.findFirst({
    where: eq(aiUsageSettings.organizationId, organizationId),
  });

  if (!settings) {
    const [newSettings] = await db
      .insert(aiUsageSettings)
      .values({
        organizationId,
        monthlyBudgetLimit: "50.00",
        softLimitPercentage: 80,
        hardLimitBlocked: true,
      })
      .returning();
    settings = newSettings;
  }

  const budgetLimit = parseFloat(settings.monthlyBudgetLimit);
  const softLimitPercent = settings.softLimitPercentage;
  const hardLimitBlocked = settings.hardLimitBlocked;

  // 2. Calculate Current Month's Spend
  const melbourneTodayStr = getMelbourneTodayStr();
  const [year, month] = melbourneTodayStr.split("-").map(Number);
  const startOfMonth = new Date(Date.UTC(year, month - 1, 1));

  const [usageSum] = await db
    .select({
      totalSpend: sql<string>`COALESCE(SUM(${usageLogs.estimatedCost}), '0.000000')`,
    })
    .from(usageLogs)
    .where(
      and(
        eq(usageLogs.organizationId, organizationId),
        gte(usageLogs.createdAt, startOfMonth),
      ),
    );

  const currentMonthSpend = parseFloat(usageSum?.totalSpend || "0");

  // 3. Enforce Hard Limit if blocked and limit exceeded
  if (hardLimitBlocked && currentMonthSpend >= budgetLimit) {
    throw new Error(
      `AI_LIMIT_EXCEEDED: Monthly AI budget cap of $${budgetLimit.toFixed(2)} reached ($${currentMonthSpend.toFixed(2)} spent).`,
    );
  }

  // 4. Execute AI Query
  const startTime = Date.now();
  const response = await googleAi.models.generateContent({
    model: modelName,
    contents: params.contents,
    config: params.config,
  });
  const durationMs = Date.now() - startTime;

  // 5. Extract Token Usage & Calculate Pricing
  const promptTokens = response.usageMetadata?.promptTokenCount || 0;
  const candidatesTokens = response.usageMetadata?.candidatesTokenCount || 0;
  const totalTokens = response.usageMetadata?.totalTokenCount || 0;

  // Lookup model pricing
  const pricing = await db.query.aiModelPricing.findFirst({
    where: eq(aiModelPricing.modelName, modelName),
  });

  // Fallback to local default pricing if database record is missing
  let inputRate = DEFAULT_PRICING[modelName]?.inputCostPerMillion ?? 1.5;
  let outputRate = DEFAULT_PRICING[modelName]?.outputCostPerMillion ?? 9.0;

  if (pricing) {
    inputRate = parseFloat(pricing.inputCostPerMillion.toString());
    outputRate = parseFloat(pricing.outputCostPerMillion.toString());
  }

  const inputCost = (promptTokens * inputRate) / 1000000;
  const outputCost = (candidatesTokens * outputRate) / 1000000;
  const queryCost = inputCost + outputCost;

  // 6. Log the usage in usage_logs
  await db.insert(usageLogs).values({
    organizationId,
    userId,
    actionType: "gemini_query",
    unitsUsed: totalTokens,
    estimatedCost: queryCost.toFixed(6),
    metadata: {
      model: modelName,
      inputTokens: promptTokens,
      outputTokens: candidatesTokens,
      feature,
      durationMs,
    },
    createdAt: new Date(),
  });

  // 7. Check if Soft Limit has been reached after this call
  const postSpend = currentMonthSpend + queryCost;
  const softLimitThreshold = budgetLimit * (softLimitPercent / 100);
  const isSoftLimitReached = postSpend >= softLimitThreshold;

  const usageAlert = isSoftLimitReached
    ? `Warning: AI budget soft limit reached. You have consumed ${((postSpend / budgetLimit) * 100).toFixed(0)}% of your monthly limit ($${postSpend.toFixed(2)} / $${budgetLimit.toFixed(2)}).`
    : undefined;

  return {
    response,
    usageAlert,
    cost: queryCost,
    tokens: {
      prompt: promptTokens,
      candidates: candidatesTokens,
      total: totalTokens,
    },
  };
}
