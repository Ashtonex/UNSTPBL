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
