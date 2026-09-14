"use server";

import { and, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import {
  adPerformanceDaily,
  clientPulseRatings,
  clients,
  member,
  user,
} from "@/db/schema";
import { getAuthOrgContext } from "@/lib/auth-helpers";
import { getWeekMondayString } from "@/lib/date-utils";

let hasEnsuredPulseSchema = false;

/**
 * Self-healing helper ensuring the client_pulse_ratings table and its indexes exist.
 */
export async function ensurePulseSchema() {
  if (hasEnsuredPulseSchema) return;
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "client_pulse_ratings" (
        "id" serial PRIMARY KEY,
        "organization_id" text NOT NULL REFERENCES "organization"("id") ON DELETE CASCADE,
        "client_id" integer NOT NULL REFERENCES "clients"("id") ON DELETE CASCADE,
        "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
        "pulse_date" text NOT NULL,
        "risk_score" integer NOT NULL,
        "sentiment" text NOT NULL,
        "primary_factor" text,
        "notes" text,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS "pulse_client_date_idx" ON "client_pulse_ratings" ("client_id", "pulse_date");
      CREATE INDEX IF NOT EXISTS "pulse_org_idx" ON "client_pulse_ratings" ("organization_id");
      CREATE INDEX IF NOT EXISTS "pulse_user_idx" ON "client_pulse_ratings" ("user_id");
    `);
    hasEnsuredPulseSchema = true;
  } catch (e) {
    console.warn("ensurePulseSchema error (ignoring if already exists):", e);
  }
}

export interface StaffRatingSummary {
  id: number;
  userId: string;
  userName: string;
  userEmail: string;
  userRole?: string;
  riskScore: number;
  sentiment: string;
  primaryFactor: string | null;
  notes: string | null;
  updatedAt: string;
}

export interface ClientPulseItem {
  id: number;
  name: string;
  industry: string;
  status: string;
  websiteUrl: string | null;
  googleEnabled: boolean;
  metaEnabled: boolean;
  // Performance stats (7 days)
  recentLeads: number;
  priorLeads: number;
  leadsWowChange: number | null; // percentage
  recentSpend: number;
  recentCpa: number;
  targetCpa: number | null;
  cpaVariance: number | null; // percentage vs target
  ageInMonths?: number | null; // months since first Google Ads spend
  ageModifier?: number; // 0.25 (<1m), 0.75 (<3m), 0.9 (<6m), 1.0 (6m+)
  automatedRiskScore: number; // 0 - 100
  automatedFlags: string[];
  // Team sentiment stats
  teamSentimentScore: number | null; // 0 - 100
  staffRatingsCount: number;
  staffRatings: StaffRatingSummary[];
  currentUserRating?: StaffRatingSummary | null;
  // Aggregated Composite Churn Risk
  compositeRiskScore: number; // 0 - 100
  riskTier: "low" | "moderate" | "high";
  awaitingTeamPulse: boolean;
  wowTrend: number | null; // change in risk score vs last week
}

export interface ClientPulseBoardData {
  pulseDate: string;
  prevPulseDate: string;
  clients: ClientPulseItem[];
  teamMembers: Array<{
    id: string;
    name: string;
    email: string;
    role: string;
  }>;
  summary: {
    totalClients: number;
    highRiskCount: number;
    moderateRiskCount: number;
    healthyCount: number;
    avgPortfolioRisk: number;
    pulseCoveragePercent: number;
  };
}

/**
 * Loads all active clients, computes automated performance metrics (leads WoW, CPA vs target),
 * pulls all staff sentiment entries for the week, and aggregates the composite Churn Risk.
 */
export async function getClientPulseBoardDataAction(
  weekOffset: number = 0,
  orgIdOverride?: string,
): Promise<{ success: boolean; data?: ClientPulseBoardData; error?: string }> {
  try {
    let orgId: string | null = orgIdOverride || null;
    let currentUserId: string | null = null;

    if (!orgId) {
      try {
        const ctx = await getAuthOrgContext();
        if (ctx?.orgId) {
          orgId = ctx.orgId;
          currentUserId = ctx.userId;
        }
      } catch {
        // Headers might not exist in non-request/cron contexts
      }
    }

    if (!orgId) {
      // Fallback to default organization
      const firstOrg = await db.query.organization.findFirst();
      if (firstOrg) {
        orgId = firstOrg.id;
      }
    }

    if (!orgId) {
      return {
        success: false,
        error: "Unauthorized: Active organization context missing",
      };
    }

    await ensurePulseSchema();

    const pulseDate = getWeekMondayString(weekOffset);
    const prevPulseDate = getWeekMondayString(weekOffset - 1);

    // 1. Fetch only active clients for the organization
    const clientsList = await db.query.clients.findMany({
      where: and(
        eq(clients.organizationId, orgId),
        eq(clients.status, "active"),
      ),
      orderBy: [clients.name],
      with: {
        adAccounts: true,
        metaAdAccounts: true,
      },
    });

    if (clientsList.length === 0) {
      return {
        success: true,
        data: {
          pulseDate,
          prevPulseDate,
          clients: [],
          teamMembers: [],
          summary: {
            totalClients: 0,
            highRiskCount: 0,
            moderateRiskCount: 0,
            healthyCount: 0,
            avgPortfolioRisk: 0,
            pulseCoveragePercent: 0,
          },
        },
      };
    }

    // 2. Fetch team members in organization
    const teamMembers = await db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        role: member.role,
      })
      .from(member)
      .innerJoin(user, eq(member.userId, user.id))
      .where(eq(member.organizationId, orgId));

    const userMap = new Map<
      string,
      { name: string; email: string; role: string }
    >();
    for (const m of teamMembers) {
      userMap.set(m.id, { name: m.name, email: m.email, role: m.role });
    }

    // 3. Fetch pulse ratings for both current week and previous week
    const ratings = await db.query.clientPulseRatings.findMany({
      where: and(
        eq(clientPulseRatings.organizationId, orgId),
        inArray(clientPulseRatings.pulseDate, [pulseDate, prevPulseDate]),
      ),
    });

    // 4. Fetch last 14 days of ad performance daily data
    const allAdAccountIds: number[] = [];
    for (const c of clientsList) {
      for (const a of c.adAccounts || []) {
        allAdAccountIds.push(a.id);
      }
    }

    // Dates for last 7d vs prior 7d
    const today = new Date();
    const d7Ago = new Date();
    d7Ago.setUTCDate(today.getUTCDate() - 7);
    const d14Ago = new Date();
    d14Ago.setUTCDate(today.getUTCDate() - 14);

    const d7AgoStr = d7Ago.toISOString().split("T")[0];
    const d14AgoStr = d14Ago.toISOString().split("T")[0];
    const todayStr = today.toISOString().split("T")[0];

    let performanceRows: Array<{
      adAccountId: number;
      date: string;
      spend: string;
      conversions: string;
    }> = [];

    if (allAdAccountIds.length > 0) {
      try {
        performanceRows = await db
          .select({
            adAccountId: adPerformanceDaily.adAccountId,
            date: adPerformanceDaily.date,
            spend: adPerformanceDaily.spend,
            conversions: adPerformanceDaily.conversions,
          })
          .from(adPerformanceDaily)
          .where(
            and(
              inArray(adPerformanceDaily.adAccountId, allAdAccountIds),
              gte(adPerformanceDaily.date, d14AgoStr),
              lte(adPerformanceDaily.date, todayStr),
            ),
          );
      } catch (err) {
        console.warn(
          "Could not query adPerformanceDaily for pulse board:",
          err,
        );
      }
    }

    // 4b. Fetch earliest Google Ads spend date across campaigns to calculate account age
    const firstSpendMap = new Map<number, string>();
    if (allAdAccountIds.length > 0) {
      try {
        const firstSpendRows = await db
          .select({
            adAccountId: adPerformanceDaily.adAccountId,
            firstDate: sql<string>`min(${adPerformanceDaily.date})`,
          })
          .from(adPerformanceDaily)
          .where(
            and(
              inArray(adPerformanceDaily.adAccountId, allAdAccountIds),
              sql`cast(${adPerformanceDaily.spend} as numeric) > 0`,
            ),
          )
          .groupBy(adPerformanceDaily.adAccountId);

        for (const row of firstSpendRows) {
          if (row.adAccountId && row.firstDate) {
            firstSpendMap.set(row.adAccountId, String(row.firstDate));
          }
        }
      } catch (err) {
        console.warn(
          "Could not query earliest spend date for account age:",
          err,
        );
      }
    }

    // 5. Build per-client pulse data
    const clientItems: ClientPulseItem[] = [];

    for (const c of clientsList) {
      const clientAdAccIds = (c.adAccounts || []).map((a) => a.id);
      const targetCpaVal =
        c.adAccounts?.[0]?.targetCpa || c.metaAdAccounts?.[0]?.targetCpa;
      const targetCpa = targetCpaVal ? parseFloat(String(targetCpaVal)) : null;

      // Determine earliest Google Ads campaign spend date for this client
      let earliestSpendStr: string | null = null;
      for (const accId of clientAdAccIds) {
        const d = firstSpendMap.get(accId);
        if (d) {
          if (!earliestSpendStr || d < earliestSpendStr) {
            earliestSpendStr = d;
          }
        }
      }

      // Compute age in months based on first Google Ads spend date
      let ageInMonths: number | null = null;
      let ageModifier = 1.0; // mature baseline default (6+ months)

      if (earliestSpendStr) {
        const firstSpendDate = new Date(earliestSpendStr);
        const diffMs = today.getTime() - firstSpendDate.getTime();
        const diffDays = Math.max(
          0,
          Math.floor(diffMs / (1000 * 60 * 60 * 24)),
        );
        ageInMonths = Math.round((diffDays / 30.4) * 10) / 10;

        if (ageInMonths < 1) {
          ageModifier = 0.25; // Ramp-up month 1
        } else if (ageInMonths < 3) {
          ageModifier = 0.75; // Learning months 1-3
        } else if (ageInMonths < 6) {
          ageModifier = 0.9; // Scaling months 3-6
        } else {
          ageModifier = 1.0; // Mature 6m+
        }
      }

      // Group performance for this client into recent 7d and prior 7d
      let recentConversions = 0;
      let recentSpend = 0;
      let priorConversions = 0;
      let priorSpend = 0;

      for (const row of performanceRows) {
        if (clientAdAccIds.includes(row.adAccountId)) {
          const s = parseFloat(row.spend || "0") || 0;
          const conv = parseFloat(row.conversions || "0") || 0;
          if (row.date >= d7AgoStr) {
            recentSpend += s;
            recentConversions += conv;
          } else {
            priorSpend += s;
            priorConversions += conv;
          }
        }
      }

      recentConversions = Math.round(recentConversions * 10) / 10;
      priorConversions = Math.round(priorConversions * 10) / 10;
      recentSpend = Math.round(recentSpend);
      const recentCpa =
        recentConversions > 0 ? Math.round(recentSpend / recentConversions) : 0;

      // WoW Conversion Change
      let leadsWowChange: number | null = null;
      if (priorConversions > 0) {
        leadsWowChange = Math.round(
          ((recentConversions - priorConversions) / priorConversions) * 100,
        );
      } else if (recentConversions > 0) {
        leadsWowChange = 100;
      }

      // Industry Benchmark CPAs when explicit targetCpa is not configured
      const INDUSTRY_BENCHMARK_CPAS: Record<string, number> = {
        BUILDING_CONSTRUCTION: 180,
        HOME_SERVICES_TRADES: 85,
        ENERGY_SOLAR: 140,
        LEGAL_FINANCIAL: 200,
        HEALTHCARE_MEDICAL: 110,
        AUTOMOTIVE_TRANSPORT: 90,
        PROFESSIONAL_B2B: 150,
        REAL_ESTATE_PROPERTY: 120,
        ECOMMERCE_RETAIL: 60,
        EDUCATION_TRAINING: 100,
        HOSPITALITY_EVENTS: 80,
        OTHER: 120,
      };

      const industryKey = c.industry || "OTHER";
      const targetOrBench =
        targetCpa && targetCpa > 0
          ? targetCpa
          : INDUSTRY_BENCHMARK_CPAS[industryKey] || 120;

      // CPA Variance vs Target/Benchmark
      let cpaVariance: number | null = null;
      if (recentCpa > 0 && targetOrBench > 0) {
        cpaVariance = Math.round(
          ((recentCpa - targetOrBench) / targetOrBench) * 100,
        );
      }

      // Automated Risk Scoring (0 to 100)
      let autoRisk = 15; // baseline healthy
      const automatedFlags: string[] = [];

      // 1. Zero Conversions Branch
      if (recentConversions === 0) {
        if (recentSpend === 0) {
          // Paused / dormant
          autoRisk = 20;
          if (priorSpend > 50) {
            automatedFlags.push("Spend paused (0 spend in 7d)");
          }
        } else if (recentSpend < 1.5 * targetOrBench) {
          // Micro-spend / normal delivery variance within expected inquiry cost
          autoRisk = 20;
        } else if (recentSpend >= 2.5 * targetOrBench) {
          // Critical wasted spend
          autoRisk += 40;
          automatedFlags.push(
            `0 leads despite active spend ($${recentSpend} > 2.5x target)`,
          );
        } else {
          // Moderate concern (1.5x - 2.5x target)
          autoRisk += 25;
          automatedFlags.push(
            `0 leads with spend >1.5x target ($${recentSpend})`,
          );
        }
      } else {
        // 2. Active Conversions Branch
        // Lead Drops: Gated by volume to prevent small-number volatility
        const leadDiff = recentConversions - priorConversions;
        if (priorConversions >= 10) {
          // High-volume account: percentage drop is meaningful
          if (leadsWowChange !== null) {
            if (leadsWowChange <= -35) {
              autoRisk += 30;
              automatedFlags.push(
                `Leads dropped ${Math.abs(leadsWowChange)}% WoW`,
              );
            } else if (leadsWowChange <= -20) {
              autoRisk += 20;
              automatedFlags.push(
                `Leads down ${Math.abs(leadsWowChange)}% WoW`,
              );
            }
          }
        } else if (priorConversions > 0) {
          // Low-volume account: evaluate absolute drops only
          const leadDrop = priorConversions - recentConversions;
          if (leadDrop >= 5) {
            autoRisk += 25;
            automatedFlags.push(`Leads dropped -${leadDrop} WoW`);
          } else if (leadDrop >= 3) {
            autoRisk += 15;
            automatedFlags.push(`Leads down -${leadDrop} WoW`);
          }
          // Drops of <= 2 leads on low-volume accounts are normal statistical noise
        }

        // CPA Variance vs Target / Industry Benchmark
        if (recentCpa > 1.8 * targetOrBench) {
          autoRisk += 30;
          automatedFlags.push(
            `CPA +${cpaVariance}% above target ($${recentCpa} vs $${targetOrBench})`,
          );
        } else if (recentCpa > 1.3 * targetOrBench) {
          autoRisk += 15;
          automatedFlags.push(
            `CPA +${cpaVariance}% above target ($${recentCpa} vs $${targetOrBench})`,
          );
        }

        // CPA Redeeming Guardrail: If CPA is on target or better, protect against false alarms
        if (recentCpa <= targetOrBench && recentConversions >= 2) {
          autoRisk = Math.min(autoRisk, 25);
          if (targetCpa && targetCpa > 0) {
            automatedFlags.push(
              `CPA on target ($${recentCpa} <= $${targetCpa})`,
            );
          }
        }

        // Lead Growth Reward
        if (
          leadsWowChange !== null &&
          leadsWowChange >= 15 &&
          recentConversions >= 3
        ) {
          autoRisk = Math.max(5, autoRisk - 10);
          automatedFlags.push(`Leads up +${leadsWowChange}% WoW`);
        }
      }

      // 3. Account Age Modifier (Interpretation B: Ramp-up Penalty Dampener)
      // New accounts (<6m since first spend) receive scaled penalties while campaigns ramp & learn
      if (ageModifier < 1.0 && autoRisk > 15) {
        const rawPenalty = autoRisk - 15;
        const scaledPenalty = Math.round(rawPenalty * ageModifier);
        autoRisk = 15 + scaledPenalty;

        const ageLabel =
          ageInMonths !== null && ageInMonths < 1
            ? "<1m ramp-up"
            : ageInMonths !== null && ageInMonths < 3
              ? `${ageInMonths}m learning`
              : `${ageInMonths}m scaling`;
        automatedFlags.push(
          `Age modifier applied: ${Math.round(ageModifier * 100)}% (${ageLabel})`,
        );
      }

      const automatedRiskScore = Math.max(5, Math.min(95, autoRisk));

      // Staff Sentiment Ratings for this client (Current Week)
      const clientCurrentRatings = ratings.filter(
        (r) => r.clientId === c.id && r.pulseDate === pulseDate,
      );
      // Previous week ratings for trend
      const clientPrevRatings = ratings.filter(
        (r) => r.clientId === c.id && r.pulseDate === prevPulseDate,
      );

      const staffRatings: StaffRatingSummary[] = clientCurrentRatings.map(
        (r) => {
          const u = userMap.get(r.userId);
          return {
            id: r.id,
            userId: r.userId,
            userName: u?.name || "Staff Member",
            userEmail: u?.email || "",
            userRole: u?.role,
            riskScore: r.riskScore,
            sentiment: r.sentiment,
            primaryFactor: r.primaryFactor,
            notes: r.notes,
            updatedAt: r.updatedAt.toISOString(),
          };
        },
      );

      const currentUserRating =
        staffRatings.find((sr) => sr.userId === currentUserId) || null;

      let teamSentimentScore: number | null = null;
      if (staffRatings.length > 0) {
        const sum = staffRatings.reduce((acc, curr) => acc + curr.riskScore, 0);
        teamSentimentScore = Math.round(sum / staffRatings.length);
      }

      // Previous week score for WoW trend
      let prevCompositeScore: number | null = null;
      if (clientPrevRatings.length > 0) {
        const prevSum = clientPrevRatings.reduce(
          (acc, curr) => acc + curr.riskScore,
          0,
        );
        const prevTeamAvg = Math.round(prevSum / clientPrevRatings.length);
        prevCompositeScore = prevTeamAvg;
      }

      // Composite Churn Risk Score:
      let compositeRiskScore: number;
      let awaitingTeamPulse = false;

      const hasAdAccounts =
        clientAdAccIds.length > 0 || (c.metaAdAccounts || []).length > 0;

      if (teamSentimentScore !== null && hasAdAccounts) {
        // 50% Automated + 50% Team Consensus
        compositeRiskScore = Math.round(
          0.5 * automatedRiskScore + 0.5 * teamSentimentScore,
        );
      } else if (teamSentimentScore !== null) {
        // No ad accounts, 100% Team Sentiment
        compositeRiskScore = teamSentimentScore;
      } else if (hasAdAccounts) {
        // Awaiting team check-in, fallback to automated score
        compositeRiskScore = automatedRiskScore;
        awaitingTeamPulse = true;
      } else {
        // Fresh onboarding or unlinked client
        compositeRiskScore = 20;
        awaitingTeamPulse = true;
      }

      // WoW Trend in composite risk
      let wowTrend: number | null = null;
      if (prevCompositeScore !== null) {
        wowTrend = compositeRiskScore - prevCompositeScore;
      }

      // Risk Tier
      let riskTier: "low" | "moderate" | "high" = "low";
      if (compositeRiskScore > 60) {
        riskTier = "high";
      } else if (compositeRiskScore > 30) {
        riskTier = "moderate";
      }

      clientItems.push({
        id: c.id,
        name: c.name,
        industry: c.industry || "OTHER",
        status: c.status,
        websiteUrl: c.websiteUrl,
        googleEnabled: c.googleEnabled,
        metaEnabled: c.metaEnabled,
        recentLeads: recentConversions,
        priorLeads: priorConversions,
        leadsWowChange,
        recentSpend,
        recentCpa,
        targetCpa,
        cpaVariance,
        ageInMonths,
        ageModifier,
        automatedRiskScore,
        automatedFlags,
        teamSentimentScore,
        staffRatingsCount: staffRatings.length,
        staffRatings,
        currentUserRating,
        compositeRiskScore,
        riskTier,
        awaitingTeamPulse,
        wowTrend,
      });
    }

    // Sort: High risk first, then moderate, then low
    clientItems.sort((a, b) => b.compositeRiskScore - a.compositeRiskScore);

    // Summary calculations
    const totalClients = clientItems.length;
    const highRiskCount = clientItems.filter(
      (c) => c.riskTier === "high",
    ).length;
    const moderateRiskCount = clientItems.filter(
      (c) => c.riskTier === "moderate",
    ).length;
    const healthyCount = clientItems.filter((c) => c.riskTier === "low").length;
    const reviewedCount = clientItems.filter(
      (c) => c.staffRatingsCount > 0,
    ).length;
    const avgPortfolioRisk =
      totalClients > 0
        ? Math.round(
            clientItems.reduce(
              (acc, curr) => acc + curr.compositeRiskScore,
              0,
            ) / totalClients,
          )
        : 0;
    const pulseCoveragePercent =
      totalClients > 0 ? Math.round((reviewedCount / totalClients) * 100) : 0;

    return {
      success: true,
      data: {
        pulseDate,
        prevPulseDate,
        clients: clientItems,
        teamMembers,
        summary: {
          totalClients,
          highRiskCount,
          moderateRiskCount,
          healthyCount,
          avgPortfolioRisk,
          pulseCoveragePercent,
        },
      },
    };
  } catch (error: any) {
    console.error("getClientPulseBoardDataAction error:", error);
    return {
      success: false,
      error: error.message || "Failed to load standup pulse data",
    };
  }
}

/**
 * Submits or updates a staff member's pulse rating and standup note for a specific client.
 */
export async function submitClientPulseRatingAction(payload: {
  clientId: number;
  pulseDate?: string;
  riskScore: number; // 0 - 100
  sentiment: "low_risk" | "moderate_risk" | "high_risk" | "critical";
  primaryFactor?: string;
  notes?: string;
}) {
  try {
    const ctx = await getAuthOrgContext();
    if (!ctx || !ctx.orgId || !ctx.userId) {
      return {
        success: false,
        error: "Unauthorized: Active organization context missing",
      };
    }
    const orgId = ctx.orgId;
    const userId = ctx.userId;

    await ensurePulseSchema();

    const dateToUse = payload.pulseDate || getWeekMondayString(0);
    const scoreClamped = Math.max(
      0,
      Math.min(100, Math.round(payload.riskScore)),
    );

    // Check if entry already exists for (orgId, clientId, userId, pulseDate)
    const existing = await db.query.clientPulseRatings.findFirst({
      where: and(
        eq(clientPulseRatings.organizationId, orgId),
        eq(clientPulseRatings.clientId, payload.clientId),
        eq(clientPulseRatings.userId, userId),
        eq(clientPulseRatings.pulseDate, dateToUse),
      ),
    });

    if (existing) {
      await db
        .update(clientPulseRatings)
        .set({
          riskScore: scoreClamped,
          sentiment: payload.sentiment,
          primaryFactor: payload.primaryFactor || null,
          notes: payload.notes || null,
          updatedAt: new Date(),
        })
        .where(eq(clientPulseRatings.id, existing.id));
    } else {
      await db.insert(clientPulseRatings).values({
        organizationId: orgId,
        clientId: payload.clientId,
        userId: userId,
        pulseDate: dateToUse,
        riskScore: scoreClamped,
        sentiment: payload.sentiment,
        primaryFactor: payload.primaryFactor || null,
        notes: payload.notes || null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    revalidatePath("/clients/pulse");
    return { success: true };
  } catch (error: any) {
    console.error("submitClientPulseRatingAction error:", error);
    return {
      success: false,
      error: error.message || "Failed to submit pulse rating",
    };
  }
}

/**
 * Returns chronological historical pulse ratings for a client across previous weeks.
 */
export async function getClientPulseHistoryAction(clientId: number) {
  try {
    const ctx = await getAuthOrgContext();
    if (!ctx || !ctx.orgId) {
      return { success: false, error: "Unauthorized" };
    }
    const orgId = ctx.orgId;

    await ensurePulseSchema();

    const records = await db
      .select({
        id: clientPulseRatings.id,
        pulseDate: clientPulseRatings.pulseDate,
        riskScore: clientPulseRatings.riskScore,
        sentiment: clientPulseRatings.sentiment,
        primaryFactor: clientPulseRatings.primaryFactor,
        notes: clientPulseRatings.notes,
        createdAt: clientPulseRatings.createdAt,
        updatedAt: clientPulseRatings.updatedAt,
        userId: clientPulseRatings.userId,
        userName: user.name,
        userEmail: user.email,
      })
      .from(clientPulseRatings)
      .innerJoin(user, eq(clientPulseRatings.userId, user.id))
      .where(
        and(
          eq(clientPulseRatings.organizationId, orgId),
          eq(clientPulseRatings.clientId, clientId),
        ),
      )
      .orderBy(
        desc(clientPulseRatings.pulseDate),
        desc(clientPulseRatings.createdAt),
      );

    return { success: true, data: records };
  } catch (error: any) {
    console.error("getClientPulseHistoryAction error:", error);
    return {
      success: false,
      error: error.message || "Failed to fetch pulse history",
    };
  }
}
