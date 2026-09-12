-- Runs once on first cluster init (docker-entrypoint-initdb.d).
-- Non-owner runtime role for the API: no BYPASSRLS, no table ownership, so
-- row-level security applies. Grants are issued by the RLS migration.
-- Existing volumes: run this manually (see README) — init scripts don't re-run.
CREATE ROLE cognitest_app LOGIN PASSWORD 'cognitest_app';
