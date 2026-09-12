-- Row-level security: tenant isolation as the second boundary behind app authz.
-- The API runtime connects as cognitest_app (no BYPASSRLS, not table owner).
-- Context arrives via transaction-local GUCs set by TenantDb (SET LOCAL).
-- Fail-closed: with no GUC set, app_current_org() is NULL and every policy
-- evaluates false — a forgotten context is a denial, never a leak.

CREATE OR REPLACE FUNCTION app_current_org() RETURNS uuid
  LANGUAGE sql STABLE AS
  $$ SELECT NULLIF(current_setting('app.organization_id', true), '')::uuid $$;--> statement-breakpoint

CREATE OR REPLACE FUNCTION app_current_user_id() RETURNS uuid
  LANGUAGE sql STABLE AS
  $$ SELECT NULLIF(current_setting('app.user_id', true), '')::uuid $$;--> statement-breakpoint

-- Grants for the runtime role. Guarded so a database without the role (e.g. a
-- brand-new environment migrating before creating it) still migrates cleanly.
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'cognitest_app') THEN
    GRANT USAGE ON SCHEMA public TO cognitest_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO cognitest_app;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public
      GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO cognitest_app;
    -- audit immutability, first layer: the role simply cannot mutate rows
    REVOKE UPDATE, DELETE ON audit_logs FROM cognitest_app;
  END IF;
END $$;--> statement-breakpoint

-- organizations: visible in tenant context, or to any member listing their orgs
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE organizations FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY organizations_select ON organizations FOR SELECT
  USING (
    id = app_current_org()
    OR EXISTS (
      SELECT 1 FROM organization_members m
      WHERE m.organization_id = organizations.id
        AND m.user_id = app_current_user_id()
    )
  );--> statement-breakpoint
CREATE POLICY organizations_insert ON organizations FOR INSERT
  WITH CHECK (id = app_current_org());--> statement-breakpoint
CREATE POLICY organizations_update ON organizations FOR UPDATE
  USING (id = app_current_org()) WITH CHECK (id = app_current_org());--> statement-breakpoint
CREATE POLICY organizations_delete ON organizations FOR DELETE
  USING (id = app_current_org());--> statement-breakpoint

-- organization_members: tenant-scoped, plus "my memberships" without org context
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE organization_members FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY organization_members_select ON organization_members FOR SELECT
  USING (organization_id = app_current_org() OR user_id = app_current_user_id());--> statement-breakpoint
CREATE POLICY organization_members_write ON organization_members
  USING (organization_id = app_current_org())
  WITH CHECK (organization_id = app_current_org());--> statement-breakpoint

-- plain tenant tables: one ALL policy each
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE teams FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY teams_tenant ON teams
  USING (organization_id = app_current_org())
  WITH CHECK (organization_id = app_current_org());--> statement-breakpoint

ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE team_members FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY team_members_tenant ON team_members
  USING (organization_id = app_current_org())
  WITH CHECK (organization_id = app_current_org());--> statement-breakpoint

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE projects FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY projects_tenant ON projects
  USING (organization_id = app_current_org())
  WITH CHECK (organization_id = app_current_org());--> statement-breakpoint

ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE project_members FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY project_members_tenant ON project_members
  USING (organization_id = app_current_org())
  WITH CHECK (organization_id = app_current_org());--> statement-breakpoint

ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE invitations FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY invitations_tenant ON invitations
  USING (organization_id = app_current_org())
  WITH CHECK (organization_id = app_current_org());--> statement-breakpoint

-- audit_logs: append-only within the tenant; no UPDATE/DELETE policy exists,
-- which combined with the revoked grants makes the trail immutable twice over
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE audit_logs FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY audit_logs_select ON audit_logs FOR SELECT
  USING (organization_id = app_current_org());--> statement-breakpoint
CREATE POLICY audit_logs_insert ON audit_logs FOR INSERT
  WITH CHECK (organization_id = app_current_org());--> statement-breakpoint

-- roles / role_permissions: ENABLE only (not FORCE) — the seed runs as the
-- owner and must manage organization_id IS NULL system roles, and no app-role
-- policy may permit NULL-org writes.
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY roles_select ON roles FOR SELECT
  USING (organization_id IS NULL OR organization_id = app_current_org());--> statement-breakpoint
CREATE POLICY roles_insert ON roles FOR INSERT
  WITH CHECK (organization_id = app_current_org() AND NOT is_system);--> statement-breakpoint
CREATE POLICY roles_update ON roles FOR UPDATE
  USING (organization_id = app_current_org() AND NOT is_system)
  WITH CHECK (organization_id = app_current_org() AND NOT is_system);--> statement-breakpoint
CREATE POLICY roles_delete ON roles FOR DELETE
  USING (organization_id = app_current_org() AND NOT is_system);--> statement-breakpoint

ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY role_permissions_select ON role_permissions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM roles r
    WHERE r.id = role_id
      AND (r.organization_id IS NULL OR r.organization_id = app_current_org())
  ));--> statement-breakpoint
CREATE POLICY role_permissions_write ON role_permissions
  USING (EXISTS (
    SELECT 1 FROM roles r
    WHERE r.id = role_id AND r.organization_id = app_current_org() AND NOT r.is_system
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM roles r
    WHERE r.id = role_id AND r.organization_id = app_current_org() AND NOT r.is_system
  ));