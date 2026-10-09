import { and, eq, inArray, smsConsents, smsOptOuts, userCircles, users, visitors, type Database } from '@unstpbl/db';
import { normalizePhone } from './phone.js';
import type { Channel } from './service.js';

export type Audience =
  | { type: 'all_members' }
  | { type: 'leaders' }
  | { type: 'congregation'; congregation: string }
  | { type: 'circle'; circleId: string }
  | { type: 'visitors' };

export interface Recipient {
  /** E.164. */
  phone: string;
  name: string | null;
  userId?: string;
  visitorId?: string;
  /** How this person wants to be reached. Visitors are always texted by SMS. Absent means SMS. */
  channel?: Channel;
}

export interface ResolvedAudience {
  recipients: Recipient[];
  /** People in the audience whose saved number is not a usable mobile number. */
  skippedInvalidPhone: number;
  /** People excluded because their number replied STOP. */
  skippedOptedOut: number;
}

/** A single announcement never goes to more people than this. Narrow the audience instead. */
export const MAX_AUDIENCE_SIZE = 500;

/**
 * Works out exactly who an announcement would reach. Members appear only if they
 * switched on announcement texts themselves and have a usable number; visitors only if
 * they consented on their visit card. Anyone who replied STOP is always excluded.
 */
export async function resolveAudience(database: Database, audience: Audience): Promise<ResolvedAudience> {
  const candidates: Array<{ rawPhone: string | null; name: string | null; userId?: string; visitorId?: string; channel?: Channel }> = [];

  if (audience.type === 'visitors') {
    const rows = await database
      .select({ id: visitors.id, name: visitors.fullName, phone: visitors.phone })
      .from(visitors)
      .where(eq(visitors.smsConsent, true));
    for (const row of rows) candidates.push({ rawPhone: row.phone, name: row.name, visitorId: row.id });
  } else {
    const base = database
      .select({ id: users.id, name: users.displayName, phone: users.phone, channel: smsConsents.preferredChannel })
      .from(users)
      .innerJoin(smsConsents, eq(smsConsents.userId, users.id));

    let rows;
    switch (audience.type) {
      case 'all_members':
        rows = await base.where(eq(smsConsents.announcements, true));
        break;
      case 'leaders':
        rows = await base.where(and(eq(smsConsents.announcements, true), inArray(users.role, ['bishop', 'admin'])));
        break;
      case 'congregation':
        rows = await base.where(and(eq(smsConsents.announcements, true), eq(users.congregation, audience.congregation)));
        break;
      case 'circle':
        rows = await base
          .innerJoin(userCircles, eq(userCircles.userId, users.id))
          .where(and(eq(smsConsents.announcements, true), eq(userCircles.circleId, audience.circleId)));
        break;
    }
    for (const row of rows) {
      candidates.push({ rawPhone: row.phone, name: row.name, userId: row.id, channel: row.channel === 'whatsapp' ? 'whatsapp' : 'sms' });
    }
  }

  const byPhone = new Map<string, Recipient>();
  let skippedInvalidPhone = 0;
  for (const candidate of candidates) {
    const phone = normalizePhone(candidate.rawPhone ?? '');
    if (!phone.ok) {
      skippedInvalidPhone += 1;
      continue;
    }
    if (!byPhone.has(phone.e164)) {
      byPhone.set(phone.e164, {
        phone: phone.e164,
        name: candidate.name,
        userId: candidate.userId,
        visitorId: candidate.visitorId,
        channel: candidate.channel,
      });
    }
  }

  let skippedOptedOut = 0;
  const phones = [...byPhone.keys()];
  if (phones.length > 0) {
    const optedOut = await database.select({ phone: smsOptOuts.phone }).from(smsOptOuts).where(inArray(smsOptOuts.phone, phones));
    for (const { phone } of optedOut) {
      if (byPhone.delete(phone)) skippedOptedOut += 1;
    }
  }

  return { recipients: [...byPhone.values()], skippedInvalidPhone, skippedOptedOut };
}
