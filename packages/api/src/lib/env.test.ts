import { afterEach, describe, expect, it } from 'vitest';
import { getAllowedCorsOrigins, isCorsOriginAllowed } from './env.js';

describe('CORS origins', () => {
  afterEach(() => {
    delete process.env.CORS_ORIGINS;
    delete process.env.CORS_ORIGIN;
    delete process.env.NODE_ENV;
  });

  it('always allows the production web app, even with CORS_ORIGINS unset', () => {
    process.env.NODE_ENV = 'production';
    expect(isCorsOriginAllowed('https://unstpbl-seven.vercel.app')).toBe(true);
  });

  it('adds configured origins and tolerates trailing slashes and spaces', () => {
    process.env.NODE_ENV = 'production';
    process.env.CORS_ORIGINS = ' https://app.example.org/ , https://staging.example.org ';

    expect(getAllowedCorsOrigins()).toEqual([
      'https://unstpbl-seven.vercel.app',
      'https://app.example.org',
      'https://staging.example.org',
    ]);
    expect(isCorsOriginAllowed('https://app.example.org')).toBe(true);
  });

  it('still rejects unknown origins and lookalikes', () => {
    process.env.NODE_ENV = 'production';
    expect(isCorsOriginAllowed('https://evil.example.com')).toBe(false);
    expect(isCorsOriginAllowed('https://unstpbl-seven.vercel.app.evil.com')).toBe(false);
    expect(isCorsOriginAllowed('http://localhost:5173')).toBe(false);
  });

  it('allows requests with no Origin header (curl, server-to-server, cron)', () => {
    expect(isCorsOriginAllowed(undefined)).toBe(true);
  });
});
