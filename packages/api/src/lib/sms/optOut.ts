import { eq, messageLog, smsOptOuts, type Database } from '@unstpbl/db';

// Replies that mean "stop texting me" (the standard carrier keywords) or "resume".
// The reply must be exactly the keyword: "Yes, I'll be there" is a normal reply.
const STOP_KEYWORDS = new Set(['stop', 'stopall', 'unsubscribe', 'cancel', 'end', 'quit']);
const START_KEYWORDS = new Set(['start', 'unstop']);

export function classifyInboundKeyword(body: string | undefined | null): 'stop' | 'start' | null {
  const word = (body ?? '').trim().toLowerCase().replace(/[^a-z]/g, '');
  if (STOP_KEYWORDS.has(word)) return 'stop';
  if (START_KEYWORDS.has(word)) return 'start';
  return null;
}

export async function recordOptOut(database: Database, phone: string, source = 'stop_keyword'): Promise<void> {
  await database.insert(smsOptOuts).values({ phone, source }).onConflictDoNothing();
}

export async function clearOptOut(database: Database, phone: string): Promise<void> {
  await database.delete(smsOptOuts).where(eq(smsOptOuts.phone, phone));
}

/** Maps a provider delivery receipt onto the message log. Unknown intermediate states are ignored. */
export async function applyDeliveryStatus(
  database: Database,
  providerMessageId: string,
  providerStatus: string,
  errorCode?: string,
): Promise<'updated' | 'ignored'> {
  const status = providerStatus.toLowerCase();
  if (status === 'delivered') {
    await database.update(messageLog).set({ status: 'delivered' }).where(eq(messageLog.providerMessageId, providerMessageId));
    return 'updated';
  }
  if (status === 'failed' || status === 'undelivered') {
    await database
      .update(messageLog)
      .set({ status: 'failed', error: `Delivery ${status}${errorCode ? ` (code ${errorCode})` : ''}` })
      .where(eq(messageLog.providerMessageId, providerMessageId));
    return 'updated';
  }
  return 'ignored';
}
