import { createHmac } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { getSmsProvider } from './index.js';
import { createTwilioProvider, isValidTwilioSignature } from './twilio.js';
import { SmsConfigError, SmsProviderError } from './types.js';

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('getSmsProvider', () => {
  it('defaults to dry-run, so nothing is sent until someone opts in', () => {
    const provider = getSmsProvider({});
    expect(provider.name).toBe('dryrun');
    expect(provider.live).toBe(false);
  });

  it('dry-run reports "dry_run" and never touches the network', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const result = await getSmsProvider({ SMS_PROVIDER: 'dryrun' }).send({ to: '+263771234567', body: 'hello' });
    expect(result.status).toBe('dry_run');
    expect(result.providerMessageId).toMatch(/^dryrun-/);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('builds a live Twilio provider from complete settings', () => {
    const provider = getSmsProvider({
      SMS_PROVIDER: 'twilio',
      TWILIO_ACCOUNT_SID: 'ACxxxx',
      TWILIO_AUTH_TOKEN: 'secret',
      TWILIO_MESSAGING_SERVICE_SID: 'MGxxxx',
    });
    expect(provider).toMatchObject({ name: 'twilio', live: true });
  });

  it.each([
    [{ SMS_PROVIDER: 'twilio' }, 'TWILIO_ACCOUNT_SID'],
    [{ SMS_PROVIDER: 'twilio', TWILIO_ACCOUNT_SID: 'AC1', TWILIO_AUTH_TOKEN: 't' }, 'TWILIO_MESSAGING_SERVICE_SID or TWILIO_FROM'],
    [{ SMS_PROVIDER: 'carrier-pigeon' }, 'Unknown SMS_PROVIDER'],
  ])('refuses a half-configured provider instead of silently falling back to dry-run (%j)', (env, message) => {
    expect(() => getSmsProvider(env)).toThrow(SmsConfigError);
    expect(() => getSmsProvider(env)).toThrow(message);
  });
});

describe('Twilio provider', () => {
  const config = { accountSid: 'AC123', authToken: 'super-secret-token', messagingServiceSid: 'MG456' };

  it('posts the message to the right endpoint with basic auth and form fields', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(201, { sid: 'SM789' }));
    const provider = createTwilioProvider(
      { ...config, statusCallbackUrl: 'https://api.example.org/webhooks/sms/twilio/status' },
      fetchMock,
    );

    const result = await provider.send({ to: '+263771234567', body: 'Hi there' });

    expect(result).toEqual({ providerMessageId: 'SM789', status: 'sent' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.twilio.com/2010-04-01/Accounts/AC123/Messages.json');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe(`Basic ${Buffer.from('AC123:super-secret-token').toString('base64')}`);
    const form = init.body as URLSearchParams;
    expect(form.get('To')).toBe('+263771234567');
    expect(form.get('Body')).toBe('Hi there');
    expect(form.get('MessagingServiceSid')).toBe('MG456');
    expect(form.get('From')).toBeNull();
    expect(form.get('StatusCallback')).toBe('https://api.example.org/webhooks/sms/twilio/status');
  });

  it('uses From when there is no messaging service', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(201, { sid: 'SM1' }));
    await createTwilioProvider({ accountSid: 'AC123', authToken: 't', from: 'VTCM' }, fetchMock).send({
      to: '+263771234567',
      body: 'x',
    });
    const form = fetchMock.mock.calls[0][1].body as URLSearchParams;
    expect(form.get('From')).toBe('VTCM');
    expect(form.get('MessagingServiceSid')).toBeNull();
  });

  it('turns an API error into a descriptive error that never contains the auth token', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(400, { code: 21211, message: "The 'To' number is not a valid phone number." }));
    const error = await createTwilioProvider(config, fetchMock)
      .send({ to: '+263771234567', body: 'x' })
      .catch((e) => e);

    expect(error).toBeInstanceOf(SmsProviderError);
    expect(error.message).toContain('Twilio 400');
    expect(error.message).toContain('21211');
    expect(error.retryable).toBe(false);
    expect(error.message).not.toContain('super-secret-token');
  });

  it('marks server errors, rate limits and network failures as retryable', async () => {
    const send = (fetchImpl: typeof fetch): Promise<SmsProviderError> =>
      createTwilioProvider(config, fetchImpl)
        .send({ to: '+263771234567', body: 'x' })
        .then(
          () => {
            throw new Error('expected the send to fail');
          },
          (e: unknown) => e as SmsProviderError,
        );

    expect((await send(vi.fn().mockResolvedValue(jsonResponse(503, {})) as unknown as typeof fetch)).retryable).toBe(true);
    expect((await send(vi.fn().mockResolvedValue(jsonResponse(429, {})) as unknown as typeof fetch)).retryable).toBe(true);
    const networkFailure = await send(vi.fn().mockRejectedValue(new TypeError('fetch failed')) as unknown as typeof fetch);
    expect(networkFailure.retryable).toBe(true);
    expect(networkFailure.message).not.toContain('super-secret-token');
  });
});

describe('Twilio webhook signature', () => {
  const authToken = 'webhook-token';
  const url = 'https://api.example.org/webhooks/sms/twilio/inbound';
  const params = { From: '+263771234567', Body: 'STOP', MessageSid: 'SM1' };
  // Documented algorithm: url + (param names sorted, each name followed by its value).
  const sign = (p: Record<string, string>) =>
    createHmac('sha1', authToken)
      .update(url + 'Body' + p.Body + 'From' + p.From + 'MessageSid' + p.MessageSid)
      .digest('base64');

  it('accepts a correctly signed request', () => {
    expect(isValidTwilioSignature({ authToken, url, params, signature: sign(params) })).toBe(true);
  });

  it('is independent of parameter order', () => {
    const shuffled = { MessageSid: 'SM1', Body: 'STOP', From: '+263771234567' };
    expect(isValidTwilioSignature({ authToken, url, params: shuffled, signature: sign(params) })).toBe(true);
  });

  it('rejects tampered parameters, a different URL, the wrong token and a missing signature', () => {
    const signature = sign(params);
    expect(isValidTwilioSignature({ authToken, url, params: { ...params, Body: 'START' }, signature })).toBe(false);
    expect(isValidTwilioSignature({ authToken, url: url + '?x=1', params, signature })).toBe(false);
    expect(isValidTwilioSignature({ authToken: 'other', url, params, signature })).toBe(false);
    expect(isValidTwilioSignature({ authToken, url, params, signature: undefined })).toBe(false);
    expect(isValidTwilioSignature({ authToken, url, params, signature: 'short' })).toBe(false);
  });
});
