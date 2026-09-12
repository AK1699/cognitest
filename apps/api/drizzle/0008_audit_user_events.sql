ALTER TABLE "audit_logs" ALTER COLUMN "organization_id" DROP NOT NULL;--> statement-breakpoint
-- user-scoped security events (login, password reset): no tenant, and the
-- SELECT policy stays org-only so tenants never see them
CREATE POLICY audit_logs_insert_user_event ON audit_logs FOR INSERT
  WITH CHECK (organization_id IS NULL AND actor_user_id = app_current_user_id());