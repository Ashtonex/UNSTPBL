import { createHash } from 'node:crypto';
import { Hono } from 'hono';
import { desc, eq, ilike, messageLog, or, users, visitors } from '@unstpbl/db';
import { db } from '../lib/db.js';
import { recordAuditLog } from '../lib/audit.js';
import { validateUuid } from '../lib/validation.js';
import { authMiddleware } from '../middleware/auth.js';
import { bishopMiddleware } from '../middleware/bishop.js';
import { createRateLimit } from '../middleware/rateLimit.js';
import { MAX_AUDIENCE_SIZE, resolveAudience, type Recipient } from '../lib/sms/audience.js';
import { analyzeSms } from '../lib/sms/encoding.js';
import { getSmsPreferences, saveSmsPreferences } from '../lib/sms/memberMessages.js';
import { applyDeliveryStatus, classifyInboundKeyword, clearOptOut, recordOptOut } from '../lib/sms/optOut.js';
import { maskPhone, normalizePhone } from '../lib/sms/phone.js';
import { getSmsProvider, SmsConfigError } from '../lib/sms/providers/index.js';
import { isValidTwilioSignature } from '../lib/sms/providers/twilio.js';
import {
  MAX_SEGMENTS_PER_MESSAGE,
  estimateCost,
  readSmsSettings,
  sendSms,
  startOfMonthUtc,
  type SmsDeps,
} from '../lib/sms/service.js';
import { createDbStore, defaultSmsDeps } from '../lib/sms/store.js';
import { MAX_SAVED_ANNOUNCEMENTS, createSavedAnnouncement, deleteSavedAnnouncement, listSavedAnnouncements } from '../lib/sms/savedAnnouncements.js';
import { listTemplates, resetTemplate, saveTemplate, buildTemplateView } from '../lib/sms/templateStore.js';
import { announcementMessage, checkTemplateBody, isTemplateKey } from '../lib/sms/templates.js';
import {
  validatePreviewBody,
  validateSendBody,
  validateSmsPreferencesBody,
  validateVisitorBody,
  validateVisitorPatch,
  validateMessageText,
  validateSavedAnnouncement,
} from '../lib/sms/validation.js';
import { recordVisit, registerVisitor, sendVisitorWelcome } from '../lib/sms/visitors.js';
import { churchToday } from './verses.js';

export const messagingRoutes = new Hono();

// Each route lists its guards explicitly. (A path-prefix `.use()` is merged into the
// shared router and can leak onto unrelated routes; explicit is leak-proof.)
const leaders = [authMiddleware, bishopMiddleware] as const;

const SEND_CONCURRENCY = 8;
const DUPLICATE_SEND_WINDOW_MS = 2 * 60_000;

// Remembers recent sends so a double-click or a client retry cannot text everyone twice.
const recentBatches = new Map<string, number>();

function claimBatch(key: string, now = Date.now()): boolean {
  for (const [existing, at] of recentBatches) if (now - at > DUPLICATE_SEND_WINDOW_MS) recentBatches.delete(existing);
  if (recentBatches.has(key)) return false;
  recentBatches.set(key, now);
  return true;
}

export function resetBatchGuardForTests(): void {
  recentBatches.clear();
}

const jsonBody = (c: { req: { json: () => Promise<unknown> } }) => c.req.json().catch(() => null);

function providerSummary(): { name: string; live: boolean } | { error: string } {
  try {
    const provider = getSmsProvider();
    return { name: provider.name, live: provider.live };
  } catch (err) {
    return { error: err instanceof SmsConfigError ? err.message : 'SMS is not configured.' };
  }
}

async function liveSegmentsUsed(): Promise<number> {
  return createDbStore(db).liveSegmentsSentSince(startOfMonthUtc(new Date()));
}

/** Runs `work` over `items` with a fixed number in flight at once. */
async function pool<T>(items: T[], size: number, work: (item: T) => Promise<boolean | void>): Promise<void> {
  let next = 0;
  let stop = false;
  const worker = async () => {
    while (!stop && next < items.length) {
      const item = items[next++];
      if ((await work(item)) === false) stop = true;
    }
  };
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, worker));
}

// ── Status, preview, send ────────────────────────────────────────────────────

messagingRoutes.get('/messages/status', ...leaders, async (c) => {
  try {
    const settings = readSmsSettings();
    const provider = providerSummary();
    return c.json({
      provider: 'error' in provider ? null : provider,
      configError: 'error' in provider ? provider.error : null,
      dryRun: 'error' in provider ? false : !provider.live,
      monthlySegmentCap: settings.monthlySegmentCap,
      liveSegmentsUsed: await liveSegmentsUsed(),
      costPerSegmentUsd: settings.costPerSegmentUsd,
      maxAudienceSize: MAX_AUDIENCE_SIZE,
    });
  } catch (err) {
    console.error('Error loading messaging status:', err);
    return c.json({ error: 'Could not load messaging status.' }, 500);
  }
});

messagingRoutes.post('/messages/preview', ...leaders, createRateLimit({ windowMs: 60_000, max: 30, keyPrefix: 'sms-preview' }), async (c) => {
  try {
    const parsed = validatePreviewBody(await jsonBody(c));
    if (!parsed.ok) return c.json({ error: parsed.error }, 400);

    const settings = readSmsSettings();
    const finalMessage = announcementMessage(parsed.data.message);
    const analysis = analyzeSms(finalMessage);
    const audience = await resolveAudience(db, parsed.data.audience);
    const estimate = estimateCost(audience.recipients.length, analysis.segments, settings);
    const provider = providerSummary();
    const live = !('error' in provider) && provider.live;
    const used = live ? await liveSegmentsUsed() : 0;

    return c.json({
      finalMessage,
      encoding: analysis.encoding,
      characters: analysis.length,
      segmentsPerMessage: analysis.segments,
      tooLong: analysis.segments > MAX_SEGMENTS_PER_MESSAGE,
      recipients: audience.recipients.length,
      tooManyRecipients: audience.recipients.length > MAX_AUDIENCE_SIZE,
      sample: audience.recipients.slice(0, 5).map((r) => ({ name: r.name, phone: maskPhone(r.phone) })),
      skippedInvalidPhone: audience.skippedInvalidPhone,
      skippedOptedOut: audience.skippedOptedOut,
      totalSegments: estimate.totalSegments,
      estimatedCostUsd: estimate.estimatedCostUsd,
      dryRun: 'error' in provider ? false : !provider.live,
      willExceedCap: live && used + estimate.totalSegments > settings.monthlySegmentCap,
    });
  } catch (err) {
    console.error('Error previewing message:', err);
    return c.json({ error: 'Could not prepare the preview.' }, 500);
  }
});

messagingRoutes.post('/messages/send', ...leaders, createRateLimit({ windowMs: 60_000, max: 5, keyPrefix: 'sms-send' }), async (c) => {
  try {
    const actor = c.get('user');
    const parsed = validateSendBody(await jsonBody(c));
    if (!parsed.ok) return c.json({ error: parsed.error }, 400);

    const settings = readSmsSettings();
    const finalMessage = announcementMessage(parsed.data.message);
    const analysis = analyzeSms(finalMessage);
    if (analysis.segments > MAX_SEGMENTS_PER_MESSAGE) {
      return c.json({ error: `That message needs ${analysis.segments} text segments; the limit is ${MAX_SEGMENTS_PER_MESSAGE}. Please shorten it.` }, 400);
    }

    const audience = await resolveAudience(db, parsed.data.audience);
    const recipients = audience.recipients;
    if (recipients.length === 0) return c.json({ error: 'No one in this audience has opted in to texts.' }, 400);
    if (recipients.length > MAX_AUDIENCE_SIZE) {
      return c.json({ error: `That audience has ${recipients.length} people; the limit for one send is ${MAX_AUDIENCE_SIZE}. Choose a smaller group.` }, 400);
    }
    if (parsed.data.confirmRecipients !== recipients.length) {
      return c.json(
        { error: `The audience changed (you confirmed ${parsed.data.confirmRecipients}, it is now ${recipients.length}). Please preview again.`, currentRecipients: recipients.length },
        409,
      );
    }

    const provider = providerSummary();
    if ('error' in provider) return c.json({ error: provider.error }, 503);
    if (provider.live) {
      const used = await liveSegmentsUsed();
      const needed = recipients.length * analysis.segments;
      if (used + needed > settings.monthlySegmentCap) {
        return c.json({ error: `This would use ${needed} segments but only ${Math.max(0, settings.monthlySegmentCap - used)} remain of this month's ${settings.monthlySegmentCap}.` }, 400);
      }
    }

    const batchKey = createHash('sha256')
      .update(JSON.stringify([actor.id, parsed.data.message, parsed.data.audience]))
      .digest('hex');
    if (!claimBatch(batchKey)) {
      return c.json({ error: 'That exact message was just sent to this audience. Wait a couple of minutes before sending it again.' }, 409);
    }

    // Respond now and send in the background: a large send outlasts the client's wait,
    // and a retry after a timeout must never mean everyone is texted twice.
    const deps = defaultSmsDeps();
    void deliverAnnouncement(deps, recipients, parsed.data.message, actor.id).catch((err) =>
      console.error('Announcement delivery crashed:', err),
    );

    await recordAuditLog({
      actor,
      action: 'sms.announcement_started',
      targetType: 'sms_announcement',
      metadata: { recipients: recipients.length, segmentsEach: analysis.segments, audience: parsed.data.audience, dryRun: !provider.live },
    });

    return c.json({ accepted: true, recipients: recipients.length, dryRun: !provider.live }, 202);
  } catch (err) {
    console.error('Error sending announcement:', err);
    return c.json({ error: 'Could not send the message.' }, 500);
  }
});

export async function deliverAnnouncement(
  deps: SmsDeps,
  recipients: Recipient[],
  message: string,
  actorId: string,
): Promise<{ sent: number; dryRun: number; blocked: number; failed: number; stoppedForCap: boolean }> {
  const summary = { sent: 0, dryRun: 0, blocked: 0, failed: 0, stoppedForCap: false };
  const body = announcementMessage(message);

  await pool(recipients, SEND_CONCURRENCY, async (recipient) => {
    const result = await sendSms(deps, {
      to: recipient.phone,
      body,
      purpose: 'announcement',
      recipientUserId: recipient.userId ?? null,
      recipientVisitorId: recipient.visitorId ?? null,
      createdBy: actorId,
    });

    if (result.status === 'sent' || result.status === 'delivered') summary.sent += 1;
    else if (result.status === 'dry_run') summary.dryRun += 1;
    else if (result.status === 'failed') summary.failed += 1;
    else {
      summary.blocked += 1;
      if (result.reason === 'monthly_cap') {
        summary.stoppedForCap = true;
        return false; // stop the pool: every remaining send would be blocked the same way
      }
    }
  });

  console.log(`[sms] announcement finished: ${JSON.stringify(summary)}`);
  return summary;
}

messagingRoutes.post('/messages/test', ...leaders, createRateLimit({ windowMs: 60_000, max: 5, keyPrefix: 'sms-test' }), async (c) => {
  try {
    const actor = c.get('user');
    const body = (await jsonBody(c)) as { message?: unknown } | null;
    const message = validateMessageText(body?.message);
    if (!message.ok) return c.json({ error: message.error }, 400);

    const [me] = await db.select({ phone: users.phone }).from(users).where(eq(users.id, actor.id)).limit(1);
    const phone = normalizePhone(me?.phone ?? '');
    if (!phone.ok) return c.json({ error: 'Add a valid mobile number to your profile to send yourself a test.' }, 400);

    const result = await sendSms(defaultSmsDeps(), {
      to: phone.e164,
      body: announcementMessage(message.data),
      purpose: 'test',
      recipientUserId: actor.id,
      createdBy: actor.id,
    });
    return c.json({ status: result.status, reason: result.reason ?? null, detail: result.detail ?? null, segments: result.segments });
  } catch (err) {
    console.error('Error sending test message:', err);
    return c.json({ error: 'Could not send the test message.' }, 500);
  }
});

messagingRoutes.get('/messages/log', ...leaders, async (c) => {
  try {
    const limit = Math.min(Math.max(parseInt(c.req.query('limit') || '50', 10) || 50, 1), 200);
    const purpose = c.req.query('purpose');
    const rows = await db
      .select({
        id: messageLog.id,
        purpose: messageLog.purpose,
        phone: messageLog.recipientPhone,
        body: messageLog.body,
        segments: messageLog.segments,
        status: messageLog.status,
        provider: messageLog.provider,
        error: messageLog.error,
        createdAt: messageLog.createdAt,
      })
      .from(messageLog)
      .where(purpose ? eq(messageLog.purpose, purpose) : undefined)
      .orderBy(desc(messageLog.createdAt))
      .limit(limit);

    return c.json({ messages: rows.map((row) => ({ ...row, phone: maskPhone(row.phone) })) });
  } catch (err) {
    console.error('Error loading message log:', err);
    return c.json({ error: 'Could not load the message history.' }, 500);
  }
});

// ── Visitors ─────────────────────────────────────────────────────────────────

messagingRoutes.get('/visitors', ...leaders, async (c) => {
  try {
    const search = (c.req.query('search') || '').trim();
    const limit = Math.min(Math.max(parseInt(c.req.query('limit') || '100', 10) || 100, 1), 300);
    const pattern = `%${search.replace(/[\\%_]/g, '\\$&')}%`;

    const rows = await db
      .select()
      .from(visitors)
      .where(search ? or(ilike(visitors.fullName, pattern), ilike(visitors.phone, pattern)) : undefined)
      .orderBy(desc(visitors.lastVisitDate), desc(visitors.createdAt))
      .limit(limit);

    return c.json({ visitors: rows });
  } catch (err) {
    console.error('Error loading visitors:', err);
    return c.json({ error: 'Could not load visitors.' }, 500);
  }
});

messagingRoutes.post('/visitors', ...leaders, createRateLimit({ windowMs: 60_000, max: 40, keyPrefix: 'visitor-create' }), async (c) => {
  try {
    const actor = c.get('user');
    const parsed = validateVisitorBody(await jsonBody(c));
    if (!parsed.ok) return c.json({ error: parsed.error }, 400);

    const result = await registerVisitor(db, defaultSmsDeps(), parsed.data, { today: churchToday(), actorId: actor.id });
    return c.json(result, result.created ? 201 : 200);
  } catch (err) {
    console.error('Error registering visitor:', err);
    return c.json({ error: 'Could not save the visitor.' }, 500);
  }
});

messagingRoutes.put('/visitors/:id', ...leaders, async (c) => {
  try {
    const id = validateUuid(c.req.param('id'), 'id');
    if (!id.ok) return c.json({ error: id.error }, 400);
    const patch = validateVisitorPatch(await jsonBody(c));
    if (!patch.ok) return c.json({ error: patch.error }, 400);

    const [row] = await db.update(visitors).set(patch.data).where(eq(visitors.id, id.data)).returning();
    if (!row) return c.json({ error: 'Visitor not found.' }, 404);
    return c.json({ visitor: row });
  } catch (err) {
    console.error('Error updating visitor:', err);
    return c.json({ error: 'Could not update the visitor.' }, 500);
  }
});

messagingRoutes.post('/visitors/:id/visit', ...leaders, async (c) => {
  try {
    const id = validateUuid(c.req.param('id'), 'id');
    if (!id.ok) return c.json({ error: id.error }, 400);

    const [existing] = await db.select().from(visitors).where(eq(visitors.id, id.data)).limit(1);
    if (!existing) return c.json({ error: 'Visitor not found.' }, 404);

    const visitRecorded = await recordVisit(db, id.data, churchToday());
    const [visitor] = await db.select().from(visitors).where(eq(visitors.id, id.data)).limit(1);
    return c.json({ visitRecorded, visitor });
  } catch (err) {
    console.error('Error recording visit:', err);
    return c.json({ error: 'Could not record the visit.' }, 500);
  }
});

messagingRoutes.post('/visitors/:id/welcome', ...leaders, createRateLimit({ windowMs: 60_000, max: 20, keyPrefix: 'visitor-welcome' }), async (c) => {
  try {
    const actor = c.get('user');
    const id = validateUuid(c.req.param('id'), 'id');
    if (!id.ok) return c.json({ error: id.error }, 400);

    const outcome = await sendVisitorWelcome(db, defaultSmsDeps(), id.data, actor.id);
    if (outcome.status === 'skipped') {
      const messages = {
        not_found: 'Visitor not found.',
        no_consent: 'This visitor has not agreed to receive texts.',
        already_sent: 'A welcome text was already sent to this visitor.',
      } as const;
      return c.json({ error: messages[outcome.reason], reason: outcome.reason }, outcome.reason === 'not_found' ? 404 : 409);
    }
    return c.json(outcome);
  } catch (err) {
    console.error('Error sending welcome text:', err);
    return c.json({ error: 'Could not send the welcome text.' }, 500);
  }
});

// ── A member's own opt-ins ───────────────────────────────────────────────────

messagingRoutes.get('/me/sms-preferences', authMiddleware, async (c) => {
  try {
    return c.json({ preferences: await getSmsPreferences(db, c.get('user').id) });
  } catch (err) {
    console.error('Error loading SMS preferences:', err);
    return c.json({ error: 'Could not load your text message settings.' }, 500);
  }
});

messagingRoutes.put('/me/sms-preferences', authMiddleware, async (c) => {
  try {
    const userId = c.get('user').id;
    const parsed = validateSmsPreferencesBody(await jsonBody(c));
    if (!parsed.ok) return c.json({ error: parsed.error }, 400);

    const current = await getSmsPreferences(db, userId);
    const enablingAnything = Object.values(parsed.data).some(Boolean);
    if (enablingAnything && !current.phoneUsable) {
      return c.json({ error: 'Add a valid mobile number to your profile first, for example 077 123 4567.' }, 400);
    }

    await saveSmsPreferences(db, userId, parsed.data);
    return c.json({ preferences: await getSmsPreferences(db, userId) });
  } catch (err) {
    console.error('Error saving SMS preferences:', err);
    return c.json({ error: 'Could not save your text message settings.' }, 500);
  }
});

// ── Saved announcements (reuse instead of retyping) ──────────────────────────

messagingRoutes.get('/messages/saved', ...leaders, async (c) => {
  try {
    return c.json({ saved: await listSavedAnnouncements(db), limit: MAX_SAVED_ANNOUNCEMENTS });
  } catch (err) {
    console.error('Error loading saved announcements:', err);
    return c.json({ error: 'Could not load saved messages.' }, 500);
  }
});

messagingRoutes.post('/messages/saved', ...leaders, createRateLimit({ windowMs: 60_000, max: 20, keyPrefix: 'sms-saved-create' }), async (c) => {
  try {
    const parsed = validateSavedAnnouncement(await jsonBody(c));
    if (!parsed.ok) return c.json({ error: parsed.error }, 400);

    const saved = await createSavedAnnouncement(db, parsed.data, c.get('user').id);
    if (!saved) return c.json({ error: `You can keep up to ${MAX_SAVED_ANNOUNCEMENTS} saved messages. Delete one first.` }, 400);
    return c.json({ saved }, 201);
  } catch (err) {
    console.error('Error saving announcement:', err);
    return c.json({ error: 'Could not save the message.' }, 500);
  }
});

messagingRoutes.delete('/messages/saved/:id', ...leaders, async (c) => {
  try {
    const id = validateUuid(c.req.param('id'), 'id');
    if (!id.ok) return c.json({ error: id.error }, 400);

    if (!(await deleteSavedAnnouncement(db, id.data))) return c.json({ error: 'Saved message not found.' }, 404);
    return c.json({ ok: true });
  } catch (err) {
    console.error('Error deleting saved announcement:', err);
    return c.json({ error: 'Could not delete the message.' }, 500);
  }
});

// ── Editable wording for the standing texts ──────────────────────────────────

messagingRoutes.get('/messages/templates', ...leaders, async (c) => {
  try {
    return c.json({ templates: await listTemplates(db) });
  } catch (err) {
    console.error('Error loading message templates:', err);
    return c.json({ error: 'Could not load the message wording.' }, 500);
  }
});

// Lets the editor show the finished text, length and cost as the leader types. Saves nothing.
messagingRoutes.post('/messages/templates/preview', ...leaders, createRateLimit({ windowMs: 60_000, max: 90, keyPrefix: 'sms-template-preview' }), async (c) => {
  try {
    const input = (await jsonBody(c)) as { key?: unknown; body?: unknown } | null;
    if (!input || !isTemplateKey(input.key)) return c.json({ error: 'Unknown message.' }, 400);

    const checked = checkTemplateBody(input.key, input.body);
    if (!checked.ok) return c.json({ valid: false, error: checked.error });

    const view = buildTemplateView(input.key, { body: checked.body, updatedAt: new Date() });
    const settings = readSmsSettings();
    return c.json({
      valid: true,
      body: checked.body,
      preview: view.preview,
      costPerMessageUsd: settings.costPerSegmentUsd === null ? null : Number((settings.costPerSegmentUsd * view.preview.segments).toFixed(4)),
    });
  } catch (err) {
    console.error('Error previewing message wording:', err);
    return c.json({ error: 'Could not prepare the preview.' }, 500);
  }
});

messagingRoutes.put('/messages/templates/:key', ...leaders, createRateLimit({ windowMs: 60_000, max: 20, keyPrefix: 'sms-template-save' }), async (c) => {
  try {
    const key = c.req.param('key');
    if (!isTemplateKey(key)) return c.json({ error: 'Unknown message.' }, 404);

    const input = (await jsonBody(c)) as { body?: unknown } | null;
    const checked = checkTemplateBody(key, input?.body);
    if (!checked.ok) return c.json({ error: checked.error }, 400);

    const actor = c.get('user');
    const template = await saveTemplate(db, key, checked.body, actor.id);
    await recordAuditLog({ actor, action: 'sms.template_updated', targetType: 'sms_template', targetId: key, metadata: { key } });
    return c.json({ template });
  } catch (err) {
    console.error('Error saving message wording:', err);
    return c.json({ error: 'Could not save the wording.' }, 500);
  }
});

messagingRoutes.delete('/messages/templates/:key', ...leaders, async (c) => {
  try {
    const key = c.req.param('key');
    if (!isTemplateKey(key)) return c.json({ error: 'Unknown message.' }, 404);

    const actor = c.get('user');
    const template = await resetTemplate(db, key);
    await recordAuditLog({ actor, action: 'sms.template_reset', targetType: 'sms_template', targetId: key, metadata: { key } });
    return c.json({ template });
  } catch (err) {
    console.error('Error resetting message wording:', err);
    return c.json({ error: 'Could not reset the wording.' }, 500);
  }
});

// ── Provider webhooks (no login: authenticated by the provider's signature) ───

type WebhookCheck = { ok: true; params: Record<string, string> } | { ok: false; status: 403 | 404 | 503; error: string };

async function checkTwilioWebhook(c: { req: { parseBody: () => Promise<Record<string, unknown>>; header: (n: string) => string | undefined } }, path: string): Promise<WebhookCheck> {
  if ((process.env.SMS_PROVIDER || '').trim().toLowerCase() !== 'twilio') {
    return { ok: false, status: 404, error: 'Not enabled.' };
  }
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
  const publicUrl = process.env.PUBLIC_API_URL?.trim().replace(/\/+$/, '');
  if (!authToken || !publicUrl) {
    // Refuse rather than accept unverified requests.
    return { ok: false, status: 503, error: 'Webhook is not configured.' };
  }

  const raw = await c.req.parseBody();
  const params: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) if (typeof value === 'string') params[key] = value;

  const valid = isValidTwilioSignature({
    authToken,
    url: `${publicUrl}${path}`,
    params,
    signature: c.req.header('x-twilio-signature'),
  });
  return valid ? { ok: true, params } : { ok: false, status: 403, error: 'Invalid signature.' };
}

const EMPTY_TWIML = '<?xml version="1.0" encoding="UTF-8"?><Response></Response>';

messagingRoutes.post('/webhooks/sms/twilio/inbound', async (c) => {
  try {
    const check = await checkTwilioWebhook(c, '/webhooks/sms/twilio/inbound');
    if (!check.ok) return c.json({ error: check.error }, check.status);

    const from = normalizePhone(check.params.From ?? '');
    const keyword = classifyInboundKeyword(check.params.Body);
    if (from.ok && keyword === 'stop') await recordOptOut(db, from.e164, 'stop_keyword');
    if (from.ok && keyword === 'start') await clearOptOut(db, from.e164);

    return c.body(EMPTY_TWIML, 200, { 'Content-Type': 'text/xml' });
  } catch (err) {
    console.error('Error handling inbound SMS:', err);
    return c.json({ error: 'Could not process the message.' }, 500);
  }
});

messagingRoutes.post('/webhooks/sms/twilio/status', async (c) => {
  try {
    const check = await checkTwilioWebhook(c, '/webhooks/sms/twilio/status');
    if (!check.ok) return c.json({ error: check.error }, check.status);

    const { MessageSid, MessageStatus, ErrorCode } = check.params;
    if (MessageSid && MessageStatus) await applyDeliveryStatus(db, MessageSid, MessageStatus, ErrorCode);
    return c.body(EMPTY_TWIML, 200, { 'Content-Type': 'text/xml' });
  } catch (err) {
    console.error('Error handling SMS status callback:', err);
    return c.json({ error: 'Could not process the status.' }, 500);
  }
});
