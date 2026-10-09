import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  estimateCost,
  readSmsSettings,
  sendSms,
  startOfMonthUtc,
  type LogEntry,
  type SmsDeps,
  type SmsStore,
} from './service.js';
import { dryRunProvider } from './providers/dryRun.js';
import { SmsConfigError, SmsProviderError, type SmsProvider } from './providers/types.js';

function memoryStore(overrides: Partial<{ optedOut: string[]; liveUsed: number }> = {}) {
  const log: LogEntry[] = [];
  const store: SmsStore = {
    isOptedOut: async (phone) => (overrides.optedOut ?? []).includes(phone),
    liveSegmentsSentSince: async () => overrides.liveUsed ?? 0,
    insertLog: async (entry) => void log.push(entry),
  };
  return { store, log };
}

const liveProvider = (send = vi.fn().mockResolvedValue({ providerMessageId: 'SM1', status: 'sent' })): SmsProvider => ({
  name: 'twilio',
  live: true,
  send,
});

const settings = { monthlySegmentCap: 10, costPerSegmentUsd: 0.05, whatsappMonthlyMessageCap: 300, whatsappCostPerMessageUsd: null };

function deps(over: Partial<SmsDeps> & { store?: SmsStore } = {}): SmsDeps {
  return {
    store: memoryStore().store,
    getProvider: () => dryRunProvider,
    settings,
    now: () => new Date('2026-10-15T08:00:00Z'),
    ...over,
  };
}

const request = { to: '0771234567', body: 'Hello there', purpose: 'announcement' as const };

describe('sendSms', () => {
  beforeEach(() => vi.spyOn(console, 'log').mockImplementation(() => {}));

  it('sends through the provider, normalises the number and logs a live send with its cost', async () => {
    const { store, log } = memoryStore();
    const send = vi.fn().mockResolvedValue({ providerMessageId: 'SM42', status: 'sent' });

    const result = await sendSms(deps({ store, getProvider: () => liveProvider(send) }), { ...request, createdBy: 'bishop-1' });

    expect(result).toEqual({ status: 'sent', segments: 1, providerMessageId: 'SM42' });
    expect(send).toHaveBeenCalledWith({ to: '+263771234567', body: 'Hello there' });
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({
      status: 'sent',
      provider: 'twilio',
      recipientPhone: '+263771234567',
      providerMessageId: 'SM42',
      segments: 1,
      costEstimateUsd: 0.05,
      createdBy: 'bishop-1',
    });
  });

  it('dry-run logs the attempt without a cost and does not count toward the cap', async () => {
    const { store, log } = memoryStore({ liveUsed: 999 });
    const result = await sendSms(deps({ store }), request);
    expect(result.status).toBe('dry_run');
    expect(log[0]).toMatchObject({ status: 'dry_run', provider: 'dryrun', costEstimateUsd: null });
  });

  it('converts typographic characters before counting segments and sending', async () => {
    const { store, log } = memoryStore();
    const send = vi.fn().mockResolvedValue({ providerMessageId: 'SM1', status: 'sent' });
    await sendSms(deps({ store, getProvider: () => liveProvider(send) }), { ...request, body: 'It’s “good” — truly' });
    expect(send.mock.calls[0][0].body).toBe('It\'s "good" - truly');
    expect(log[0].segments).toBe(1);
  });

  it('blocks an invalid number without logging or calling the provider', async () => {
    const { store, log } = memoryStore();
    const send = vi.fn();
    const result = await sendSms(deps({ store, getProvider: () => liveProvider(send) }), { ...request, to: '0202123456' });
    expect(result).toMatchObject({ status: 'blocked', reason: 'invalid_phone' });
    expect(send).not.toHaveBeenCalled();
    expect(log).toHaveLength(0);
  });

  it('blocks an empty message', async () => {
    const result = await sendSms(deps(), { ...request, body: '  ' + String.fromCodePoint(0x200b) + ' ' });
    expect(result).toMatchObject({ status: 'blocked', reason: 'empty_message', segments: 0 });
  });

  it('blocks a message longer than the per-message limit', async () => {
    const { store, log } = memoryStore();
    const send = vi.fn();
    const result = await sendSms(deps({ store, getProvider: () => liveProvider(send) }), { ...request, body: 'a'.repeat(700) });
    expect(result).toMatchObject({ status: 'blocked', reason: 'too_long' });
    expect(send).not.toHaveBeenCalled();
    expect(log[0]).toMatchObject({ status: 'blocked', provider: 'none' });
  });

  it('never texts a number that replied STOP, even with a valid request', async () => {
    const { store, log } = memoryStore({ optedOut: ['+263771234567'] });
    const send = vi.fn();
    const result = await sendSms(deps({ store, getProvider: () => liveProvider(send) }), request);
    expect(result).toMatchObject({ status: 'blocked', reason: 'opted_out' });
    expect(send).not.toHaveBeenCalled();
    expect(log[0]).toMatchObject({ status: 'blocked', error: 'opted_out' });
  });

  it('refuses a live send that would exceed the monthly cap, but allows one that exactly fits', async () => {
    const send = vi.fn().mockResolvedValue({ providerMessageId: 'SM1', status: 'sent' });
    const full = memoryStore({ liveUsed: 10 });
    expect(await sendSms(deps({ store: full.store, getProvider: () => liveProvider(send) }), request)).toMatchObject({
      status: 'blocked',
      reason: 'monthly_cap',
    });
    expect(send).not.toHaveBeenCalled();

    const oneLeft = memoryStore({ liveUsed: 9 });
    expect((await sendSms(deps({ store: oneLeft.store, getProvider: () => liveProvider(send) }), request)).status).toBe('sent');
  });

  it('measures the cap from the start of the current month', async () => {
    const since: Date[] = [];
    const store: SmsStore = {
      isOptedOut: async () => false,
      liveSegmentsSentSince: async (date) => (since.push(date), 0),
      insertLog: async () => {},
    };
    await sendSms(deps({ store, getProvider: () => liveProvider() }), request);
    expect(since[0].toISOString()).toBe('2026-10-01T00:00:00.000Z');
    expect(startOfMonthUtc(new Date('2026-12-31T23:59:59Z')).toISOString()).toBe('2026-12-01T00:00:00.000Z');
  });

  it('reports a misconfigured provider as a block, not a crash', async () => {
    const { store, log } = memoryStore();
    const result = await sendSms(
      deps({
        store,
        getProvider: () => {
          throw new SmsConfigError('SMS_PROVIDER=twilio needs TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN.');
        },
      }),
      request,
    );
    expect(result).toMatchObject({ status: 'blocked', reason: 'not_configured' });
    expect(result.detail).toContain('TWILIO_ACCOUNT_SID');
    expect(log[0].status).toBe('blocked');
  });

  it('records a provider failure and reports it', async () => {
    const { store, log } = memoryStore();
    const send = vi.fn().mockRejectedValue(new SmsProviderError('Twilio 400: invalid number (code 21211)'));
    const result = await sendSms(deps({ store, getProvider: () => liveProvider(send) }), request);
    expect(result).toMatchObject({ status: 'failed', reason: 'provider_error' });
    expect(log[0]).toMatchObject({ status: 'failed', error: 'Twilio 400: invalid number (code 21211)' });
  });

  it('does not leak unexpected error text into the result or the log', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { store, log } = memoryStore();
    const send = vi.fn().mockRejectedValue(new Error('connect ECONNREFUSED key=sk_live_SECRET'));
    const result = await sendSms(deps({ store, getProvider: () => liveProvider(send) }), request);
    expect(result.detail).toBe('Unexpected error while sending.');
    expect(JSON.stringify(log)).not.toContain('sk_live_SECRET');
  });

  it('still reports a successful send when writing the log fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const store: SmsStore = {
      isOptedOut: async () => false,
      liveSegmentsSentSince: async () => 0,
      insertLog: async () => {
        throw new Error('db down');
      },
    };
    const result = await sendSms(deps({ store, getProvider: () => liveProvider() }), request);
    expect(result.status).toBe('sent');
  });
});

describe('settings and estimates', () => {
  it('defaults to a conservative cap and unknown cost', () => {
    expect(readSmsSettings({})).toEqual({ monthlySegmentCap: 300, costPerSegmentUsd: null, whatsappMonthlyMessageCap: 300, whatsappCostPerMessageUsd: null });
  });

  it('reads the cap and cost from the environment, ignoring junk', () => {
    expect(readSmsSettings({ SMS_MONTHLY_SEGMENT_CAP: '1200', SMS_COST_PER_SEGMENT_USD: '0.019' })).toEqual({
      monthlySegmentCap: 1200,
      costPerSegmentUsd: 0.019,
      whatsappMonthlyMessageCap: 300,
      whatsappCostPerMessageUsd: null,
    });
    expect(readSmsSettings({ SMS_MONTHLY_SEGMENT_CAP: 'lots', SMS_COST_PER_SEGMENT_USD: '-3' })).toEqual({
      monthlySegmentCap: 300,
      costPerSegmentUsd: null,
      whatsappMonthlyMessageCap: 300,
      whatsappCostPerMessageUsd: null,
    });
    expect(readSmsSettings({ SMS_MONTHLY_SEGMENT_CAP: '0' }).monthlySegmentCap).toBe(0);
  });

  it('estimates cost, or says it is unknown', () => {
    expect(estimateCost(50, 2, { monthlySegmentCap: 1, costPerSegmentUsd: 0.02, whatsappMonthlyMessageCap: 300, whatsappCostPerMessageUsd: null })).toEqual({ totalSegments: 100, estimatedCostUsd: 2 });
    expect(estimateCost(50, 2, { monthlySegmentCap: 1, costPerSegmentUsd: null, whatsappMonthlyMessageCap: 300, whatsappCostPerMessageUsd: null })).toEqual({ totalSegments: 100, estimatedCostUsd: null });
  });
});
