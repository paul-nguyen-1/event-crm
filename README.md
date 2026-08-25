## Architecture

Three independently-run services, sharing Postgres/RabbitMQ/Redis:

| Service | Path | Stack | Port |
|---|---|---|---|
| `api` | [api/](api/) | NestJS 11 + Prisma + Postgres | `3000` |
| `web` | [web/](web/) | React 19 + Vite + TanStack Query + Tailwind v4 | `5173` |
| `notification-service` | [notification-service/](notification-service/) | Go, WebSocket/SSE delivery | `8081` |

The `api` publishes domain events onto a RabbitMQ topic exchange
(`domain.events`); `notification-service` consumes `reminder.due` events,
dedupes them via Redis, and pushes them to connected browsers over
WebSocket/SSE. Both `api` and `notification-service` verify the same JWT
(`JWT_ACCESS_SECRET`): it's an intentionally shared HS256 secret, not two
credentials to keep in sync.

`api` and `web` are an npm workspace (root [package.json](package.json));
`notification-service` is a separate Go module.

## Prerequisites

- Node.js 22 (matches [ci.yml](.github/workflows/ci.yml))
- Go 1.26+
- Docker (for local Postgres/RabbitMQ/Redis)

## First-time setup

```bash
# 1. Install JS dependencies (api + web workspaces)
npm install

# 2. Copy env files and fill in secrets (see "Environment variables" below)
cp .env.example .env
cp web/.env.example web/.env
cp notification-service/.env notification-service/.env   # already present as a starting point, review it

# 3. Start Postgres, RabbitMQ, Redis
docker compose up -d

# 4. Apply migrations + generate the Prisma client
cd api && npx prisma migrate deploy && npx prisma generate

# 5. (optional) seed the product catalog used by gift suggestions
npx prisma db seed
cd ..
```

## Running the stack

Each service runs in its own terminal; there's no single "start everything"
script yet.

```bash
# api: http://localhost:3000/v1
cd api && npm run start:dev

# web: http://localhost:5173
cd web && npm run dev

# notification-service: ws://localhost:8081/ws, http://localhost:8081/healthz
cd notification-service && go run ./cmd/server
```

## Environment variables

Env files are per-service (`.env` is gitignored;
`.env.example` at the root documents every key used by `docker-compose.yml`
and the `api`). Key points:

- `DATABASE_URL`, `RABBITMQ_URL`, `REDIS_URL` in root `.env` must point at
  the containers `docker-compose.yml` brings up.
- `JWT_ACCESS_SECRET` must be identical in `api/.env` and
  `notification-service/.env`: the notification service verifies tokens
  the api signs, it doesn't mint its own.
- `WEB_ORIGIN` (notification-service) and `VITE_WS_URL` (web) must agree on
  where the WebSocket/SSE server is reachable.
- Third-party keys you'll need for full functionality: `RESEND_API_KEY`
  (transactional email, resend.com), `AMAZON_ASSOCIATES_TRACKING_ID`
  (affiliate-program.amazon.com), `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`
  (Google OAuth login). The app runs without them, but email delivery,
  outbound affiliate links, and "Sign in with Google" won't work.

## Project layout

```
api/src/
  auth/          JWT + Google OAuth
  users/         account/profile
  contacts/      CRM contacts
  events/        occasions tied to a contact (birthday, anniversary, ...)
  reminders/     scheduled reminders for an event, delivered via reminder channels
  suggestions/   gift suggestions matched against the seeded Product catalog
  links/         outbound affiliate link generation + click tracking
  notifications/ in-app notification records
  outbox/        transactional outbox → RabbitMQ publisher for domain events

web/src/         React app (pages, components, API clients in line with api's modules)

notification-service/internal/
  consumer/      RabbitMQ consumer for domain events
  dedup/         Redis-backed delivery dedup
  delivery/      WebSocket + SSE fan-out to connected clients
  auth/          JWT verification (shared secret with api)
```

Data model lives in [api/prisma/schema.prisma](api/prisma/schema.prisma)
(`User`, `Contact`, `Event`, `Reminder`, `Product`, `LinkClick`,
`DomainEvent`).

## Testing & linting

```bash
# api
cd api && npm run lint && npm test && npm run test:e2e   # e2e needs Postgres running

# web
cd web && npm run lint && npm run build   # build runs the TS project references (tsc -b)

# notification-service
cd notification-service && go test ./...
```

CI ([.github/workflows/ci.yml](.github/workflows/ci.yml)) runs the `api`
and `web` jobs above against ephemeral Postgres/RabbitMQ containers on every
push and PR. There's no CI job for `notification-service` yet; run
`go test ./...` locally before merging Go changes.
