-- 1. Enable RLS on tables
ALTER TABLE "ad_accounts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "google_ads_connections" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "usage_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "alert_rules" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "report_schedules" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "briefing_settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "org_triage_defaults" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "email_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "threat_matrix_audits" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "campaign_landing_pages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "landing_page_audits" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ad_group_ad_audits" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "negative_keyword_suggestions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "account_triage_settings" ENABLE ROW LEVEL SECURITY;

-- 2. Force RLS for table owners (Next.js connection)
ALTER TABLE "ad_accounts" FORCE ROW LEVEL SECURITY;
ALTER TABLE "google_ads_connections" FORCE ROW LEVEL SECURITY;
ALTER TABLE "usage_logs" FORCE ROW LEVEL SECURITY;
ALTER TABLE "alert_rules" FORCE ROW LEVEL SECURITY;
ALTER TABLE "report_schedules" FORCE ROW LEVEL SECURITY;
ALTER TABLE "briefing_settings" FORCE ROW LEVEL SECURITY;
ALTER TABLE "org_triage_defaults" FORCE ROW LEVEL SECURITY;
ALTER TABLE "audit_logs" FORCE ROW LEVEL SECURITY;
ALTER TABLE "email_logs" FORCE ROW LEVEL SECURITY;
ALTER TABLE "threat_matrix_audits" FORCE ROW LEVEL SECURITY;
ALTER TABLE "campaign_landing_pages" FORCE ROW LEVEL SECURITY;
ALTER TABLE "landing_page_audits" FORCE ROW LEVEL SECURITY;
ALTER TABLE "ad_group_ad_audits" FORCE ROW LEVEL SECURITY;
ALTER TABLE "negative_keyword_suggestions" FORCE ROW LEVEL SECURITY;
ALTER TABLE "account_triage_settings" FORCE ROW LEVEL SECURITY;

-- 3. Create Tenant Isolation Policies with Bypass check
CREATE POLICY tenant_isolation_policy ON "ad_accounts"
  FOR ALL USING (current_setting('app.bypass_rls', true) = 'true' OR organization_id = current_setting('app.current_organization_id', true));

CREATE POLICY tenant_isolation_policy ON "google_ads_connections"
  FOR ALL USING (current_setting('app.bypass_rls', true) = 'true' OR organization_id = current_setting('app.current_organization_id', true));

CREATE POLICY tenant_isolation_policy ON "usage_logs"
  FOR ALL USING (current_setting('app.bypass_rls', true) = 'true' OR organization_id = current_setting('app.current_organization_id', true));

CREATE POLICY tenant_isolation_policy ON "alert_rules"
  FOR ALL USING (current_setting('app.bypass_rls', true) = 'true' OR organization_id = current_setting('app.current_organization_id', true));

CREATE POLICY tenant_isolation_policy ON "report_schedules"
  FOR ALL USING (current_setting('app.bypass_rls', true) = 'true' OR organization_id = current_setting('app.current_organization_id', true));

CREATE POLICY tenant_isolation_policy ON "briefing_settings"
  FOR ALL USING (current_setting('app.bypass_rls', true) = 'true' OR organization_id = current_setting('app.current_organization_id', true));

CREATE POLICY tenant_isolation_policy ON "org_triage_defaults"
  FOR ALL USING (current_setting('app.bypass_rls', true) = 'true' OR organization_id = current_setting('app.current_organization_id', true));

CREATE POLICY tenant_isolation_policy ON "audit_logs"
  FOR ALL USING (current_setting('app.bypass_rls', true) = 'true' OR organization_id = current_setting('app.current_organization_id', true));

CREATE POLICY tenant_isolation_policy ON "email_logs"
  FOR ALL USING (current_setting('app.bypass_rls', true) = 'true' OR organization_id = current_setting('app.current_organization_id', true));

CREATE POLICY tenant_isolation_policy ON "threat_matrix_audits"
  FOR ALL USING (current_setting('app.bypass_rls', true) = 'true' OR organization_id = current_setting('app.current_organization_id', true));

CREATE POLICY tenant_isolation_policy ON "campaign_landing_pages"
  FOR ALL USING (current_setting('app.bypass_rls', true) = 'true' OR organization_id = current_setting('app.current_organization_id', true));

CREATE POLICY tenant_isolation_policy ON "landing_page_audits"
  FOR ALL USING (current_setting('app.bypass_rls', true) = 'true' OR organization_id = current_setting('app.current_organization_id', true));

CREATE POLICY tenant_isolation_policy ON "ad_group_ad_audits"
  FOR ALL USING (current_setting('app.bypass_rls', true) = 'true' OR organization_id = current_setting('app.current_organization_id', true));

CREATE POLICY tenant_isolation_policy ON "negative_keyword_suggestions"
  FOR ALL USING (current_setting('app.bypass_rls', true) = 'true' OR organization_id = current_setting('app.current_organization_id', true));

CREATE POLICY tenant_isolation_policy ON "account_triage_settings"
  FOR ALL USING (current_setting('app.bypass_rls', true) = 'true' OR organization_id = current_setting('app.current_organization_id', true));