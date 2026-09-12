-- Invitation acceptance runs before any tenant context exists (the invitation
-- IS the authorization), but invitations are RLS-scoped to their org — a
-- chicken-and-egg for the app role. This SECURITY DEFINER resolver is the one
-- deliberate escape hatch: token hash in, organization id out, nothing else.
CREATE OR REPLACE FUNCTION app_resolve_invitation(p_token_hash text) RETURNS uuid
  LANGUAGE sql SECURITY DEFINER STABLE
  SET search_path = public
  AS $$
    SELECT organization_id FROM invitations
    WHERE token_hash = p_token_hash AND status = 'pending' AND expires_at > now()
  $$;--> statement-breakpoint

REVOKE ALL ON FUNCTION app_resolve_invitation(text) FROM PUBLIC;--> statement-breakpoint

DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'cognitest_app') THEN
    GRANT EXECUTE ON FUNCTION app_resolve_invitation(text) TO cognitest_app;
  END IF;
END $$;