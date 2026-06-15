# UNSTPBL

Phase 1 foundation for a church daily Bible verse PWA.

## Structure

- `apps/web` - Vite React PWA shell with Supabase login, protected home, and admin route.
- `packages/api` - Hono API with health and mock verse endpoints.
- `packages/db` - Drizzle schema and SQL migration for Supabase/Postgres.
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
curl http://localhost:3001/health
curl http://localhost:3001/verses/today
```
