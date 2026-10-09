import { dryRunProvider } from './dryRun.js';
import { createTwilioProvider } from './twilio.js';
import { createTwilioWhatsappProvider, WHATSAPP_TEMPLATE_ENV } from './twilioWhatsapp.js';
import { SmsConfigError, type SmsProvider } from './types.js';

export * from './types.js';

type Env = Record<string, string | undefined>;

/**
 * Picks the provider from the environment. The default is the dry-run provider, so
 * nothing is ever sent (or paid for) until SMS_PROVIDER is set deliberately.
 *
 * A half-configured live provider throws rather than quietly falling back to
 * dry-run: someone who has set SMS_PROVIDER=twilio expects real messages.
 */
export function getSmsProvider(env: Env = process.env): SmsProvider {
  const name = (env.SMS_PROVIDER || 'dryrun').trim().toLowerCase();

  if (name === 'dryrun') return dryRunProvider;

  if (name === 'twilio') {
    const accountSid = env.TWILIO_ACCOUNT_SID?.trim();
    const authToken = env.TWILIO_AUTH_TOKEN?.trim();
    const messagingServiceSid = env.TWILIO_MESSAGING_SERVICE_SID?.trim();
    const from = (env.TWILIO_FROM || env.SMS_SENDER_ID)?.trim();

    if (!accountSid || !authToken) {
      throw new SmsConfigError('SMS_PROVIDER=twilio needs TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN.');
    }
    if (!messagingServiceSid && !from) {
      throw new SmsConfigError('SMS_PROVIDER=twilio needs TWILIO_MESSAGING_SERVICE_SID or TWILIO_FROM.');
    }

    const publicUrl = env.PUBLIC_API_URL?.trim().replace(/\/+$/, '');
    return createTwilioProvider({
      accountSid,
      authToken,
      messagingServiceSid,
      from,
      statusCallbackUrl: publicUrl ? `${publicUrl}/webhooks/sms/twilio/status` : undefined,
    });
  }

  throw new SmsConfigError(`Unknown SMS_PROVIDER "${name}". Use "dryrun" or "twilio".`);
}

/**
 * Picks the WhatsApp provider. Like SMS it defaults to dry-run (nothing sent, nothing
 * charged) until WHATSAPP_PROVIDER is set deliberately, and a half-configured live
 * provider throws rather than quietly falling back.
 */
export function getWhatsappProvider(env: Env = process.env): SmsProvider {
  const name = (env.WHATSAPP_PROVIDER || 'dryrun').trim().toLowerCase();

  if (name === 'dryrun') return dryRunProvider;

  if (name === 'twilio') {
    const accountSid = env.TWILIO_ACCOUNT_SID?.trim();
    const authToken = env.TWILIO_AUTH_TOKEN?.trim();
    const from = env.TWILIO_WHATSAPP_FROM?.trim();
    const messagingServiceSid = env.TWILIO_WHATSAPP_MESSAGING_SERVICE_SID?.trim();

    if (!accountSid || !authToken) {
      throw new SmsConfigError('WHATSAPP_PROVIDER=twilio needs TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN.');
    }
    if (!from && !messagingServiceSid) {
      throw new SmsConfigError('WHATSAPP_PROVIDER=twilio needs TWILIO_WHATSAPP_FROM or TWILIO_WHATSAPP_MESSAGING_SERVICE_SID.');
    }

    const templates: Record<string, string> = {};
    for (const [key, variable] of Object.entries(WHATSAPP_TEMPLATE_ENV)) {
      const sid = env[variable]?.trim();
      if (sid) templates[key] = sid;
    }

    const publicUrl = env.PUBLIC_API_URL?.trim().replace(/\/+$/, '');
    return createTwilioWhatsappProvider({
      accountSid,
      authToken,
      from,
      messagingServiceSid,
      templates,
      statusCallbackUrl: publicUrl ? `${publicUrl}/webhooks/sms/twilio/status` : undefined,
    });
  }

  throw new SmsConfigError(`Unknown WHATSAPP_PROVIDER "${name}". Use "dryrun" or "twilio".`);
}
