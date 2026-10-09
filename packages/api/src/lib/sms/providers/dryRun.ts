import { randomUUID } from 'node:crypto';
import { maskPhone } from '../phone.js';
import type { SmsProvider, SmsSendRequest, SmsSendResult } from './types.js';

/**
 * The default provider. Accepts messages and records them in the log exactly like
 * a real one, but delivers nothing and costs nothing. Lets the whole feature be
 * built, demoed and tested safely before a provider is chosen.
 */
export const dryRunProvider: SmsProvider = {
  name: 'dryrun',
  live: false,
  async send(request: SmsSendRequest): Promise<SmsSendResult> {
    console.log(`[sms:dry-run] would send ${request.body.length} chars to ${maskPhone(request.to)}`);
    return { providerMessageId: `dryrun-${randomUUID()}`, status: 'dry_run' };
  },
};
