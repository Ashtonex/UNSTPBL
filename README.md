# UNSTPBL

Church daily Bible verse PWA with Supabase auth, verse scheduling, member engagement tracking, favorites, reflections, prayer requests, push notifications, and bishop/admin tools.

## Structure

- `apps/web` - Vite React PWA with Supabase login, protected member pages, bishop dashboard, and admin route.
- `packages/api` - Hono API for verses, profiles, admin analytics, push notifications, scheduled jobs, and personal activity.
- `packages/db` - Drizzle schema and SQL migrations for Supabase/Postgres.
- `packages/shared` - Shared constants and TypeScript types.

## Local Setup

1. Install dependencies:

   ```sh
   pnpm install
   ```

2. Copy environment examples:

   ```sh
   cp .env.example .env
   cp packages/api/.env.example packages/api/.env
   cp apps/web/.env.example apps/web/.env
   ```

3. Start Postgres:

   ```sh
   docker compose up -d postgres
   ```

4. Run migrations:

   ```sh
   pnpm db:migrate
   ```

5. Start the API and web app:

   ```sh
   pnpm dev
   ```

The web app runs on `http://localhost:5173` and the API runs on
`http://localhost:3001`.

## Phase 1 Verification

```sh
pnpm build
pnpm lint
pnpm test
pnpm --filter @unstpbl/api typecheck
curl http://localhost:3001/health
curl http://localhost:3001/verses/today
```

## Production

See:

- `docs/DEPLOYMENT.md`
- `docs/OPERATIONS.md`
- `docs/SMS.md` (text messages and visitor follow-up: how it works and how to go live)
- `.env.production.example`

Scheduled push dispatch can run as either:

```sh
pnpm --filter @unstpbl/api push:dispatch
```

or an HTTP cron call:

```sh
curl -X POST http://localhost:3001/cron/push/dispatch-due \
  -H "x-cron-secret: $CRON_SECRET"
```
