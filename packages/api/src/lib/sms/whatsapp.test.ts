import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sendSms, type LogEntry, type SmsDeps, type SmsSettings, type SmsStore, type Channel } from './service.js';
import { dryRunProvider } from './providers/dryRun.js';
import { getWhatsappProvider } from './providers/index.js';
import { createTwilioWhatsappProvider } from './providers/twilioWhatsapp.js';
import { SmsConfigError, SmsProviderError, type SmsProvider } from './providers/types.js';

const settings: SmsSettings = {
  monthlySegmentCap: 10,
  costPerSegmentUsd: 0.05,
  whatsappMonthlyMessageCap: 3,
  whatsappCostPerMessageUsd: 0.0275,
};

function memoryStore(opts: { optedOut?: string[]; used?: Partial<Record<Channel, number>> } = {}) {
  const log: LogEntry[] = [];
  const asked: Channel[] = [];
  const store: SmsStore = {
    isOptedOut: async (phone) => (opts.optedOut ?? []).includes(phone),
    liveSegmentsSentSince: async (_since, channel = 'sms') => {
      asked.push(channel);
      return opts.used?.[channel] ?? 0;
    },
    insertLog: async (entry) => void log.push(entry),
  };
  return { store, log, asked };
}

const live = (name: string, send = vi.fn().mockResolvedValue({ providerMessageId: 'WA1', status: 'sent' })): SmsProvider => ({ name, live: true, send });

function deps(over: Partial<SmsDeps> = {}): SmsDeps {
  return {
    store: memoryStore().store,
    getProvider: () => dryRunProvider,
    getWhatsappProvider: () => dryRunProvider,
    settings,
    now: () => new Date('2026-10-15T08:00:00Z'),
    ...over,
  };
}

const template = { key: 'daily_verse', variables: ['John 3:16', 'For God so loved the world', 'Test Church'] };
const wa = { channel: 'whatsapp' as const, to: '0771234567', body: 'John 3:16: For God so loved the world', purpose: 'daily_verse' as const, template };

describe('sendSms on the WhatsApp channel', () => {
  beforeEach(() => vi.spyOn(console, 'log').mockImplementation(() => {}));

  it('logs a dry-run WhatsApp message as one unit on the whatsapp channel, with no cost', async () => {
    const { store, log } = memoryStore();
    const result = await sendSms(deps({ store }), wa);
    expect(result.status).toBe('dry_run');
    expect(result.segments).toBe(1);
    expect(log[0]).toMatchObject({ channel: 'whatsapp', status: 'dry_run', segments: 1, recipientPhone: '+263771234567', costEstimateUsd: null });
  });

  it('hands the provider the approved template and its values, and prices a live send per message', async () => {
    const { store, log } = memoryStore();
    const send = vi.fn().mockResolvedValue({ providerMessageId: 'WA9', status: 'sent' });
    const result = await sendSms(deps({ store, getWhatsappProvider: () => live('twilio-whatsapp', send) }), wa);

    expect(result).toMatchObject({ status: 'sent', providerMessageId: 'WA9' });
    expect(send).toHaveBeenCalledWith({ to: '+263771234567', body: wa.body, template });
    expect(log[0]).toMatchObject({ channel: 'whatsapp', provider: 'twilio-whatsapp', costEstimateUsd: 0.0275 });
  });

  it('does not squeeze WhatsApp text into SMS limits: a long verse is still a single message', async () => {
    const { store, log } = memoryStore();
    const result = await sendSms(deps({ store }), { ...wa, body: `${'Word of life '.repeat(60)}“quoted”` });
    expect(result.status).toBe('dry_run');
    expect(result.segments).toBe(1);
    expect(log[0].body).toContain('“quoted”'); // WhatsApp keeps real punctuation
  });

  it('honours STOP on WhatsApp too: the opt-out list is shared across channels', async () => {
    const { store, log } = memoryStore({ optedOut: ['+263771234567'] });
    const result = await sendSms(deps({ store }), wa);
    expect(result).toMatchObject({ status: 'blocked', reason: 'opted_out' });
    expect(log[0]).toMatchObject({ channel: 'whatsapp', status: 'blocked' });
  });

  it('holds WhatsApp to its own monthly cap, and counts only WhatsApp usage against it', async () => {
    const { store, asked } = memoryStore({ used: { whatsapp: 3, sms: 0 } });
    const send = vi.fn();
    const result = await sendSms(deps({ store, getWhatsappProvider: () => live('twilio-whatsapp', send) }), wa);
    expect(result).toMatchObject({ status: 'blocked', reason: 'monthly_cap' });
    expect(result.detail).toContain('WhatsApp messages');
    expect(send).not.toHaveBeenCalled();
    expect(asked).toEqual(['whatsapp']);
  });

  it('a full SMS allowance does not stop WhatsApp', async () => {
    const { store } = memoryStore({ used: { sms: 10, whatsapp: 0 } });
    const result = await sendSms(deps({ store, getWhatsappProvider: () => live('twilio-whatsapp') }), wa);
    expect(result.status).toBe('sent');
  });

  it('is blocked, never sent as SMS, when WhatsApp is not available', async () => {
    const smsSend = vi.fn();
    const { store, log } = memoryStore();
    const result = await sendSms(deps({ store, getWhatsappProvider: undefined, getProvider: () => live('twilio', smsSend) }), wa);
    expect(result).toMatchObject({ status: 'blocked', reason: 'not_configured' });
    expect(smsSend).not.toHaveBeenCalled();
    expect(log[0]).toMatchObject({ channel: 'whatsapp', status: 'blocked' });
  });

  it('blocks and logs a misconfigured WhatsApp provider instead of throwing', async () => {
    const { store } = memoryStore();
    const result = await sendSms(
      deps({
        store,
        getWhatsappProvider: () => {
          throw new SmsConfigError('WHATSAPP_PROVIDER=twilio needs TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN.');
        },
      }),
      wa,
    );
    expect(result).toMatchObject({ status: 'blocked', reason: 'not_configured' });
  });

  it('records a provider failure as failed', async () => {
    const { store, log } = memoryStore();
    const send = vi.fn().mockRejectedValue(new SmsProviderError('No approved WhatsApp template', false));
    const result = await sendSms(deps({ store, getWhatsappProvider: () => live('twilio-whatsapp', send) }), wa);
    expect(result).toMatchObject({ status: 'failed', reason: 'provider_error' });
    expect(log[0]).toMatchObject({ channel: 'whatsapp', status: 'failed' });
  });

  it('leaves SMS exactly as it was (default channel, SMS limits and cap)', async () => {
    const { store, log, asked } = memoryStore();
    const send = vi.fn().mockResolvedValue({ providerMessageId: 'SM1', status: 'sent' });
    const result = await sendSms(deps({ store, getProvider: () => live('twilio', send) }), { to: '0771234567', body: 'Hello there', purpose: 'announcement' });
    expect(result.status).toBe('sent');
    expect(log[0]).toMatchObject({ channel: 'sms', segments: 1, costEstimateUsd: 0.05 });
    expect(asked).toEqual(['sms']);
  });
});

describe('getWhatsappProvider', () => {
  it('defaults to the dry-run provider, so nothing is sent until it is switched on', () => {
    expect(getWhatsappProvider({})).toBe(dryRunProvider);
    expect(getWhatsappProvider({ WHATSAPP_PROVIDER: 'dryrun' })).toBe(dryRunProvider);
  });

  it('is independent of the SMS provider setting', () => {
    expect(getWhatsappProvider({ SMS_PROVIDER: 'twilio' })).toBe(dryRunProvider);
  });

  it('refuses to guess when live WhatsApp is half configured', () => {
    expect(() => getWhatsappProvider({ WHATSAPP_PROVIDER: 'twilio' })).toThrow(SmsConfigError);
    expect(() => getWhatsappProvider({ WHATSAPP_PROVIDER: 'twilio', TWILIO_ACCOUNT_SID: 'AC1', TWILIO_AUTH_TOKEN: 't' })).toThrow(/TWILIO_WHATSAPP_FROM/);
    expect(() => getWhatsappProvider({ WHATSAPP_PROVIDER: 'carrier-pigeon' })).toThrow(/Unknown WHATSAPP_PROVIDER/);
  });

  it('builds the live provider when fully configured', () => {
    const provider = getWhatsappProvider({
      WHATSAPP_PROVIDER: 'twilio',
      TWILIO_ACCOUNT_SID: 'AC1',
      TWILIO_AUTH_TOKEN: 'secret',
      TWILIO_WHATSAPP_FROM: '+263700000000',
    });
    expect(provider).toMatchObject({ name: 'twilio-whatsapp', live: true });
  });
});

describe('Twilio WhatsApp provider', () => {
  const config = { accountSid: 'AC123', authToken: 'secret', from: '+263700000000', templates: { daily_verse: 'HX_verse' }, statusCallbackUrl: 'https://api.example.org/webhooks/sms/twilio/status' };
  const ok = (body: unknown, status = 200) => vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status }));

  it('sends the approved template with numbered variables and whatsapp: addresses', async () => {
    const fetchImpl = ok({ sid: 'SMwa1' });
    const result = await createTwilioWhatsappProvider(config, fetchImpl).send({ to: '+263771234567', body: 'ignored', template });

    expect(result).toEqual({ providerMessageId: 'SMwa1', status: 'sent' });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://api.twilio.com/2010-04-01/Accounts/AC123/Messages.json');
    const form = init.body as URLSearchParams;
    expect(form.get('To')).toBe('whatsapp:+263771234567');
    expect(form.get('From')).toBe('whatsapp:+263700000000');
    expect(form.get('ContentSid')).toBe('HX_verse');
    expect(JSON.parse(form.get('ContentVariables')!)).toEqual({ '1': 'John 3:16', '2': 'For God so loved the world', '3': 'Test Church' });
    expect(form.get('Body')).toBeNull(); // free text is never sent
    expect(form.get('StatusCallback')).toBe(config.statusCallbackUrl);
    expect(init.headers.Authorization).toBe(`Basic ${Buffer.from('AC123:secret').toString('base64')}`);
  });

  it('refuses to send, without calling Twilio, when no approved template is set up', async () => {
    const fetchImpl = ok({ sid: 'x' });
    const provider = createTwilioWhatsappProvider({ ...config, templates: {} }, fetchImpl);
    await expect(provider.send({ to: '+263771234567', body: 'hi', template })).rejects.toThrow(/No approved WhatsApp template.*WHATSAPP_TEMPLATE_DAILY_VERSE_SID/);
    await expect(provider.send({ to: '+263771234567', body: 'free text only' })).rejects.toBeInstanceOf(SmsProviderError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('uses a messaging service when one is configured', async () => {
    const fetchImpl = ok({ sid: 'SM2' });
    await createTwilioWhatsappProvider({ ...config, from: undefined, messagingServiceSid: 'MG1' }, fetchImpl).send({ to: '+263771234567', body: 'x', template });
    const form = fetchImpl.mock.calls[0][1].body as URLSearchParams;
    expect(form.get('MessagingServiceSid')).toBe('MG1');
    expect(form.get('From')).toBeNull();
  });

  it('marks server errors and rate limits retryable, and client errors not', async () => {
    const attempt = (status: number) =>
      createTwilioWhatsappProvider(config, ok({ message: 'nope', code: 63016 }, status)).send({ to: '+263771234567', body: 'x', template }).catch((e) => e);
    expect(await attempt(500)).toMatchObject({ retryable: true });
    expect(await attempt(429)).toMatchObject({ retryable: true });
    const clientError = await attempt(400);
    expect(clientError).toMatchObject({ retryable: false });
    expect(clientError.message).toContain('63016');
  });

  it('treats a network failure as retryable', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError('fetch failed'));
    await expect(createTwilioWhatsappProvider(config, fetchImpl).send({ to: '+263771234567', body: 'x', template })).rejects.toMatchObject({ retryable: true });
  });
});
