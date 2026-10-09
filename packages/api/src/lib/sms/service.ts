import { analyzeSms, toSmsFriendly } from './encoding.js';
import { normalizePhone } from './phone.js';
import { SmsConfigError, SmsProviderError, type SmsProvider } from './providers/types.js';

export type MessagePurpose = 'visitor_welcome' | 'birthday' | 'announcement' | 'daily_verse' | 'test';
export type LogStatus = 'sent' | 'delivered' | 'failed' | 'blocked' | 'dry_run';
/** How a message travels. SMS reaches any phone; WhatsApp is cheaper but needs data. */
export type Channel = 'sms' | 'whatsapp';

export type SendFailureReason =
  | 'invalid_phone'
  | 'empty_message'
  | 'too_long'
  | 'opted_out'
  | 'monthly_cap'
  | 'not_configured'
  | 'provider_error';

export interface LogEntry {
  channel?: Channel;
  purpose: MessagePurpose;
  recipientPhone: string;
  recipientUserId?: string | null;
  recipientVisitorId?: string | null;
  body: string;
  segments: number;
  status: LogStatus;
  provider: string;
  providerMessageId?: string | null;
  error?: string | null;
  costEstimateUsd?: number | null;
  createdBy?: string | null;
}

/** Everything the sender needs from storage, so the rules can be tested without a database. */
export interface SmsStore {
  isOptedOut(phone: string): Promise<boolean>;
  /** Segments (SMS) or messages (WhatsApp) actually delivered to a carrier, live sends only, since the given moment. */
  liveSegmentsSentSince(since: Date, channel?: Channel): Promise<number>;
  insertLog(entry: LogEntry): Promise<void>;
}

export interface SmsSettings {
  /** Hard ceiling on live segments per calendar month (UTC). The brake on a runaway or abused account. */
  monthlySegmentCap: number;
  /** What one segment costs, for estimates. Null until it has been configured. */
  costPerSegmentUsd: number | null;
  /** Same brake for WhatsApp, counted in messages (a WhatsApp message has no segments). */
  whatsappMonthlyMessageCap: number;
  whatsappCostPerMessageUsd: number | null;
}

const DEFAULT_MONTHLY_SEGMENT_CAP = 300;
// A single message is never allowed to be longer than this many segments.
export const MAX_SEGMENTS_PER_MESSAGE = 4;

export function readSmsSettings(env: Record<string, string | undefined> = process.env): SmsSettings {
  const cap = Number(env.SMS_MONTHLY_SEGMENT_CAP);
  const cost = Number(env.SMS_COST_PER_SEGMENT_USD);
  const waCap = Number(env.WHATSAPP_MONTHLY_MESSAGE_CAP);
  const waCost = Number(env.WHATSAPP_COST_PER_MESSAGE_USD);
  return {
    whatsappMonthlyMessageCap:
      Number.isFinite(waCap) && waCap >= 0 && env.WHATSAPP_MONTHLY_MESSAGE_CAP !== '' ? Math.floor(waCap) : DEFAULT_MONTHLY_SEGMENT_CAP,
    whatsappCostPerMessageUsd: Number.isFinite(waCost) && waCost > 0 && env.WHATSAPP_COST_PER_MESSAGE_USD ? waCost : null,
    monthlySegmentCap: Number.isFinite(cap) && cap >= 0 && env.SMS_MONTHLY_SEGMENT_CAP !== '' ? Math.floor(cap) : DEFAULT_MONTHLY_SEGMENT_CAP,
    costPerSegmentUsd: Number.isFinite(cost) && cost > 0 && env.SMS_COST_PER_SEGMENT_USD ? cost : null,
  };
}

export interface SmsDeps {
  store: SmsStore;
  getProvider: () => SmsProvider;
  /** Absent means WhatsApp is not available: WhatsApp sends are blocked rather than sent as SMS. */
  getWhatsappProvider?: () => SmsProvider;
  settings: SmsSettings;
  now?: () => Date;
}

export interface SendRequest {
  /** Defaults to SMS. */
  channel?: Channel;
  /** WhatsApp only: the approved template (and its values) that carries this message. */
  template?: { key: string; variables: string[] };
  to: string;
  body: string;
  purpose: MessagePurpose;
  recipientUserId?: string | null;
  recipientVisitorId?: string | null;
  createdBy?: string | null;
}

export interface SendResult {
  status: LogStatus;
  segments: number;
  reason?: SendFailureReason;
  detail?: string;
  providerMessageId?: string | null;
}

export function startOfMonthUtc(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/**
 * The one door every text goes through. In order it checks: the number is valid, the
 * message is non-empty and a sane length, the number has not opted out, the monthly
 * cap has room, and the provider is configured. Every outcome (sent, dry-run, blocked,
 * failed) is written to the message log, so spend and history are always accountable.
 *
 * It never throws for an expected problem: callers get a result describing what happened.
 */
export async function sendSms(deps: SmsDeps, request: SendRequest): Promise<SendResult> {
  const channel: Channel = request.channel ?? 'sms';
  const phone = normalizePhone(request.to);
  if (!phone.ok) return { status: 'blocked', segments: 0, reason: 'invalid_phone', detail: phone.error };

  // WhatsApp carries any text, so it is not squeezed into SMS encoding or counted in segments:
  // one WhatsApp message is one billable unit.
  const body = channel === 'whatsapp' ? request.body.replace(/[ \t]+/g, ' ').trim() : toSmsFriendly(request.body);
  const segments = channel === 'whatsapp' ? (body === '' ? 0 : 1) : analyzeSms(body).segments;
  if (segments === 0) return { status: 'blocked', segments: 0, reason: 'empty_message' };

  const record = async (status: LogStatus, provider: string, extra: Partial<LogEntry> = {}) => {
    try {
      await deps.store.insertLog({
        channel,
        purpose: request.purpose,
        recipientPhone: phone.e164,
        recipientUserId: request.recipientUserId ?? null,
        recipientVisitorId: request.recipientVisitorId ?? null,
        body,
        segments,
        status,
        provider,
        createdBy: request.createdBy ?? null,
        ...extra,
      });
    } catch (err) {
      // The message may already be on its way; a logging failure must not hide that.
      console.error('Failed to write message log:', err);
    }
  };

  const block = async (reason: SendFailureReason, detail?: string): Promise<SendResult> => {
    await record('blocked', 'none', { error: detail ?? reason });
    return { status: 'blocked', segments, reason, detail };
  };

  if (channel === 'sms' && segments > MAX_SEGMENTS_PER_MESSAGE) {
    return block('too_long', `Message needs ${segments} segments; the limit is ${MAX_SEGMENTS_PER_MESSAGE}.`);
  }

  if (await deps.store.isOptedOut(phone.e164)) return block('opted_out');

  let provider: SmsProvider;
  try {
    if (channel === 'whatsapp') {
      if (!deps.getWhatsappProvider) throw new SmsConfigError('WhatsApp is not set up.');
      provider = deps.getWhatsappProvider();
    } else {
      provider = deps.getProvider();
    }
  } catch (err) {
    if (err instanceof SmsConfigError) return block('not_configured', err.message);
    throw err;
  }

  // Dry-run costs nothing, so only live sends count against (and are held to) the cap.
  if (provider.live) {
    const used = await deps.store.liveSegmentsSentSince(startOfMonthUtc((deps.now ?? (() => new Date()))()), channel);
    const cap = channel === 'whatsapp' ? deps.settings.whatsappMonthlyMessageCap : deps.settings.monthlySegmentCap;
    if (used + segments > cap) {
      return block(
        'monthly_cap',
        `Monthly limit of ${cap} ${channel === 'whatsapp' ? 'WhatsApp messages' : 'segments'} reached (${used} used).`,
      );
    }
  }

  try {
    const sent = await provider.send({ to: phone.e164, body, template: request.template });
    const unitCost = channel === 'whatsapp' ? deps.settings.whatsappCostPerMessageUsd : deps.settings.costPerSegmentUsd;
    const cost = provider.live && unitCost !== null ? segments * unitCost : null;
    await record(sent.status, provider.name, { providerMessageId: sent.providerMessageId, costEstimateUsd: cost });
    return { status: sent.status, segments, providerMessageId: sent.providerMessageId };
  } catch (err) {
    const message = err instanceof SmsProviderError ? err.message : 'Unexpected error while sending.';
    if (!(err instanceof SmsProviderError)) console.error('Unexpected SMS send error:', err);
    await record('failed', provider.name, { error: message });
    return { status: 'failed', segments, reason: 'provider_error', detail: message };
  }
}

export interface CostEstimate {
  totalSegments: number;
  estimatedCostUsd: number | null;
}

export function estimateCost(messages: number, segmentsPerMessage: number, settings: SmsSettings): CostEstimate {
  const totalSegments = messages * segmentsPerMessage;
  return {
    totalSegments,
    estimatedCostUsd: settings.costPerSegmentUsd === null ? null : totalSegments * settings.costPerSegmentUsd,
  };
}
