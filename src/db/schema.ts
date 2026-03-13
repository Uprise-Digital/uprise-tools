import { pgTable, serial, text, timestamp, integer, numeric, boolean, jsonb, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// --- 1. GOOGLE ADS CORE ---

export const adAccounts = pgTable('ad_accounts', {
    id: serial('id').primaryKey(),
    googleAccountId: text('google_account_id').notNull().unique(), // e.g., '123-456-7890'
    name: text('name').notNull(),
    currencyCode: text('currency_code').default('AUD'),
    timeZone: text('time_zone').default('Australia/Melbourne'),
    isActive: boolean('is_active').default(true).notNull(),
    lastSyncedAt: timestamp('last_synced_at').defaultNow(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Cache performance data here so PDF generation and Dashboards are instant
export const accountMetrics = pgTable('account_metrics', {
    id: serial('id').primaryKey(),
    adAccountId: integer('ad_account_id').references(() => adAccounts.id, { onDelete: 'cascade' }).notNull(),
    date: timestamp('date').notNull(), // The day this metric represents
    conversions: numeric('conversions').default('0'),
    cost: numeric('cost').default('0'),
    clicks: integer('clicks').default(0),
    impressions: integer('impressions').default(0),
    avgCpc: numeric('avg_cpc').default('0'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
    dateIdx: index('date_idx').on(table.date),
    accountDateIdx: uniqueIndex('account_date_unique').on(table.adAccountId, table.date),
}));

// --- 2. ALERT ENGINE ---

export const alertRules = pgTable('alert_rules', {
    id: serial('id').primaryKey(),
    adAccountId: integer('ad_account_id').references(() => adAccounts.id).notNull(),
    metric: text('metric').notNull(),
    timeWindow: text('time_window').notNull(), // e.g., 'YESTERDAY', 'LAST_7_DAYS'
    operator: text('operator').notNull(),
    threshold: numeric('threshold').notNull(),
    frequency: text('frequency').notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const notificationRoutes = pgTable('notification_routes', {
    id: serial('id').primaryKey(),
    ruleId: integer('rule_id').references(() => alertRules.id, { onDelete: 'cascade' }).notNull(),
    emailAddress: text('email_address').notNull(), // Who gets the alert
});

export const alertLogs = pgTable('alert_logs', {
    id: serial('id').primaryKey(),
    ruleId: integer('rule_id').references(() => alertRules.id).notNull(),
    triggeredValue: numeric('triggered_value').notNull(),
    dispatchedAt: timestamp('dispatched_at').defaultNow().notNull(),
});

// --- 3. AUTHENTICATION & SESSIONS ---

export const user = pgTable("user", {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    emailVerified: boolean("emailVerified").notNull(),
    image: text("image"),
    createdAt: timestamp("createdAt").notNull(),
    updatedAt: timestamp("updatedAt").notNull()
});

export const session = pgTable("session", {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expiresAt").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("createdAt").notNull(),
    updatedAt: timestamp("updatedAt").notNull(),
    ipAddress: text("ipAddress"),
    userAgent: text("userAgent"),
    userId: text("userId").notNull().references(() => user.id)
});

export const account = pgTable("account", {
    id: text("id").primaryKey(),
    accountId: text("accountId").notNull(),
    providerId: text("providerId").notNull(),
    userId: text("userId").notNull().references(() => user.id),
    accessToken: text("accessToken"),
    refreshToken: text("refreshToken"),
    idToken: text("idToken"),
    accessTokenExpiresAt: timestamp("accessTokenExpiresAt"),
    refreshTokenExpiresAt: timestamp("refreshTokenExpiresAt"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("createdAt").notNull(),
    updatedAt: timestamp("updatedAt").notNull()
});

export const verification = pgTable("verification", {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expiresAt").notNull(),
    createdAt: timestamp("createdAt"),
    updatedAt: timestamp("updatedAt")
});

// --- 4. AUDIT & LOGGING ---

export const auditLogs = pgTable("audit_logs", {
    id: serial("id").primaryKey(),
    actorId: text("actor_id").references(() => user.id).notNull(),
    action: text("action").notNull(),
    targetTable: text("target_table").notNull(),
    targetId: text("target_id").notNull(),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});

// --- 5. RELATIONS ---

export const adAccountRelations = relations(adAccounts, ({ many }) => ({
    rules: many(alertRules),
    metrics: many(accountMetrics),
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
    actor: one(user, {
        fields: [auditLogs.actorId],
        references: [user.id],
    }),
}));

export const accountMetricRelations = relations(accountMetrics, ({ one }) => ({
    account: one(adAccounts, {
        fields: [accountMetrics.adAccountId],
        references: [adAccounts.id],
    }),
}));