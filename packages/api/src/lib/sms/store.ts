import { and, eq, gte, inArray, messageLog, smsOptOuts, sql, type Database } from '@unstpbl/db';
import { db } from '../db.js';
import { getSmsProvider, getWhatsappProvider } from './providers/index.js';
import { readSmsSettings, type SmsDeps, type SmsStore } from './service.js';

export function createDbStore(database: Database): SmsStore {
  return {
    async isOptedOut(phone) {
      const rows = await database.select({ phone: smsOptOuts.phone }).from(smsOptOuts).where(eq(smsOptOuts.phone, phone)).limit(1);
      return rows.length > 0;
    },

    async liveSegmentsSentSince(since, channel = 'sms') {
      const [row] = await database
        .select({ total: sql<number>`coalesce(sum(${messageLog.segments}), 0)::int` })
        .from(messageLog)
        .where(and(inArray(messageLog.status, ['sent', 'delivered']), gte(messageLog.createdAt, since), eq(messageLog.channel, channel)));
      return Number(row?.total ?? 0);
    },

    async insertLog(entry) {
      await database.insert(messageLog).values({
        channel: entry.channel ?? 'sms',
        purpose: entry.purpose,
        recipientPhone: entry.recipientPhone,
        recipientUserId: entry.recipientUserId ?? null,
        recipientVisitorId: entry.recipientVisitorId ?? null,
        body: entry.body,
        segments: entry.segments,
        status: entry.status,
        provider: entry.provider,
        providerMessageId: entry.providerMessageId ?? null,
        error: entry.error ?? null,
        costEstimateUsd: entry.costEstimateUsd == null ? null : entry.costEstimateUsd.toFixed(4),
        createdBy: entry.createdBy ?? null,
      });
    },
  };
}

/** The real wiring: database store, provider chosen from the environment, limits from the environment. */
export function defaultSmsDeps(database: Database = db): SmsDeps {
  return {
    store: createDbStore(database),
    getProvider: () => getSmsProvider(),
    getWhatsappProvider: () => getWhatsappProvider(),
    settings: readSmsSettings(),
  };
}
