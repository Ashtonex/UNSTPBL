import { createHmac, timingSafeEqual } from 'node:crypto';
import { SmsProviderError, type SmsProvider, type SmsSendRequest, type SmsSendResult } from './types.js';

export interface TwilioConfig {
  accountSid: string;
  authToken: string;
  /** A Messaging Service (preferred: handles sender selection and compliance). */
  messagingServiceSid?: string;
  /** Otherwise a sender number or approved alphanumeric sender id. */
  from?: string;
  /** Where Twilio should POST delivery receipts. */
  statusCallbackUrl?: string;
}

const REQUEST_TIMEOUT_MS = 15_000;

export function createTwilioProvider(config: TwilioConfig, fetchImpl: typeof fetch = fetch): SmsProvider {
  const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Messages.json`;
  const authorization = `Basic ${Buffer.from(`${config.accountSid}:${config.authToken}`).toString('base64')}`;

  return {
    name: 'twilio',
    live: true,
    async send(request: SmsSendRequest): Promise<SmsSendResult> {
      const form = new URLSearchParams({ To: request.to, Body: request.body });
      if (config.messagingServiceSid) form.set('MessagingServiceSid', config.messagingServiceSid);
      else if (config.from) form.set('From', config.from);
      if (config.statusCallbackUrl) form.set('StatusCallback', config.statusCallbackUrl);

      let response: Response;
      try {
        response = await fetchImpl(endpoint, {
          method: 'POST',
          headers: { Authorization: authorization, 'Content-Type': 'application/x-www-form-urlencoded' },
          body: form,
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
      } catch (err) {
        // Network failure or timeout: nothing reached Twilio, so it is safe to retry.
        throw new SmsProviderError(`Could not reach Twilio (${err instanceof Error ? err.name : 'network error'})`, true);
      }

      const payload = (await response.json().catch(() => null)) as
        | { sid?: string; message?: string; code?: number }
        | null;

      if (!response.ok) {
        const detail = payload?.message ?? 'request failed';
        throw new SmsProviderError(
          `Twilio ${response.status}: ${detail}${payload?.code ? ` (code ${payload.code})` : ''}`,
          response.status >= 500 || response.status === 429,
        );
      }

      return { providerMessageId: payload?.sid ?? null, status: 'sent' };
    },
  };
}

/**
 * Verifies that a webhook really came from Twilio: HMAC-SHA1 of the full request
 * URL plus every POST parameter (sorted by name, name immediately followed by
 * value), keyed with the auth token, compared in constant time.
 */
export function isValidTwilioSignature(input: {
  authToken: string;
  url: string;
  params: Record<string, string>;
  signature: string | undefined;
}): boolean {
  if (!input.signature) return false;

  const payload = Object.keys(input.params)
    .sort()
    .reduce((acc, key) => acc + key + input.params[key], input.url);
  const expected = createHmac('sha1', input.authToken).update(payload).digest('base64');

  const a = Buffer.from(expected);
  const b = Buffer.from(input.signature);
  return a.length === b.length && timingSafeEqual(a, b);
}
