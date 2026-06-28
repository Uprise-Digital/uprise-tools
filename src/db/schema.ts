import { relations } from "drizzle-orm";
import {
  boolean,
  date,
  decimal,
  doublePrecision,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

// --- 1. GOOGLE ADS CORE ---
export const adAccounts = pgTable("ad_accounts", {
  id: serial("id").primaryKey(),
  googleAccountId: text("google_account_id").notNull().unique(),
  name: text("name").notNull(),
  websiteUrl: text("website_url"), // <-- NEW: Required for the Threat Matrix
  currencyCode: text("currency_code").default("AUD"),
  timeZone: text("time_zone").default("Australia/Melbourne"),
  isActive: boolean("is_active").default(true).notNull(),
  lastSyncedAt: timestamp("last_synced_at").defaultNow(),
  syncStatus: text("sync_status"),
  syncError: text("sync_error"),
  includeInBriefing: boolean("include_in_briefing").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),

  targetCpa: decimal("target_cpa", { precision: 10, scale: 2 }),
  targetRoas: decimal("target_roas", { precision: 5, scale: 2 }),
  monthlyBudgetCap: decimal("monthly_budget_cap", { precision: 10, scale: 2 }),
  targetNotes: text("target_notes"),
});

export const accountMetrics = pgTable(
  "account_metrics",
  {
    id: serial("id").primaryKey(),
    adAccountId: integer("ad_account_id")
      .references(() => adAccounts.id, { onDelete: "cascade" })
      .notNull(),
    date: timestamp("date").notNull(),
    conversions: numeric("conversions").default("0"),
    cost: numeric("cost").default("0"),
    clicks: integer("clicks").default(0),
    impressions: integer("impressions").default(0),
    avgCpc: numeric("avg_cpc").default("0"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    dateIdx: index("date_idx").on(table.date),
    accountDateIdx: uniqueIndex("account_date_unique").on(
      table.adAccountId,
      table.date,
    ),
  }),
);

// --- 2. ALERT ENGINE ---
export const alertRules = pgTable("alert_rules", {
  id: serial("id").primaryKey(),
  adAccountId: integer("ad_account_id")
    .references(() => adAccounts.id)
    .notNull(),
  metric: text("metric").notNull(),
  timeWindow: text("time_window").notNull(),
  operator: text("operator").notNull(),
  threshold: numeric("threshold").notNull(),
  frequency: text("frequency").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const notificationRoutes = pgTable("notification_routes", {
  id: serial("id").primaryKey(),
  ruleId: integer("rule_id")
    .references(() => alertRules.id, { onDelete: "cascade" })
    .notNull(),
  emailAddress: text("email_address").notNull(),
});

export const alertLogs = pgTable("alert_logs", {
  id: serial("id").primaryKey(),
  ruleId: integer("rule_id")
    .references(() => alertRules.id)
    .notNull(),
  triggeredValue: numeric("triggered_value").notNull(),
  dispatchedAt: timestamp("dispatched_at").defaultNow().notNull(),
});

// --- 3. AUTHENTICATION & SESSIONS ---
export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("emailVerified").notNull(),
  image: text("image"),
  createdAt: timestamp("createdAt").notNull(),
  updatedAt: timestamp("updatedAt").notNull(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expiresAt").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("createdAt").notNull(),
  updatedAt: timestamp("updatedAt").notNull(),
  ipAddress: text("ipAddress"),
  userAgent: text("userAgent"),
  userId: text("userId")
    .notNull()
    .references(() => user.id),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("accountId").notNull(),
  providerId: text("providerId").notNull(),
  userId: text("userId")
    .notNull()
    .references(() => user.id),
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  idToken: text("idToken"),
  accessTokenExpiresAt: timestamp("accessTokenExpiresAt"),
  refreshTokenExpiresAt: timestamp("refreshTokenExpiresAt"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("createdAt").notNull(),
  updatedAt: timestamp("updatedAt").notNull(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt"),
  updatedAt: timestamp("updatedAt"),
});

// --- 4. AUDIT & LOGGING ---
export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  actorId: text("actor_id"),
  action: text("action").notNull(),
  targetTable: text("target_table").notNull(),
  targetId: text("target_id").notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const emailLogs = pgTable("email_logs", {
  id: serial("id").primaryKey(),
  adAccountId: integer("ad_account_id").references(() => adAccounts.id, { onDelete: "set null" }),
  recipient: text("recipient").notNull(),
  subject: text("subject").notNull(),
  emailType: text("email_type").notNull(), // 'morning_briefing', 'scheduled_report', 'on_demand_report'
  status: text("status").notNull(), // 'success', 'failed'
  error: text("error"),
  resendId: text("resend_id"),
  sentAt: timestamp("sent_at").defaultNow().notNull(),
});

// --- 5. AUTOMATION & REPORTS ---
export const reportSchedules = pgTable("report_schedules", {
  id: serial("id").primaryKey(),
  adAccountId: integer("ad_account_id")
    .references(() => adAccounts.id, { onDelete: "cascade" })
    .notNull(),
  frequency: text("frequency").notNull(),
  dayOfMonth: integer("day_of_month").default(1),
  dayOfWeek: integer("day_of_week"),
  recipientEmail: text("recipient_email").notNull(),
  ccEmails: text("cc_emails"),
  bccEmails: text("bcc_emails"),
  emailSubject: text("email_subject").notNull(),
  useAiSummary: boolean("use_ai_summary").default(true).notNull(),
  customAiInstructions: text("custom_ai_instructions"),
  customMessage: text("custom_message"),
  isActive: boolean("is_active").default(true).notNull(),
  lastRunAt: timestamp("last_run_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const adPerformanceDaily = pgTable(
  "ad_performance_daily",
  {
    id: serial("id").primaryKey(),
    adAccountId: integer("ad_account_id")
      .references(() => adAccounts.id, { onDelete: "cascade" })
      .notNull(),
    googleAccountId: text("google_account_id").notNull(),
    date: date("date").notNull(),
    campaignId: text("campaign_id").notNull(),
    campaignName: text("campaign_name").notNull(),
    spend: numeric("spend", { precision: 12, scale: 2 }).default("0").notNull(),
    impressions: integer("impressions").default(0).notNull(),
    clicks: integer("clicks").default(0).notNull(),
    conversions: numeric("conversions", { precision: 10, scale: 2 })
      .default("0")
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    uniqueDailyRecord: uniqueIndex("unique_daily_campaign_record").on(
      table.adAccountId,
      table.date,
      table.campaignId,
    ),
  }),
);

// --- 6. AI CACHING (NEW) ---
export const aiInsightsCache = pgTable(
  "ai_insights_cache",
  {
    id: serial("id").primaryKey(),
    adAccountId: integer("ad_account_id")
      .references(() => adAccounts.id, { onDelete: "cascade" })
      .notNull(),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    insights: jsonb("insights").notNull(), // Stores the full Gemini JSON response
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    // Ensures only one cached report exists per account + date range
    uniqueCacheRecord: uniqueIndex("unique_ai_cache_record").on(
      table.adAccountId,
      table.startDate,
      table.endDate,
    ),
  }),
);

// --- 7. RELATIONS ---
export const adAccountRelations = relations(adAccounts, ({ many, one }) => ({
  rules: many(alertRules),
  metrics: many(accountMetrics),
  reportSchedules: many(reportSchedules),
  dailyPerformance: many(adPerformanceDaily),
  aiInsights: many(aiInsightsCache),
  threatAudits: many(threatMatrixAudits), // <-- NEW
  triageSettings: one(accountTriageSettings),
}));

export const alertRuleRelations = relations(alertRules, ({ one, many }) => ({
  account: one(adAccounts, {
    fields: [alertRules.adAccountId],
    references: [adAccounts.id],
  }),
  notifications: many(notificationRoutes),
  logs: many(alertLogs),
}));

export const auditLogRelations = relations(auditLogs, ({ one }) => ({
  actor: one(user, { fields: [auditLogs.actorId], references: [user.id] }),
}));

export const emailLogRelations = relations(emailLogs, ({ one }) => ({
  account: one(adAccounts, {
    fields: [emailLogs.adAccountId],
    references: [adAccounts.id],
  }),
}));

export const accountMetricRelations = relations(accountMetrics, ({ one }) => ({
  account: one(adAccounts, {
    fields: [accountMetrics.adAccountId],
    references: [adAccounts.id],
  }),
}));

export const adPerformanceDailyRelations = relations(
  adPerformanceDaily,
  ({ one }) => ({
    account: one(adAccounts, {
      fields: [adPerformanceDaily.adAccountId],
      references: [adAccounts.id],
    }),
  }),
);

export const reportScheduleRelations = relations(
  reportSchedules,
  ({ one }) => ({
    account: one(adAccounts, {
      fields: [reportSchedules.adAccountId],
      references: [adAccounts.id],
    }),
  }),
);

export const aiInsightsCacheRelations = relations(
  aiInsightsCache,
  ({ one }) => ({
    account: one(adAccounts, {
      fields: [aiInsightsCache.adAccountId],
      references: [adAccounts.id],
    }),
  }),
);

// Add this near your other AI caching table
export const agencyAiInsightsCache = pgTable(
  "agency_ai_insights_cache",
  {
    id: serial("id").primaryKey(),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    insights: jsonb("insights").notNull(), // Stores the full Gemini JSON response
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    // Ensures only one cached report exists per date range
    uniqueAgencyCacheRecord: uniqueIndex("unique_agency_ai_cache_record").on(
      table.startDate,
      table.endDate,
    ),
  }),
);

// --- 8. COMPETITOR INTELLIGENCE (NEW) ---
export const threatMatrixAudits = pgTable("threat_matrix_audits", {
  id: serial("id").primaryKey(),
  adAccountId: integer("ad_account_id")
    .references(() => adAccounts.id, { onDelete: "cascade" })
    .notNull(),
  searchTerm: text("search_term").notNull(), // e.g., "emergency plumber melbourne"
  clientUrlScraped: text("client_url_scraped").notNull(),
  competitorUrlsScraped: jsonb("competitor_urls_scraped").notNull(), // Array of URLs
  aiAnalysis: jsonb("ai_analysis").notNull(), // Stores the full Gemini JSON response
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const threatMatrixAuditRelations = relations(
  threatMatrixAudits,
  ({ one }) => ({
    account: one(adAccounts, {
      fields: [threatMatrixAudits.adAccountId],
      references: [adAccounts.id],
    }),
  }),
);

export const mcpSettings = pgTable("mcp_settings", {
  id: serial("id").primaryKey(),
  agencyId: integer("agency_id").notNull().unique(), // Link to your agency/tenant
  apiKey: varchar("api_key", { length: 255 }).notNull().unique(),
  toolsConfig: jsonb("tools_config").notNull().default({
    godView: true,
    campaignDiagnostics: false,
  }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const briefingSettings = pgTable("briefing_settings", {
  id: serial("id").primaryKey(),
  recipients: jsonb("recipients").notNull().default([]), // Array of email strings
  sendTime: varchar("send_time", { length: 5 }).notNull().default("07:00"),
  dataPoints: jsonb("data_points").notNull().default({
    spend: true,
    conversions: true,
    cpa: true,
    clicks: true,
    impressions: true,
    ctr: true,
    cpc: true,
    anomalies: true,
    whaleAnalysis: true,
  }),
  isActive: boolean("is_active").default(true).notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const orgTriageDefaults = pgTable("org_triage_defaults", {
  id: serial("id").primaryKey(),
  criticalSpendThreshold: doublePrecision("critical_spend_threshold")
    .default(70.0)
    .notNull(),
  criticalConversionsThreshold: integer("critical_conversions_threshold")
    .default(0)
    .notNull(),
  ctrHighThreshold: doublePrecision("ctr_high_threshold")
    .default(7.0)
    .notNull(),
  ctrHighSpendThreshold: doublePrecision("ctr_high_spend_threshold")
    .default(50.0)
    .notNull(),
  cpcHighThreshold: doublePrecision("cpc_high_threshold")
    .default(30.0)
    .notNull(),
  anomalySpendChangeThreshold: doublePrecision("anomaly_spend_change_threshold")
    .default(-30.0)
    .notNull(),
  anomalyConversionsChangeThreshold: doublePrecision(
    "anomaly_conversions_change_threshold",
  )
    .default(-25.0)
    .notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const accountTriageSettings = pgTable("account_triage_settings", {
  id: serial("id").primaryKey(),
  adAccountId: integer("ad_account_id")
    .references(() => adAccounts.id, { onDelete: "cascade" })
    .unique()
    .notNull(),
  criticalSpendThreshold: doublePrecision("critical_spend_threshold"),
  criticalConversionsThreshold: integer("critical_conversions_threshold"),
  ctrHighThreshold: doublePrecision("ctr_high_threshold"),
  ctrHighSpendThreshold: doublePrecision("ctr_high_spend_threshold"),
  cpcHighThreshold: doublePrecision("cpc_high_threshold"),
  anomalySpendChangeThreshold: doublePrecision(
    "anomaly_spend_change_threshold",
  ),
  anomalyConversionsChangeThreshold: doublePrecision(
    "anomaly_conversions_change_threshold",
  ),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const accountTriageSettingsRelations = relations(
  accountTriageSettings,
  ({ one }) => ({
    adAccount: one(adAccounts, {
      fields: [accountTriageSettings.adAccountId],
      references: [adAccounts.id],
    }),
  }),
);
