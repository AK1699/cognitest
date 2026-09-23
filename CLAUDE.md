# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Cognitest — hybrid QA engineering platform. This repo is the web control plane: a pnpm/Turborepo monorepo with a NestJS (Fastify) API and a Next.js (App Router) web app. Desktop execution agents and AI/RAG test generation are later phases (pgvector is enabled but unused; BullMQ queues are provisioned-for but not built).

## Commands

Local services (Postgres/pgvector, Redis, MinIO, Mailpit) come from `docker compose up -d` — tests and dev both need Postgres and Redis running.

```sh
pnpm dev            # api on :3001, web on :3000 (turbo, persistent)
pnpm build | lint | typecheck | test    # turbo across all workspaces
pnpm db:migrate     # apply migrations (idempotent)
pnpm db:seed        # system roles + permission catalogue (idempotent; re-run after catalogue changes)
pnpm format         # prettier --write
```

Single workspace / single test:

```sh
pnpm --filter @cognitest/api test                       # all API tests
pnpm --filter @cognitest/api exec vitest run test/rls.spec.ts   # one file
pnpm --filter @cognitest/api db:generate                # drizzle-kit generate, after editing src/db/schema/
```

`typecheck` and `test` depend on `^build` (the web app and API import `@cognitest/shared` from its `dist/`), so run through turbo — or build `packages/shared` first — after changing shared code.

Migration workflow: edit `apps/api/src/db/schema/*` → `db:generate` → hand-check the SQL in `apps/api/drizzle/` (RLS policies are hand-written additions) → `pnpm db:migrate`.

## Workspace layout

- `apps/api` — NestJS + Fastify, Drizzle ORM, migrations in `apps/api/drizzle/`, e2e/unit tests in `apps/api/test/` (vitest, `*.spec.ts`)
- `apps/web` — Next.js App Router + Tailwind v4; no test suite
- `packages/shared` — Zod schemas, inferred types, enums, permission keys. Zod-only by design: keep other runtime deps out
- `packages/config` — shared tsconfig base, ESLint flat config, Prettier preset

## Architecture: tenancy and authorization (the load-bearing part)

Multi-tenant isolation is enforced in **Postgres row-level security**, not just application code:

- The API connects as the non-owner `cognitest_app` role (`DATABASE_URL`), so RLS actually applies. `DATABASE_URL_MIGRATIONS` uses the owner role and is for migrate/seed only.
- All tenant-scoped queries go through `TenantDb` (`apps/api/src/db/tenant-db.service.ts`): a transaction with `SET LOCAL` GUCs (`app.organization_id`, `app.user_id`) that RLS policies read. Never query tenant tables through the raw Drizzle handle; use `tenantDb.run()` (org-scoped) or `runAsUser()` (pre-tenant lookups like "my organizations").
- Every new table with an `organization_id` column **must** ship an RLS policy — a meta test (`apps/api/test/rls.spec.ts`) fails the build otherwise, and cross-tenant e2e tests cover every table.

Request authorization pipeline (guards run in order):

1. **AuthGuard** — opaque session token from the `cognitest_session` httpOnly cookie; Redis fast path, `sessions` table durable.
2. **TenantGuard** — validates `/organizations/:id/…` against membership; outsiders get 404, not 403.
3. **PermissionGuard** — `@RequirePermission('resource.action')` decorator; role permissions Redis-cached. Permission keys live in `packages/shared/src/permissions.ts`.
4. **ProjectAccessGuard** — explicit binary project membership; `project.configure` sees all projects.

Audit: `audit_logs` is immutable (revoked grants + no-mutate policy); security-mutating events are written in the same transaction as the mutation.

## Architecture: web ↔ API

- The web app proxies `/api/*` to the API via a Next.js rewrite (`apps/web/next.config.ts`) so the session cookie stays first-party. Client code fetches `/api/...`; server components use `apiGet()` in `apps/web/lib/api.ts`, which forwards the browser's cookies to `API_URL` directly.
- `apps/web/middleware.ts` is an optimistic UX gate only (cookie presence, not validity) — real enforcement is the API's guards + RLS.
- App routes: `(auth)` group for public pages, `/onboarding`, and `/[organizationId]/<module>` for the org-scoped shell (dashboard, api-testing, automation, performance-testing, security-testing, design, members, settings).

## API test setup gotchas

- `apps/api/vitest.config.ts` uses the swc plugin because esbuild strips `emitDecoratorMetadata`, which silently breaks Nest DI. Don't swap it out.
- `fileParallelism: false` — suites share one database; no concurrent migrator runs.
- `apps/api/test/route-coverage.spec.ts` fails if a route ships without matching test coverage conventions; `migrations.spec.ts` and `seed.spec.ts` guard those scripts.

## Web design system

Tokens are defined in `apps/web/app/globals.css` (`@theme`): teal (`primary`) is the workhorse; magenta (`accent`) is reserved for CTAs and AI features; status colours (`pass`/`fail`/`warn`) are fixed and never reused for brand purposes. Headings use Space Grotesk (`--font-display`), body uses Karla (`--font-body`). Use these tokens rather than ad-hoc Tailwind palette colours.

Next.js in this repo is v16 — `apps/web/AGENTS.md` (auto-generated by `next dev`) points to current docs in `node_modules/next/dist/docs/`; check them before assuming App Router conventions from older versions.

## Environment

Everything defaults to the docker-compose values, so no `.env` is needed for the quickstart (`.env.example` documents all variables). Notable: `AUTH_SECRET` derives at-rest keys via HKDF and must be ≥32 chars in production; Mailpit UI is at `http://localhost:8025` for verification emails.
