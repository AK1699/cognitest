-- Domain schema categorization: tables move out of public into
-- identity / tenancy / access / product / audit. Enums and the app_* helper
-- functions stay in public. SET SCHEMA carries constraints, indexes, grants
-- and RLS policies (incl. FORCE) with each table.

CREATE SCHEMA IF NOT EXISTS identity;--> statement-breakpoint
CREATE SCHEMA IF NOT EXISTS tenancy;--> statement-breakpoint
CREATE SCHEMA IF NOT EXISTS access;--> statement-breakpoint
CREATE SCHEMA IF NOT EXISTS product;--> statement-breakpoint
CREATE SCHEMA IF NOT EXISTS audit;--> statement-breakpoint

ALTER TABLE public.users SET SCHEMA identity;--> statement-breakpoint
ALTER TABLE public.sessions SET SCHEMA identity;--> statement-breakpoint
ALTER TABLE public.oauth_accounts SET SCHEMA identity;--> statement-breakpoint
ALTER TABLE public.auth_tokens SET SCHEMA identity;--> statement-breakpoint
ALTER TABLE public.organizations SET SCHEMA tenancy;--> statement-breakpoint
ALTER TABLE public.organization_members SET SCHEMA tenancy;--> statement-breakpoint
ALTER TABLE public.teams SET SCHEMA tenancy;--> statement-breakpoint
ALTER TABLE public.team_members SET SCHEMA tenancy;--> statement-breakpoint
ALTER TABLE public.invitations SET SCHEMA tenancy;--> statement-breakpoint
ALTER TABLE public.roles SET SCHEMA access;--> statement-breakpoint
ALTER TABLE public.permissions SET SCHEMA access;--> statement-breakpoint
ALTER TABLE public.role_permissions SET SCHEMA access;--> statement-breakpoint
ALTER TABLE public.projects SET SCHEMA product;--> statement-breakpoint
ALTER TABLE public.project_members SET SCHEMA product;--> statement-breakpoint
ALTER TABLE public.audit_logs SET SCHEMA audit;--> statement-breakpoint

-- runtime-role access to the new namespaces (table-level grants moved with the
-- tables; schema USAGE and future-table defaults are per-schema)
DO $$
DECLARE s text;
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'cognitest_app') THEN
    FOREACH s IN ARRAY ARRAY['identity','tenancy','access','product','audit'] LOOP
      EXECUTE format('GRANT USAGE ON SCHEMA %I TO cognitest_app', s);
      EXECUTE format(
        'ALTER DEFAULT PRIVILEGES IN SCHEMA %I GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO cognitest_app',
        s
      );
    END LOOP;
  END IF;
END $$;--> statement-breakpoint

-- the invitation resolver's pinned search_path must survive the move; qualify
-- the table and pin an empty path (SECURITY DEFINER hygiene)
CREATE OR REPLACE FUNCTION app_resolve_invitation(p_token_hash text) RETURNS uuid
  LANGUAGE sql SECURITY DEFINER STABLE
  SET search_path = ''
  AS $$
    SELECT organization_id FROM tenancy.invitations
    WHERE token_hash = p_token_hash AND status = 'pending' AND expires_at > now()
  $$;--> statement-breakpoint

-- unqualified SQL (psql, pgAdmin, tests) keeps resolving via the database
-- default; the app itself always emits schema-qualified statements
DO $$
BEGIN
  EXECUTE format(
    'ALTER DATABASE %I SET search_path = public, identity, tenancy, access, product, audit',
    current_database()
  );
END $$;