# Cognitest

Hybrid QA engineering platform — web control plane (this repo), with desktop
execution agents and AI/RAG test generation coming in later phases.

## Quickstart

Prerequisites: [Node 22 LTS](https://nodejs.org) (`nvm use` picks it up from
`.nvmrc`), [pnpm 12](https://pnpm.io) (`corepack enable pnpm` or
`brew install pnpm`), and a Docker runtime (Docker Desktop or
[OrbStack](https://orbstack.dev)).

```sh
git clone <repo-url> && cd cognitest
nvm use                  # Node 22
docker compose up -d     # postgres, redis, minio, mailpit
pnpm install
pnpm db:migrate          # apply migrations
pnpm db:seed             # system roles + permission catalogue (idempotent)
pnpm dev                 # api on :3001, web on :3000
```

Then open <http://localhost:3000> — sign up, verify your email at
<http://localhost:8025> (Mailpit), and you land in your own workspace.

> **Existing Postgres volume?** The compose init script that creates the
> non-owner `cognitest_app` runtime role only runs on first cluster init.
> On an existing volume run it once manually:
> `docker exec cognitest-postgres-1 psql -U cognitest -d cognitest -c "CREATE ROLE cognitest_app LOGIN PASSWORD 'cognitest_app'"`
> then re-run `pnpm db:migrate` (it grants the role's privileges).
> After pulling catalogue changes, re-run `pnpm db:seed`.

## Workspace layout

| Path               | What it is                                                        |
| ------------------ | ----------------------------------------------------------------- |
| `apps/api`         | NestJS (Fastify) API. Drizzle ORM, migrations in `apps/api/drizzle/` |
| `apps/web`         | Next.js (App Router) web app, Tailwind CSS                        |
| `packages/shared`  | Zod schemas, inferred types, enums, permission keys (zod-only)    |
| `packages/config`  | Shared tsconfig base, ESLint flat config, Prettier preset         |

Root scripts: `pnpm dev | build | lint | typecheck | test` (via Turborepo),
plus `pnpm db:migrate` and `pnpm db:seed`.

## Local services (docker-compose)

| Service  | Image                   | Ports                          |
| -------- | ----------------------- | ------------------------------ |
| postgres | `pgvector/pgvector:pg17`| 5432                           |
| redis    | `redis:7-alpine`        | 6379                           |
| minio    | `minio/minio`           | 9000 (S3), 9001 (console)      |
| mailpit  | `axllent/mailpit`       | 1025 (SMTP), 8025 (UI)         |

The `cognitest-artifacts` bucket is created automatically on startup.

## Environment variables

Copy `.env.example` to `.env` (gitignored). Every value defaults to the
docker-compose setup, so the quickstart works without a `.env` at all.

| Variable | Purpose | Default |
| --- | --- | --- |
| `NODE_ENV` | Environment name | `development` |
| `PORT` | API port | `3001` |
| `CORS_ORIGIN` | Comma-separated allowed origins | `http://localhost:3000` |
| `DATABASE_URL` | Runtime Postgres URL — **must use the non-owner `cognitest_app` role so row-level security applies** | `postgres://cognitest:cognitest@…` (schema default; `.env.example` uses `cognitest_app`) |
| `DATABASE_URL_MIGRATIONS` | Owner URL for migrations/seed only | falls back to `DATABASE_URL` |
| `DB_POOL_MAX` | Postgres pool size | `10` |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379` |
| `WEB_ORIGIN` | Public web origin (CSRF allowlist, mail links, OIDC redirects) | `http://localhost:3000` |
| `AUTH_SECRET` | Master auth secret (min 32 chars; HKDF subkeys derive at-rest keys) | dev placeholder — **must be set in production** |
| `SESSION_TTL_SECONDS` | Session lifetime | `2592000` (30 days) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OIDC (provider disabled when unset) | — |
| `MICROSOFT_CLIENT_ID` / `MICROSOFT_CLIENT_SECRET` / `MICROSOFT_TENANT` | Microsoft OIDC — use a concrete tenant id; multi-tenant `common` is a flagged follow-up | — / — / `common` |
| `S3_ENDPOINT` | S3-compatible endpoint (MinIO locally) | `http://localhost:9000` |
| `S3_ACCESS_KEY` / `S3_SECRET_KEY` | Object storage credentials | `cognitest` / `cognitest123` |
| `S3_BUCKET` | Artifact bucket | `cognitest-artifacts` |
| `S3_REGION` | S3 region | `us-east-1` |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | Reserved for desktop-agent tokens | dev placeholders |
| `MAIL_HOST` / `MAIL_PORT` / `MAIL_FROM` | SMTP (Mailpit locally; empty host = no-op transport) | `localhost` / `1025` / `noreply@cognitest.local` |
| `API_URL` | API base URL for the web app's `/api` proxy and server components | `http://localhost:3001` |

## Authentication & authorization

Implemented per the architecture spec (`resource.action` permissions, six
system roles, org-scoped RBAC):

- **Sessions**: opaque token in an httpOnly cookie; Redis fast path with the
  `sessions` table as the durable record. The web app proxies `/api/*` to the
  API so the cookie stays first-party.
- **Credentials**: Argon2id passwords, email verification and password reset
  via single-use hashed tokens, per-route rate limits, enumeration-safe
  responses. Google/Microsoft OIDC with PKCE (Google may auto-link by
  verified email; Microsoft never does).
- **Authorization pipeline**: AuthGuard → TenantGuard (`/organizations/:id/…`
  validated against membership, 404 for outsiders) → PermissionGuard
  (`@RequirePermission`, Redis-cached role permissions) → ProjectAccessGuard
  (explicit binary project membership; `project.configure` sees all).
- **Tenant isolation**: Postgres row-level security on every tenant table,
  driven by transaction-local GUCs (`TenantDb`); the API runs as the
  non-owner `cognitest_app` role. Cross-tenant tests cover every table and a
  meta test fails if a new `organization_id` table ships without RLS.
- **Audit**: immutable `audit_logs` (grants revoked + no mutate policy),
  security-mutating events written in the same transaction.

## What's deliberately not here yet

- **Desktop execution agent** (Tauri) + agent/Socket.IO auth — later phase
- **MFA / passkeys, SAML/SCIM, API keys, step-up auth** — schema-ready where
  cheap (`users.mfa_enabled`), flows deferred post-MVP
- **BullMQ queues / background jobs** — Redis is provisioned, queues are not
  (the request-context primitive for workers exists)
- **AI / RAG test generation** — pgvector extension is enabled, nothing uses it yet
- **Integrations** (Jira, GitHub, etc.) — module-less for now

## Development notes

- Migrations: `pnpm --filter @cognitest/api db:generate` after editing
  `apps/api/src/db/schema/`; apply with `pnpm db:migrate`. Both migrate and
  seed are idempotent.
- Tests (`pnpm test`) need Postgres and Redis running (`docker compose up -d`).
- CI runs lint → typecheck → build → migrate → seed → test against pgvector
  and Redis service containers on every push/PR to `main`.
