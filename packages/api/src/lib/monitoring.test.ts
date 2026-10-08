import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { captureException, initMonitoring, parseDsn, resetMonitoringForTests } from './monitoring.js';

const DSN = 'https://abc123publickey@o42.ingest.de.sentry.io/4511622119424080';

describe('monitoring (SDK-free Sentry reporter)', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    resetMonitoringForTests();
    fetchMock.mockReset().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    process.env.SENTRY_DSN_API = DSN;
  });

  afterEach(() => {
    delete process.env.SENTRY_DSN_API;
    vi.unstubAllGlobals();
  });

  it('parses a DSN into the project envelope endpoint and public key', () => {
    expect(parseDsn(DSN)).toEqual({
      dsn: DSN,
      publicKey: 'abc123publickey',
      endpoint: 'https://o42.ingest.de.sentry.io/api/4511622119424080/envelope/',
    });
  });

  it('rejects malformed DSNs', () => {
    expect(parseDsn('not a dsn')).toBeNull();
    expect(parseDsn('https://o42.ingest.de.sentry.io/123')).toBeNull(); // no public key
    expect(parseDsn('https://key@o42.ingest.de.sentry.io/')).toBeNull(); // no project id
  });

  it('does nothing without a DSN', () => {
    delete process.env.SENTRY_DSN_API;
    initMonitoring();
    captureException(new Error('boom'));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('posts a well-formed envelope with the auth header', async () => {
    initMonitoring();
    captureException(new TypeError('database exploded'), { method: 'GET', path: '/verses/today' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://o42.ingest.de.sentry.io/api/4511622119424080/envelope/');
    expect(init.headers['X-Sentry-Auth']).toContain('sentry_key=abc123publickey');
    expect(init.headers['Content-Type']).toBe('application/x-sentry-envelope');

    const [header, itemHeader, event] = (init.body as string).split('\n').map((line) => JSON.parse(line));
    expect(header.dsn).toBe(DSN);
    expect(itemHeader).toEqual({ type: 'event' });
    expect(header.event_id).toBe(event.event_id);
    expect(event.event_id).toMatch(/^[0-9a-f]{32}$/);
    expect(event.level).toBe('error');
    expect(event.exception.values[0]).toEqual({ type: 'TypeError', value: 'database exploded' });
    expect(event.request).toEqual({ method: 'GET', url: '/verses/today' });
  });

  it('accepts non-Error throwables', () => {
    initMonitoring();
    captureException('just a string');
    const event = JSON.parse((fetchMock.mock.calls[0][1].body as string).split('\n')[2]);
    expect(event.exception.values[0].value).toBe('just a string');
  });

  it('caps how many events it will send per minute', () => {
    initMonitoring();
    for (let i = 0; i < 50; i++) captureException(new Error(`loop ${i}`));
    expect(fetchMock).toHaveBeenCalledTimes(10);
  });

  it('never throws, even when the network call fails synchronously or asynchronously', async () => {
    initMonitoring();
    fetchMock.mockImplementationOnce(() => {
      throw new Error('sync failure');
    });
    expect(() => captureException(new Error('a'))).not.toThrow();

    fetchMock.mockRejectedValueOnce(new Error('async failure'));
    expect(() => captureException(new Error('b'))).not.toThrow();
    await Promise.resolve();
  });
});
