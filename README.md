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
pnpm db:migrate          # apply migrations 0001–0003
pnpm db:seed             # system roles + permission catalogue (idempotent)
pnpm dev                 # api on :3001, web on :3000
```

Then open <http://localhost:3000> — the home page shows live API health.

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
| `DATABASE_URL` | Postgres connection string | `postgres://cognitest:cognitest@localhost:5432/cognitest` |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379` |
| `S3_ENDPOINT` | S3-compatible endpoint (MinIO locally) | `http://localhost:9000` |
| `S3_ACCESS_KEY` / `S3_SECRET_KEY` | Object storage credentials | `cognitest` / `cognitest123` |
| `S3_BUCKET` | Artifact bucket | `cognitest-artifacts` |
| `S3_REGION` | S3 region | `us-east-1` |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | Reserved for the auth phase | dev placeholders |
| `MAIL_HOST` / `MAIL_PORT` / `MAIL_FROM` | SMTP (Mailpit locally) | `localhost` / `1025` / `noreply@cognitest.local` |
| `NEXT_PUBLIC_API_URL` | API base URL for the web app | `http://localhost:3001` |

## What's deliberately not here yet

- **Desktop execution agent** (Tauri) — later phase
- **BullMQ queues / background jobs** — Redis is provisioned, queues are not
- **AI / RAG test generation** — pgvector extension is enabled, nothing uses it yet
- **Integrations** (Jira, GitHub, etc.) and auth flows — module stubs only

## Development notes

- Migrations: `pnpm --filter @cognitest/api db:generate` after editing
  `apps/api/src/db/schema/`; apply with `pnpm db:migrate`. Both migrate and
  seed are idempotent.
- Tests (`pnpm test`) need Postgres and Redis running (`docker compose up -d`).
- CI runs lint → typecheck → build → migrate → seed → test against pgvector
  and Redis service containers on every push/PR to `main`.
