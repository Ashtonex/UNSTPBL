import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Database } from '@unstpbl/db';
import { sendBirthdayGreeting, sendDailyVerses } from './memberMessages.js';
import type { LogEntry, SmsDeps, SmsStore, SmsSettings } from './service.js';
import { dryRunProvider } from './providers/dryRun.js';

/**
 * A stand-in database. Every query builder step returns the same chain, and awaiting the
 * chain yields the next prepared result, in the order the code under test runs its queries.
 */
function queuedDb(results: unknown[][]): Database {
  const queue = [...results];
  const chain: Record<string, unknown> = {};
  for (const step of ['select', 'from', 'innerJoin', 'leftJoin', 'where', 'limit']) chain[step] = () => chain;
  chain.then = (resolve: (value: unknown) => unknown) => resolve(queue.shift() ?? []);
  return chain as unknown as Database;
}

const settings: SmsSettings = { monthlySegmentCap: 100, costPerSegmentUsd: 0.1, whatsappMonthlyMessageCap: 100, whatsappCostPerMessageUsd: 0.0275 };

function harness() {
  const log: LogEntry[] = [];
  const store: SmsStore = { isOptedOut: async () => false, liveSegmentsSentSince: async () => 0, insertLog: async (e) => void log.push(e) };
  const deps: SmsDeps = { store, getProvider: () => dryRunProvider, getWhatsappProvider: () => dryRunProvider, settings };
  return { log, deps };
}

beforeEach(() => vi.spyOn(console, 'log').mockImplementation(() => {}));

describe('daily verse routing by member channel', () => {
  const verse = { verse: { chapter: 3, verseNumber: 16, text: 'For God so loved the world.' }, book: { name: 'John' } };

  it('sends each member on the channel they chose, with the verse template for WhatsApp', async () => {
    const { log, deps } = harness();
    const members = [
      { id: 'u1', phone: '0771111111', translation: 'KJV', channel: 'sms' },
      { id: 'u2', phone: '0772222222', translation: 'KJV', channel: 'whatsapp' },
      { id: 'u3', phone: '0773333333', translation: 'KJV', channel: null },
    ];
    // queries in order: members, already messaged today, verse wording
    const database = queuedDb([members, [], []]);
    const calls: Array<{ to: string; template?: { key: string; variables: string[] } }> = [];
    deps.getWhatsappProvider = () => ({ name: 'dryrun', live: false, send: async (r) => (calls.push(r), { providerMessageId: 'x', status: 'dry_run' as const }) });

    const summary = await sendDailyVerses(database, deps, { startOfTodayUtc: new Date('2026-10-12T00:00:00Z'), getVerse: async () => verse });

    expect(summary).toMatchObject({ considered: 3, dryRun: 3, blocked: 0 });
    expect(log.map((e) => [e.recipientPhone, e.channel])).toEqual([
      ['+263771111111', 'sms'],
      ['+263772222222', 'whatsapp'],
      ['+263773333333', 'sms'], // no stored choice means SMS
    ]);
    expect(calls).toHaveLength(1);
    expect(calls[0].template).toMatchObject({ key: 'daily_verse' });
    expect(calls[0].template?.variables.slice(0, 2)).toEqual(['John 3:16', 'For God so loved the world.']);
  });

  it('a channel that is out of allowance stops only its own members', async () => {
    const { log, deps } = harness();
    deps.settings = { ...settings, whatsappMonthlyMessageCap: 1 };
    deps.getWhatsappProvider = () => ({ name: 'twilio-whatsapp', live: true, send: async () => ({ providerMessageId: 'w', status: 'sent' as const }) });
    const members = [
      { id: 'u1', phone: '0771111111', translation: 'KJV', channel: 'whatsapp' },
      { id: 'u2', phone: '0772222222', translation: 'KJV', channel: 'whatsapp' },
      { id: 'u3', phone: '0773333333', translation: 'KJV', channel: 'sms' },
    ];
    // WhatsApp usage is counted from the log: after one send the single-message cap is full
    let used = 0;
    deps.store = { ...deps.store, liveSegmentsSentSince: async (_s, channel = 'sms') => (channel === 'whatsapp' ? used : 0), insertLog: async (e) => { log.push(e); if (e.channel === 'whatsapp' && e.status === 'sent') used += 1; } };

    const summary = await sendDailyVerses(queuedDb([members, [], []]), deps, { startOfTodayUtc: new Date('2026-10-12T00:00:00Z'), getVerse: async () => verse });

    expect(summary.stoppedForCap).toBe(true);
    expect(summary.sent).toBe(1); // first WhatsApp member
    expect(summary.dryRun).toBe(1); // the SMS member is still served (SMS provider is the dry-run one)
    expect(summary.blocked).toBe(1); // second WhatsApp member held back
  });
});

describe('birthday routing by member channel', () => {
  it('uses WhatsApp and the birthday template for a member who chose it', async () => {
    const { log, deps } = harness();
    const sent: Array<{ template?: { key: string; variables: string[] } }> = [];
    deps.getWhatsappProvider = () => ({ name: 'dryrun', live: false, send: async (r) => (sent.push(r), { providerMessageId: 'x', status: 'dry_run' as const }) });
    // queries in order: the member row, the birthday wording
    const database = queuedDb([[{ phone: '0771234567', name: 'tendai moyo', birthday: true, channel: 'whatsapp' }], []]);

    await sendBirthdayGreeting(database, deps, 'u1');

    expect(log[0]).toMatchObject({ channel: 'whatsapp', purpose: 'birthday' });
    expect(sent[0].template?.key).toBe('birthday');
    expect(sent[0].template?.variables[0]).toBe('Tendai');
  });

  it('stays on SMS for a member without a stored choice, and sends nothing without consent', async () => {
    const a = harness();
    await sendBirthdayGreeting(queuedDb([[{ phone: '0771234567', name: 'Tendai', birthday: true, channel: null }], []]), a.deps, 'u1');
    expect(a.log[0]).toMatchObject({ channel: 'sms' });

    const b = harness();
    const result = await sendBirthdayGreeting(queuedDb([[{ phone: '0771234567', name: 'Tendai', birthday: false, channel: 'whatsapp' }]]), b.deps, 'u1');
    expect(result).toEqual({ status: 'skipped' });
    expect(b.log).toHaveLength(0);
  });
});
