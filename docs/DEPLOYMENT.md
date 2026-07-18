# Deployment

UNSTPBL deploys as two runtime surfaces:

- `apps/web`: static Vite PWA.
- `packages/api`: Node/Hono API.

Postgres/Supabase is the shared data layer.

## Required Production Configuration

Use the production examples as checklists:

- Root: `.env.production.example`
- API: `packages/api/.env.production.example`
- Web: `apps/web/.env.production.example`

Do not commit real `.env` files.

## Database

Run migrations before serving new application code:

```sh
pnpm db:migrate
```

Seed Bible metadata/content as needed:

```sh
pnpm db:seed
pnpm db:seed:full
```

## API Deployment

Build and start:

```sh
pnpm --filter @unstpbl/api build
pnpm --filter @unstpbl/api start
```

Container builds can use `packages/api/Dockerfile`.

Production API requirements:

- `NODE_ENV=production`
- `DATABASE_URL`
- Supabase service credentials
- `CORS_ORIGINS` set to the deployed web origin
- VAPID keys if push notifications are enabled
- `CRON_SECRET` if using HTTP scheduled jobs

## Web Deployment

Build static assets:

```sh
pnpm --filter @unstpbl/web build
```

Serve `apps/web/dist` from a static host/CDN. Set:

- `VITE_API_BASE_URL` to the deployed API URL
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_VAPID_PUBLIC_KEY`

## Scheduled Push Dispatch

There are two supported dispatch modes.

Worker/cron command:

```sh
pnpm --filter @unstpbl/api push:dispatch
```

HTTP cron:

```sh
curl -X POST https://your-api-domain.example/cron/push/dispatch-due \
  -H "x-cron-secret: $CRON_SECRET"
```

Run every 1 to 5 minutes depending on how exact notification timing needs to be.
