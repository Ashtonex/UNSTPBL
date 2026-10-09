# Operations Runbook

## Routine Checks

- API health: `GET /health`
- Web app loads and can authenticate through Supabase.
- `POST /cron/push/dispatch-due` returns `success: true` from the scheduler.
- Admin audit log shows role changes, verse scheduling, push sends, and due dispatches.

## Migrations

Before deploying code that depends on schema changes:

```sh
pnpm db:migrate
```

Keep migration files and Drizzle metadata together. This workspace currently has untracked migration/meta files; review them before committing so generated metadata matches the SQL migrations you intend to ship.

## Scheduled Push

Scheduled notifications are stored in `scheduled_push_notifications`.

Dispatch options:

- Shell cron: `pnpm --filter @unstpbl/api push:dispatch`
- HTTP cron: `POST /cron/push/dispatch-due` with `x-cron-secret`
- Manual fallback: Bishop dashboard button, “Dispatch Due Notifications”

If notifications do not send:

- Confirm `VAPID_PUBLIC_KEY` is set in the web app.
- Confirm `VAPID_PRIVATE_KEY` and `VAPID_SUBJECT` are set in the API.
- Check API logs for push subscription pruning.
- Confirm users have granted browser notification permission.

## Backups

For Supabase-hosted Postgres:

- Enable scheduled backups in Supabase.
- Before high-risk migrations, take a manual backup/snapshot.
- Periodically test restore into a non-production project.

For self-hosted Postgres:

```sh
pg_dump "$DATABASE_URL" > unstpbl-backup.sql
```

Restore drills should be run outside production first.

## Monitoring

Recommended alerts:

- API 5xx rate above normal baseline.
- Scheduled push dispatch failing.
- Push failure rate spikes.
- Daily read rate drops sharply.
- Database migration failure.

Sentry is enabled only when DSNs are configured:

- API: `SENTRY_DSN_API`
- Web: `VITE_SENTRY_DSN`

## Release Checklist

1. `pnpm install --frozen-lockfile`
2. `pnpm build`
3. `pnpm test`
4. `pnpm lint`
5. `pnpm --filter @unstpbl/api typecheck`
6. Run migrations.
7. Deploy API.
8. Deploy web.
9. Verify `/health`, login, today's verse, and scheduled push dispatch.

## Scheduled jobs and keeping the API awake

The GitHub workflow `.github/workflows/keepalive.yml` pings the API and calls the scheduled endpoints, but GitHub does
**not** run a `*/10` schedule on time: on a quiet repository it runs every few hours (measured in October 2026: roughly
every 3 to 7 hours). Treat it as a best-effort backup. What that means in practice:

- The free Render API sleeps after 15 minutes without traffic, so the first visitor after a quiet spell can wait up to a
  minute or more for a cold start.
- Birthday and daily-verse jobs cannot rely on an exact hour. The birthday call is safe on every run (one post per person
  per year); the daily verse runs on the first run in a 05:00-11:00 UTC window and skips anyone already texted that day.

For reliable timing use an external scheduler (free options include cron-job.org). Create these jobs, each with the header
`x-cron-secret: <your CRON_SECRET>` where noted:

| Job | URL | Method | When |
| --- | --- | --- | --- |
| Keep warm | `https://unstpbl-api.onrender.com/health` | GET | every 5 minutes |
| Scheduled push | `https://unstpbl-api.onrender.com/cron/push/dispatch-due` | POST + secret header | every 5 minutes |
| Birthdays | `https://unstpbl-api.onrender.com/cron/birthdays/dispatch-today` | POST + secret header | daily, 06:00 Harare |
| Daily verse texts | `https://unstpbl-api.onrender.com/cron/sms/daily-verse` | POST + secret header | daily, 07:00 Harare |

The other fix is to move the API to a paid instance (about $7 a month), which never sleeps.
