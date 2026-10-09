import { dryRunProvider } from './dryRun.js';
import { createTwilioProvider } from './twilio.js';
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
