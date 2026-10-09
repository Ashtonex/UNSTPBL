import { SmsProviderError, type SmsProvider, type SmsSendRequest, type SmsSendResult } from './types.js';

/**
 * Which environment variable holds the Twilio Content SID of the Meta-approved template for
 * each kind of message. Variables are passed in order: {{1}}, {{2}}, ...
 *
 *   visitor_welcome  {{1}} first name, {{2}} church name
 *   birthday         {{1}} first name, {{2}} church name
 *   daily_verse      {{1}} reference, {{2}} verse text, {{3}} church name
 *   announcement     {{1}} the message, {{2}} church name
 */
export const WHATSAPP_TEMPLATE_ENV: Record<string, string> = {
  visitor_welcome: 'WHATSAPP_TEMPLATE_VISITOR_WELCOME_SID',
  birthday: 'WHATSAPP_TEMPLATE_BIRTHDAY_SID',
  daily_verse: 'WHATSAPP_TEMPLATE_DAILY_VERSE_SID',
  announcement: 'WHATSAPP_TEMPLATE_ANNOUNCEMENT_SID',
};

export interface TwilioWhatsappConfig {
  accountSid: string;
  authToken: string;
  /** The approved WhatsApp sender, with or without the "whatsapp:" prefix. */
  from?: string;
  messagingServiceSid?: string;
  /** Content SID of each approved template, by message kind. */
  templates: Record<string, string>;
  statusCallbackUrl?: string;
}

const REQUEST_TIMEOUT_MS = 15_000;

const asWhatsapp = (number: string) => (number.startsWith('whatsapp:') ? number : `whatsapp:${number}`);

export function createTwilioWhatsappProvider(config: TwilioWhatsappConfig, fetchImpl: typeof fetch = fetch): SmsProvider {
  const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Messages.json`;
  const authorization = `Basic ${Buffer.from(`${config.accountSid}:${config.authToken}`).toString('base64')}`;

  return {
    name: 'twilio-whatsapp',
    live: true,
    async send(request: SmsSendRequest): Promise<SmsSendResult> {
      // A business-started WhatsApp message must use an approved template. Free text is only
      // allowed inside the 24 hours after the person last wrote to you, so we never send it.
      const templateKey = request.template?.key;
      const contentSid = templateKey ? config.templates[templateKey] : undefined;
      if (!request.template || !contentSid) {
        throw new SmsProviderError(
          `No approved WhatsApp template is set up for "${templateKey ?? 'this message'}". Add its Content SID (${
            templateKey ? (WHATSAPP_TEMPLATE_ENV[templateKey] ?? 'WHATSAPP_TEMPLATE_*_SID') : 'WHATSAPP_TEMPLATE_*_SID'
          }) to go live.`,
          false,
        );
      }

      const variables: Record<string, string> = {};
      request.template.variables.forEach((value, index) => {
        variables[String(index + 1)] = value;
      });

      const form = new URLSearchParams({
        To: asWhatsapp(request.to),
        ContentSid: contentSid,
        ContentVariables: JSON.stringify(variables),
      });
      if (config.messagingServiceSid) form.set('MessagingServiceSid', config.messagingServiceSid);
      else if (config.from) form.set('From', asWhatsapp(config.from));
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
        throw new SmsProviderError(`Could not reach Twilio (${err instanceof Error ? err.name : 'network error'})`, true);
      }

      const payload = (await response.json().catch(() => null)) as { sid?: string; message?: string; code?: number } | null;

      if (!response.ok) {
        throw new SmsProviderError(
          `Twilio ${response.status}: ${payload?.message ?? 'request failed'}${payload?.code ? ` (code ${payload.code})` : ''}`,
          response.status >= 500 || response.status === 429,
        );
      }

      return { providerMessageId: payload?.sid ?? null, status: 'sent' };
    },
  };
}
