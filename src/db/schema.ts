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

// --- 1. AUTHENTICATION & SESSIONS ---
export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("emailVerified").notNull(),
  image: text("image"),
  role: text("role"),
  banned: boolean("banned"),
  banReason: text("banReason"),
  banExpires: timestamp("banExpires"),
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

// --- 2. ORGANIZATIONS & TENANCY (SaaS) ---
export const organization = pgTable("organization", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").unique(),
  logo: text("logo"),
  createdAt: timestamp("createdAt").notNull(),
  updatedAt: timestamp("updatedAt").notNull(),
  metadata: text("metadata"),
  // Stripe Subscription
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  subscriptionStatus: text("stripe_subscription_status"),
  subscriptionEndsAt: timestamp("stripe_subscription_ends_at"),
});

export const member = pgTable("member", {
  id: text("id").primaryKey(),
  organizationId: text("organizationId")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  createdAt: timestamp("createdAt").notNull(),
  updatedAt: timestamp("updatedAt").notNull(),
});

export const invitation = pgTable("invitation", {
  id: text("id").primaryKey(),
  organizationId: text("organizationId")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  role: text("role").notNull(),
  status: text("status").notNull(), // 'pending', 'accepted', 'rejected', 'canceled'
  expiresAt: timestamp("expiresAt").notNull(),
  inviterId: text("inviterId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  createdAt: timestamp("createdAt").notNull(),
  updatedAt: timestamp("updatedAt").notNull(),
});

export const googleAdsConnections = pgTable("google_ads_connections", {
  id: serial("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  connectedEmail: text("connected_email").notNull(),
  managerCustomerId: text("manager_customer_id").notNull(), // MCC Customer ID
  refreshToken: text("refresh_token").notNull(), // Encrypted at rest
  status: text("status").notNull().default("active"), // 'active', 'revoked', 'error'
  errorMessage: text("error_message"),
  autoAddAccounts: boolean("auto_add_accounts").default(false).notNull(),
  autoSyncScope: text("auto_sync_scope").default("ALL").notNull(), // 'ALL' | 'ACTIVE_ONLY'
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}).enableRLS();

export const usageLogs = pgTable("usage_logs", {
  id: serial("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
  actionType: text("action_type").notNull(), // 'gemini_query', 'google_ads_api_call', 'email_sent', 'pdf_generated'
  unitsUsed: integer("units_used").default(1).notNull(),
  estimatedCost: decimal("estimated_cost", { precision: 10, scale: 6 })
    .default("0.000000")
    .notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}).enableRLS();

export const clientOnboardings = pgTable("client_onboardings", {
  id: serial("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  ghlContactId: text("ghl_contact_id"),
  ghlOpportunityId: text("ghl_opportunity_id"),
  clientName: text("client_name").notNull(),
  primaryContactName: text("primary_contact_name").notNull(),
  contactEmail: text("contact_email").notNull(),
  googleAdsAccess: boolean("google_ads_access").default(true).notNull(),
  metaAdsAccess: boolean("meta_ads_access").default(true).notNull(),
  driveFolderLink: text("drive_folder_link"),
  notionDashboardLink: text("notion_dashboard_link"),
  signalGroupLink: text("signal_group_link"),
  status: text("status").default("draft").notNull(),
  googleAdsStatus: text("google_ads_status").default("pending").notNull(),
  metaAdsStatus: text("meta_ads_status").default("pending").notNull(),
  emailSentAt: timestamp("email_sent_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}).enableRLS();

// --- 3. GOOGLE ADS CORE ---
export const adAccounts = pgTable("ad_accounts", {
  id: serial("id").primaryKey(),
  organizationId: text("organization_id").notNull().default("default-org"),
  connectionId: integer("connection_id").references(
    () => googleAdsConnections.id,
    { onDelete: "cascade" },
  ),
  googleAccountId: text("google_account_id").notNull().unique(),
  name: text("name").notNull(),
  websiteUrl: text("website_url"), // <-- NEW: Required for the Threat Matrix
  currencyCode: text("currency_code").default("AUD"),
  timeZone: text("time_zone").default("Australia/Melbourne"),
  isActive: boolean("is_active").default(true).notNull(),
  googleStatus: text("google_status").default("ENABLED").notNull(),
  lastSyncedAt: timestamp("last_synced_at").defaultNow(),
  syncStatus: text("sync_status"),
  syncError: text("sync_error"),
  includeInBriefing: boolean("include_in_briefing").default(true).notNull(),
  negativeKeywordTurboMode: boolean("negative_keyword_turbo_mode")
    .default(false)
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),

  targetCpa: decimal("target_cpa", { precision: 10, scale: 2 }),
  targetRoas: decimal("target_roas", { precision: 5, scale: 2 }),
  monthlyBudgetCap: decimal("monthly_budget_cap", { precision: 10, scale: 2 }),
  targetNotes: text("target_notes"),
  clientOnboardingId: integer("client_onboarding_id").references(
    () => clientOnboardings.id,
    { onDelete: "set null" },
  ),
}).enableRLS();

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

// --- 4. ALERT ENGINE ---
export const alertRules = pgTable("alert_rules", {
  id: serial("id").primaryKey(),
  organizationId: text("organization_id").notNull().default("default-org"),
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
}).enableRLS();

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

// --- 4. AUDIT & LOGGING ---
export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  organizationId: text("organization_id").notNull().default("default-org"),
  actorId: text("actor_id"),
  action: text("action").notNull(),
  targetTable: text("target_table").notNull(),
  targetId: text("target_id").notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}).enableRLS();

export const emailLogs = pgTable("email_logs", {
  id: serial("id").primaryKey(),
  organizationId: text("organization_id").notNull().default("default-org"),
  adAccountId: integer("ad_account_id").references(() => adAccounts.id, {
    onDelete: "set null",
  }),
  recipient: text("recipient").notNull(),
  subject: text("subject").notNull(),
  emailType: text("email_type").notNull(), // 'morning_briefing', 'scheduled_report', 'on_demand_report'
  status: text("status").notNull(), // 'success', 'failed'
  error: text("error"),
  resendId: text("resend_id"),
  sentAt: timestamp("sent_at").defaultNow().notNull(),
}).enableRLS();

// --- 5. AUTOMATION & REPORTS ---
export const reportSchedules = pgTable("report_schedules", {
  id: serial("id").primaryKey(),
  organizationId: text("organization_id").notNull().default("default-org"),
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
}).enableRLS();

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
export const clientOnboardingRelations = relations(
  clientOnboardings,
  ({ one, many }) => ({
    organization: one(organization, {
      fields: [clientOnboardings.organizationId],
      references: [organization.id],
    }),
    adAccounts: many(adAccounts),
  }),
);

export const adAccountRelations = relations(adAccounts, ({ many, one }) => ({
  rules: many(alertRules),
  metrics: many(accountMetrics),
  reportSchedules: many(reportSchedules),
  dailyPerformance: many(adPerformanceDaily),
  aiInsights: many(aiInsightsCache),
  threatAudits: many(threatMatrixAudits), // <-- NEW
  triageSettings: one(accountTriageSettings),
  negativeKeywordSuggestions: many(negativeKeywordSuggestions),
  campaignLandingPages: many(campaignLandingPages),
  landingPageAudits: many(landingPageAudits),
  clientOnboarding: one(clientOnboardings, {
    fields: [adAccounts.clientOnboardingId],
    references: [clientOnboardings.id],
  }),
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

// --- 7B. AI MODEL PRICING & BUDGET LIMITS (NEW) ---
export const aiModelPricing = pgTable("ai_model_pricing", {
  modelName: text("model_name").primaryKey(),
  inputCostPerMillion: decimal("input_cost_per_million", {
    precision: 10,
    scale: 6,
  }).notNull(),
  outputCostPerMillion: decimal("output_cost_per_million", {
    precision: 10,
    scale: 6,
  }).notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const aiUsageSettings = pgTable("ai_usage_settings", {
  id: serial("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .unique()
    .references(() => organization.id, { onDelete: "cascade" }),
  monthlyBudgetLimit: decimal("monthly_budget_limit", {
    precision: 10,
    scale: 2,
  })
    .default("50.00")
    .notNull(),
  softLimitPercentage: integer("soft_limit_percentage").default(80).notNull(),
  hardLimitBlocked: boolean("hard_limit_blocked").default(true).notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}).enableRLS();

export const aiUsageSettingsRelations = relations(
  aiUsageSettings,
  ({ one }) => ({
    organization: one(organization, {
      fields: [aiUsageSettings.organizationId],
      references: [organization.id],
    }),
  }),
);

export const usageLogsRelations = relations(usageLogs, ({ one }) => ({
  user: one(user, {
    fields: [usageLogs.userId],
    references: [user.id],
  }),
  organization: one(organization, {
    fields: [usageLogs.organizationId],
    references: [organization.id],
  }),
}));

// --- 8. COMPETITOR INTELLIGENCE (NEW) ---
export const threatMatrixAudits = pgTable("threat_matrix_audits", {
  id: serial("id").primaryKey(),
  organizationId: text("organization_id").notNull().default("default-org"),
  adAccountId: integer("ad_account_id")
    .references(() => adAccounts.id, { onDelete: "cascade" })
    .notNull(),
  searchTerm: text("search_term").notNull(), // e.g., "emergency plumber melbourne"
  clientUrlScraped: text("client_url_scraped").notNull(),
  competitorUrlsScraped: jsonb("competitor_urls_scraped").notNull(), // Array of URLs
  aiAnalysis: jsonb("ai_analysis").notNull(), // Stores the full Gemini JSON response
  createdAt: timestamp("created_at").defaultNow().notNull(),
}).enableRLS();

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
  organizationId: text("organization_id").notNull().unique(),
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
  organizationId: text("organization_id").notNull().default("default-org"),
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
}).enableRLS();

export const salesReminderSettings = pgTable("sales_reminder_settings", {
  id: serial("id").primaryKey(),
  organizationId: text("organization_id").notNull().default("default-org"),
  recipients: jsonb("recipients").notNull().default([]), // Array of email strings
  sendTime: varchar("send_time", { length: 5 }).notNull().default("08:00"),
  isActive: boolean("is_active").default(true).notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}).enableRLS();

export const orgTriageDefaults = pgTable("org_triage_defaults", {
  id: serial("id").primaryKey(),
  organizationId: text("organization_id").notNull().default("default-org"),
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
}).enableRLS();

export const accountTriageSettings = pgTable("account_triage_settings", {
  id: serial("id").primaryKey(),
  organizationId: text("organization_id").notNull().default("default-org"),
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
}).enableRLS();

export const accountTriageSettingsRelations = relations(
  accountTriageSettings,
  ({ one }) => ({
    adAccount: one(adAccounts, {
      fields: [accountTriageSettings.adAccountId],
      references: [adAccounts.id],
    }),
  }),
);

export const negativeKeywordSuggestions = pgTable(
  "negative_keyword_suggestions",
  {
    id: serial("id").primaryKey(),
    organizationId: text("organization_id").notNull().default("default-org"),
    adAccountId: integer("ad_account_id")
      .references(() => adAccounts.id, { onDelete: "cascade" })
      .notNull(),
    keyword: text("keyword").notNull(),
    matchType: text("match_type").notNull().default("phrase"), // 'broad', 'phrase', 'exact'
    campaignId: text("campaign_id").notNull(),
    campaignName: text("campaign_name").notNull(),
    rationale: text("rationale").notNull(),
    status: text("status").notNull().default("pending"), // 'pending', 'approved', 'denied', 'archived'
    searchQuery: text("search_query"),
    clicks: integer("clicks").default(0),
    impressions: integer("impressions").default(0),
    spend: numeric("spend", { precision: 12, scale: 2 }).default("0").notNull(),
    conversions: numeric("conversions", { precision: 10, scale: 2 })
      .default("0")
      .notNull(),
    suggestedAt: timestamp("suggested_at").defaultNow().notNull(),
    processedAt: timestamp(),
    error: text("error"),
  },
).enableRLS();

export const negativeKeywordSuggestionsRelations = relations(
  negativeKeywordSuggestions,
  ({ one }) => ({
    account: one(adAccounts, {
      fields: [negativeKeywordSuggestions.adAccountId],
      references: [adAccounts.id],
    }),
  }),
);

// --- 9. LANDING PAGE ANALYSIS (NEW) ---
export const campaignLandingPages = pgTable(
  "campaign_landing_pages",
  {
    id: serial("id").primaryKey(),
    organizationId: text("organization_id").notNull().default("default-org"),
    adAccountId: integer("ad_account_id")
      .references(() => adAccounts.id, { onDelete: "cascade" })
      .notNull(),
    campaignId: text("campaign_id").notNull(),
    campaignName: text("campaign_name").notNull(),
    url: text("url").notNull(),
    status: text("status").notNull().default("ENABLED"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    uniqueCampaignLp: uniqueIndex("unique_campaign_lp").on(
      table.adAccountId,
      table.campaignId,
    ),
  }),
).enableRLS();

export const landingPageAudits = pgTable("landing_page_audits", {
  id: serial("id").primaryKey(),
  organizationId: text("organization_id").notNull().default("default-org"),
  adAccountId: integer("ad_account_id")
    .references(() => adAccounts.id, { onDelete: "cascade" })
    .notNull(),
  campaignId: text("campaign_id"), // Nullable for standalone landing pages
  campaignName: text("campaign_name"),
  url: text("url").notNull(),
  searchTerm: text("search_term").notNull(),
  score: integer("score").notNull(),
  heroScore: integer("hero_score").default(0).notNull(),
  ctaScore: integer("cta_score").default(0).notNull(),
  trustScore: integer("trust_score").default(0).notNull(),
  mobileScore: integer("mobile_score").default(0).notNull(),
  copyScore: integer("copy_score").default(0).notNull(),
  seoScore: integer("seo_score").default(0).notNull(),
  designScore: integer("design_score").default(0).notNull(),
  flowScore: integer("flow_score").default(0).notNull(),
  marketFitScore: integer("market_fit_score").default(0).notNull(),
  techScore: integer("tech_score").default(0).notNull(),
  aiAnalysis: jsonb("ai_analysis").notNull(), // Stores markdown lists, competitor matrix, and roadmaps
  auditType: text("audit_type").notNull().default("PAGE_SOURCE"),
  screenshotUrl: text("screenshot_url"),
  screenshotMobileUrl: text("screenshot_mobile_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}).enableRLS();

export const campaignLandingPagesRelations = relations(
  campaignLandingPages,
  ({ one }) => ({
    account: one(adAccounts, {
      fields: [campaignLandingPages.adAccountId],
      references: [adAccounts.id],
    }),
  }),
);

export const landingPageAuditsRelations = relations(
  landingPageAudits,
  ({ one }) => ({
    account: one(adAccounts, {
      fields: [landingPageAudits.adAccountId],
      references: [adAccounts.id],
    }),
  }),
);

export const adGroupAdAudits = pgTable("ad_group_ad_audits", {
  id: serial("id").primaryKey(),
  organizationId: text("organization_id").notNull().default("default-org"),
  adAccountId: integer("ad_account_id")
    .references(() => adAccounts.id, { onDelete: "cascade" })
    .notNull(),
  campaignId: text("campaign_id").notNull(),
  campaignName: text("campaign_name").notNull(),
  adGroupId: text("ad_group_id").notNull(),
  adGroupName: text("ad_group_name").notNull(),
  adId: text("ad_id").notNull(),
  searchTerm: text("search_term").notNull(),
  score: integer("score").notNull(),
  adStrength: text("ad_strength").notNull(),
  messageMatchScore: integer("message_match_score").default(0).notNull(),
  aiAnalysis: jsonb("ai_analysis").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}).enableRLS();

export const adGroupAdAuditsRelations = relations(
  adGroupAdAudits,
  ({ one }) => ({
    account: one(adAccounts, {
      fields: [adGroupAdAudits.adAccountId],
      references: [adAccounts.id],
    }),
  }),
);

export const backgroundTasks = pgTable("background_tasks", {
  id: serial("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  status: text("status").notNull().default("running"), // 'running', 'completed', 'failed'
  error: text("error"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}).enableRLS();

export const backgroundTasksRelations = relations(
  backgroundTasks,
  ({ one }) => ({
    organization: one(organization, {
      fields: [backgroundTasks.organizationId],
      references: [organization.id],
    }),
  }),
);

export const organizationOnboardingSettings = pgTable(
  "organization_onboarding_settings",
  {
    id: serial("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .unique()
      .references(() => organization.id, { onDelete: "cascade" }),
    googleDriveEnabled: boolean("google_drive_enabled")
      .default(false)
      .notNull(),
    googleDriveParentFolderId: text("google_drive_parent_folder_id"),
    googleDriveTemplateFolderId: text("google_drive_template_folder_id"),
    googleDriveRefreshToken: text("google_drive_refresh_token"),
    googleDriveEmail: text("google_drive_email"),
    googleDriveStatus: text("google_drive_status")
      .default("unconfigured")
      .notNull(),
    googleDriveError: text("google_drive_error"),
    notionEnabled: boolean("notion_enabled").default(false).notNull(),
    notionApiKey: text("notion_api_key"),
    notionParentPageId: text("notion_parent_page_id"),
    notionTemplatePageId: text("notion_template_page_id"),
    notionStatus: text("notion_status").default("unconfigured").notNull(),
    notionError: text("notion_error"),
    welcomeEmailSubject: text("welcome_email_subject"),
    welcomeEmailTemplate: text("welcome_email_template"),
    workflowConfig: jsonb("workflow_config"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
).enableRLS();

export const organizationOnboardingSettingsRelations = relations(
  organizationOnboardingSettings,
  ({ one }) => ({
    organization: one(organization, {
      fields: [organizationOnboardingSettings.organizationId],
      references: [organization.id],
    }),
  }),
);
