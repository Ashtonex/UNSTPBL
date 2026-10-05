import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';

const execute = vi.fn();
const listUsers = vi.fn();
const getSupabaseClient = vi.fn();

vi.mock('../lib/db.js', () => ({ db: { execute } }));
vi.mock('../lib/authCache.js', () => ({ getSupabaseClient }));

const { healthRoutes } = await import('./health.js');

const SECRET = 'sb_secret_SUPERSECRETVALUE123';

async function deep() {
  const app = new Hono();
  app.route('/', healthRoutes);
  const res = await app.request('/health/deep');
  return { status: res.status, text: await res.text() };
}

describe('GET /health/deep', () => {
  beforeEach(() => {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_KEY = SECRET;
    execute.mockReset().mockResolvedValue([{ '?column?': 1 }]);
    listUsers.mockReset().mockResolvedValue({ data: {}, error: null });
    getSupabaseClient.mockReset().mockReturnValue({ auth: { admin: { listUsers } } });
  });

  it('reports ok when the database and Supabase both answer', async () => {
    const { status, text } = await deep();
    expect(status).toBe(200);
    expect(JSON.parse(text)).toEqual({
      status: 'ok',
      checks: { database: 'ok', supabaseConfig: 'ok', supabaseAuth: 'ok' },
    });
  });

  it('degrades with 503 when the database is down', async () => {
    execute.mockRejectedValue(new Error('connection refused'));
    const { status, text } = await deep();
    expect(status).toBe(503);
    expect(JSON.parse(text).checks.database).toBe('error');
  });

  it('flags a rejected service key', async () => {
    listUsers.mockResolvedValue({ data: null, error: { status: 401, name: 'AuthApiError' } });
    const { text } = await deep();
    expect(JSON.parse(text).checks.supabaseAuth).toBe('bad-service-key');
  });

  it('reports a network failure by its code', async () => {
    const err = Object.assign(new TypeError('fetch failed'), { cause: { code: 'ENOTFOUND' } });
    listUsers.mockRejectedValue(err);
    const { text } = await deep();
    expect(JSON.parse(text).checks.supabaseAuth).toBe('unreachable: ENOTFOUND');
  });

  it('never echoes error messages, so secrets in them cannot leak', async () => {
    listUsers.mockRejectedValue(new TypeError(`"Bearer ${SECRET}" is an invalid header value`));
    getSupabaseClient.mockReturnValue({ auth: { admin: { listUsers } } });
    const { text } = await deep();
    expect(text).not.toContain(SECRET);
    expect(text).not.toContain('Bearer');
  });

  it('flags missing or non-http Supabase configuration without calling Supabase', async () => {
    process.env.SUPABASE_URL = 'postgresql://user:pw@host/db';
    const { text } = await deep();
    expect(JSON.parse(text).checks).toMatchObject({ supabaseConfig: 'url-not-http', supabaseAuth: 'skipped' });
    expect(text).not.toContain('pw@host');
    expect(listUsers).not.toHaveBeenCalled();
  });
});
