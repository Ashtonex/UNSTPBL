import { createHmac } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import type { LogEntry, SmsDeps } from '../lib/sms/service.js';

const resolveAuth = vi.fn();
const resolveAudience = vi.fn();
const registerVisitor = vi.fn();
const recordVisit = vi.fn();
const sendVisitorWelcome = vi.fn();
const getSmsPreferences = vi.fn();
const saveSmsPreferences = vi.fn();
const recordOptOut = vi.fn();
const clearOptOut = vi.fn();
const applyDeliveryStatus = vi.fn();
const recordAuditLog = vi.fn();
const liveSegmentsSentSince = vi.fn();
const listTemplates = vi.fn();
const saveTemplate = vi.fn();
const resetTemplate = vi.fn();
const log: LogEntry[] = [];

vi.mock('../lib/db.js', () => ({ db: {} }));
vi.mock('../lib/authCache.js', () => ({ resolveAuth }));
vi.mock('../lib/audit.js', () => ({ recordAuditLog }));
vi.mock('./verses.js', () => ({ churchToday: () => '2026-10-11' }));
vi.mock('../lib/sms/audience.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/sms/audience.js')>()),
  resolveAudience,
}));
vi.mock('../lib/sms/templateStore.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/sms/templateStore.js')>()),
  listTemplates,
  saveTemplate,
  resetTemplate,
}));
vi.mock('../lib/sms/visitors.js', () => ({ registerVisitor, recordVisit, sendVisitorWelcome }));
vi.mock('../lib/sms/memberMessages.js', () => ({ getSmsPreferences, saveSmsPreferences }));
vi.mock('../lib/sms/optOut.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/sms/optOut.js')>()),
  recordOptOut,
  clearOptOut,
  applyDeliveryStatus,
}));
vi.mock('../lib/sms/store.js', () => ({
  createDbStore: () => ({ liveSegmentsSentSince }),
  defaultSmsDeps: (): SmsDeps => ({
    store: {
      isOptedOut: async () => false,
      liveSegmentsSentSince: async () => 0,
      insertLog: async (entry) => void log.push(entry),
    },
    getProvider: () => ({ name: 'dryrun', live: false, send: async () => ({ providerMessageId: 'd1', status: 'dry_run' as const }) }),
    settings: { monthlySegmentCap: 100, costPerSegmentUsd: 0.1 },
  }),
}));

const { messagingRoutes, resetBatchGuardForTests, deliverAnnouncement } = await import('./messaging.js');
const { resetRateLimitBuckets } = await import('../middleware/rateLimit.js');

const app = new Hono();
app.route('/', messagingRoutes);

const asRole = (role: string) =>
  resolveAuth.mockResolvedValue({ id: 'user-1', email: 'u@example.org', role, translation: 'KJV' });

const call = (method: string, path: string, body?: unknown, headers: Record<string, string> = {}) =>
  app.request(path, {
    method,
    headers: { Authorization: 'Bearer test-token', 'Content-Type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

const UUID = '3f2b8c1e-9d4a-4e6f-8a1b-2c3d4e5f6a7b';

beforeEach(() => {
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SERVICE_KEY = 'service-key';
  delete process.env.SMS_PROVIDER;
  delete process.env.TWILIO_AUTH_TOKEN;
  delete process.env.PUBLIC_API_URL;
  log.length = 0;
  vi.clearAllMocks();
  resetBatchGuardForTests();
  resetRateLimitBuckets();
  liveSegmentsSentSince.mockResolvedValue(0);
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const GUARDED: Array<[string, string]> = [
  ['GET', '/messages/status'],
  ['POST', '/messages/preview'],
  ['POST', '/messages/send'],
  ['POST', '/messages/test'],
  ['GET', '/messages/log'],
  ['GET', '/messages/templates'],
  ['POST', '/messages/templates/preview'],
  ['PUT', '/messages/templates/birthday'],
  ['DELETE', '/messages/templates/birthday'],
  ['GET', '/visitors'],
  ['POST', '/visitors'],
  ['PUT', `/visitors/${UUID}`],
  ['POST', `/visitors/${UUID}/visit`],
  ['POST', `/visitors/${UUID}/welcome`],
];

describe('access control', () => {
  it.each([...GUARDED, ['GET', '/me/sms-preferences'], ['PUT', '/me/sms-preferences']])(
    '%s %s needs a login',
    async (method, path) => {
      const res = await app.request(path, { method });
      expect(res.status).toBe(401);
    },
  );

  it.each(GUARDED)('%s %s is closed to ordinary members', async (method, path) => {
    asRole('member');
    const res = await call(method, path, method === 'GET' ? undefined : {});
    expect(res.status).toBe(403);
  });

  it('lets a member manage their own text preferences', async () => {
    asRole('member');
    getSmsPreferences.mockResolvedValue({ announcements: false, dailyVerse: false, birthday: false, phone: null, phoneUsable: false, optedOut: false });
    const res = await call('GET', '/me/sms-preferences');
    expect(res.status).toBe(200);
  });
});

describe('visitors', () => {
  beforeEach(() => asRole('bishop'));

  it.each([
    [{ phone: '0771234567' }, 'name'],
    [{ fullName: 'Grace', phone: '0202123456' }, 'mobile'],
    [{ fullName: 'Grace', phone: '0771234567', email: 'not-an-email' }, 'email'],
    [{ fullName: 'Grace', phone: '0771234567', smsConsent: 'yes' }, 'smsConsent'],
  ])('rejects %j', async (body, hint) => {
    const res = await call('POST', '/visitors', body);
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error.toLowerCase()).toContain(hint.toLowerCase());
    expect(registerVisitor).not.toHaveBeenCalled();
  });

  it('registers a visitor with a normalised number, 201 for new and 200 for returning', async () => {
    registerVisitor.mockResolvedValueOnce({ visitor: { id: UUID }, created: true, visitRecorded: true, welcome: { status: 'dry_run' } });
    const created = await call('POST', '/visitors', { fullName: ' Grace Moyo ', phone: '077 123 4567', smsConsent: true });
    expect(created.status).toBe(201);
    expect(registerVisitor.mock.calls[0][2]).toMatchObject({ fullName: 'Grace Moyo', phone: '+263771234567', smsConsent: true });
    expect(registerVisitor.mock.calls[0][3]).toEqual({ today: '2026-10-11', actorId: 'user-1' });

    registerVisitor.mockResolvedValueOnce({ visitor: { id: UUID }, created: false, visitRecorded: false, welcome: { status: 'skipped', reason: 'already_sent' } });
    const again = await call('POST', '/visitors', { fullName: 'Grace Moyo', phone: '0771234567' });
    expect(again.status).toBe(200);
  });

  it('does not treat a missing consent flag as consent', async () => {
    registerVisitor.mockResolvedValue({ visitor: {}, created: true, visitRecorded: true, welcome: { status: 'skipped', reason: 'no_consent' } });
    await call('POST', '/visitors', { fullName: 'Grace', phone: '0771234567' });
    expect(registerVisitor.mock.calls[0][2].smsConsent).toBe(false);
  });

  it('refuses a welcome text that was already sent or lacks consent, with a clear reason', async () => {
    sendVisitorWelcome.mockResolvedValueOnce({ status: 'skipped', reason: 'already_sent' });
    const res = await call('POST', `/visitors/${UUID}/welcome`);
    expect(res.status).toBe(409);
    expect(((await res.json()) as { reason: string }).reason).toBe('already_sent');

    sendVisitorWelcome.mockResolvedValueOnce({ status: 'skipped', reason: 'not_found' });
    expect((await call('POST', `/visitors/${UUID}/welcome`)).status).toBe(404);
  });

  it('rejects a malformed visitor id', async () => {
    expect((await call('POST', '/visitors/not-a-uuid/welcome')).status).toBe(400);
    expect((await call('PUT', '/visitors/not-a-uuid', { notes: 'x' })).status).toBe(400);
  });
});

describe('announcements', () => {
  beforeEach(() => asRole('bishop'));

  const audience = { type: 'all_members' } as const;
  const twoRecipients = {
    recipients: [
      { phone: '+263771111111', name: 'A', userId: 'a' },
      { phone: '+263772222222', name: 'B', userId: 'b' },
    ],
    skippedInvalidPhone: 1,
    skippedOptedOut: 0,
  };
  const send = (over: Record<string, unknown> = {}) =>
    call('POST', '/messages/send', { message: 'Service moves to 9am this Sunday.', audience, confirmRecipients: 2, ...over });

  it('previews who would receive it, what it costs, and masks the numbers', async () => {
    resolveAudience.mockResolvedValue(twoRecipients);
    const res = await call('POST', '/messages/preview', { message: 'Service moves to 9am.', audience });
    const body = (await res.json()) as Record<string, any>;

    expect(res.status).toBe(200);
    expect(body.recipients).toBe(2);
    expect(body.segmentsPerMessage).toBe(1);
    expect(body.totalSegments).toBe(2);
    expect(body.finalMessage).toMatch(/^Service moves to 9am\. - .*Reply STOP to opt out\.$/);
    expect(body.skippedInvalidPhone).toBe(1);
    expect(body.dryRun).toBe(true);
    expect(JSON.stringify(body.sample)).not.toContain('771111111');
  });

  it.each([
    [{ message: '' }, 'message'],
    [{ message: 'x'.repeat(321) }, '320'],
    [{ audience: { type: 'everyone' } }, 'audience'],
    [{ audience: { type: 'circle', circleId: 'nope' } }, 'circleId'],
    [{ confirmRecipients: 0 }, 'confirm'],
    [{ confirmRecipients: undefined }, 'confirm'],
  ])('rejects an invalid send %j', async (over, hint) => {
    const res = await send(over);
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error.toLowerCase()).toContain(hint.toLowerCase());
  });

  it('will not send to an audience that has nobody opted in', async () => {
    resolveAudience.mockResolvedValue({ recipients: [], skippedInvalidPhone: 0, skippedOptedOut: 0 });
    expect((await send()).status).toBe(400);
  });

  it('will not send to an audience larger than the per-send limit', async () => {
    resolveAudience.mockResolvedValue({
      recipients: Array.from({ length: 501 }, (_, i) => ({ phone: `+2637711${String(i).padStart(5, '0')}`, name: null })),
      skippedInvalidPhone: 0,
      skippedOptedOut: 0,
    });
    const res = await send({ confirmRecipients: 501 });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toContain('500');
  });

  it('refuses when the audience changed since the preview', async () => {
    resolveAudience.mockResolvedValue(twoRecipients);
    const res = await send({ confirmRecipients: 7 });
    expect(res.status).toBe(409);
    expect(((await res.json()) as { currentRecipients: number }).currentRecipients).toBe(2);
  });

  it('accepts a valid send immediately (202), delivers in the background and audits it', async () => {
    resolveAudience.mockResolvedValue(twoRecipients);
    const res = await send();
    expect(res.status).toBe(202);
    expect(await res.json()).toEqual({ accepted: true, recipients: 2, dryRun: true });
    expect(recordAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: 'sms.announcement_started' }));

    await vi.waitFor(() => expect(log).toHaveLength(2));
    expect(log.every((entry) => entry.purpose === 'announcement' && entry.status === 'dry_run')).toBe(true);
  });

  it('blocks an identical resend within the guard window, so a retry cannot text everyone twice', async () => {
    resolveAudience.mockResolvedValue(twoRecipients);
    expect((await send()).status).toBe(202);
    const second = await send();
    expect(second.status).toBe(409);
    expect(((await second.json()) as { error: string }).error).toContain('just sent');

    // A different message is a different send.
    expect((await send({ message: 'A different notice.' })).status).toBe(202);
  });

  it('refuses a live send that would exceed the monthly cap before sending anything', async () => {
    process.env.SMS_PROVIDER = 'twilio';
    process.env.TWILIO_ACCOUNT_SID = 'AC1';
    process.env.TWILIO_AUTH_TOKEN = 't';
    process.env.TWILIO_MESSAGING_SERVICE_SID = 'MG1';
    process.env.SMS_MONTHLY_SEGMENT_CAP = '10';
    liveSegmentsSentSince.mockResolvedValue(9); // 2 messages x 1 segment would need 2, only 1 left
    resolveAudience.mockResolvedValue(twoRecipients);
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const res = await send();
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toContain('1 remain');
    expect(fetchSpy).not.toHaveBeenCalled();
    delete process.env.SMS_MONTHLY_SEGMENT_CAP;
  });

  it('reports a misconfigured provider instead of pretending to send', async () => {
    process.env.SMS_PROVIDER = 'twilio'; // no credentials
    delete process.env.TWILIO_ACCOUNT_SID;
    delete process.env.TWILIO_AUTH_TOKEN;
    resolveAudience.mockResolvedValue(twoRecipients);
    const res = await send();
    expect(res.status).toBe(503);
    expect(((await res.json()) as { error: string }).error).toContain('TWILIO_ACCOUNT_SID');
  });
});

describe('deliverAnnouncement', () => {
  it('stops at once when the cap is hit instead of logging a block per person', async () => {
    const entries: LogEntry[] = [];
    let calls = 0;
    const deps: SmsDeps = {
      store: {
        isOptedOut: async () => false,
        liveSegmentsSentSince: async () => 100, // already at the cap
        insertLog: async (entry) => void entries.push(entry),
      },
      getProvider: () => ({ name: 'twilio', live: true, send: async () => (calls++, { providerMessageId: 'x', status: 'sent' as const }) }),
      settings: { monthlySegmentCap: 100, costPerSegmentUsd: null },
    };
    const recipients = Array.from({ length: 40 }, (_, i) => ({ phone: `+2637711${String(i).padStart(5, '0')}`, name: null }));

    const summary = await deliverAnnouncement(deps, recipients, 'Notice', 'bishop-1');

    expect(summary.stoppedForCap).toBe(true);
    expect(calls).toBe(0);
    expect(entries.length).toBeLessThan(40); // the pool halts; it does not log all 40
  });
});

describe('provider webhooks', () => {
  const authToken = 'webhook-token';
  const publicUrl = 'https://api.example.org';
  const sign = (path: string, params: Record<string, string>) =>
    createHmac('sha1', authToken)
      .update(
        publicUrl +
          path +
          Object.keys(params)
            .sort()
            .map((k) => k + params[k])
            .join(''),
      )
      .digest('base64');

  const hook = (path: string, params: Record<string, string>, signature?: string) =>
    app.request(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...(signature ? { 'x-twilio-signature': signature } : {}) },
      body: new URLSearchParams(params).toString(),
    });

  const enableTwilio = () => {
    process.env.SMS_PROVIDER = 'twilio';
    process.env.TWILIO_AUTH_TOKEN = authToken;
    process.env.PUBLIC_API_URL = publicUrl;
  };

  it('is switched off unless Twilio is the configured provider', async () => {
    expect((await hook('/webhooks/sms/twilio/inbound', { From: '+263771234567', Body: 'STOP' })).status).toBe(404);
  });

  it('refuses to accept unverified requests when it cannot verify them', async () => {
    process.env.SMS_PROVIDER = 'twilio'; // no token / public url
    expect((await hook('/webhooks/sms/twilio/inbound', { From: '+263771234567', Body: 'STOP' })).status).toBe(503);
  });

  it('rejects a missing or forged signature and changes nothing', async () => {
    enableTwilio();
    const params = { From: '+263771234567', Body: 'STOP' };
    expect((await hook('/webhooks/sms/twilio/inbound', params)).status).toBe(403);
    expect((await hook('/webhooks/sms/twilio/inbound', params, 'forged')).status).toBe(403);
    expect((await hook('/webhooks/sms/twilio/inbound', { ...params, Body: 'START' }, sign('/webhooks/sms/twilio/inbound', params))).status).toBe(403);
    expect(recordOptOut).not.toHaveBeenCalled();
    expect(clearOptOut).not.toHaveBeenCalled();
  });

  it('records an opt-out when a correctly signed STOP arrives, and answers with empty TwiML', async () => {
    enableTwilio();
    const params = { From: '0771234567', Body: ' Stop. ' };
    const res = await hook('/webhooks/sms/twilio/inbound', params, sign('/webhooks/sms/twilio/inbound', params));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/xml');
    expect(await res.text()).toContain('<Response></Response>');
    expect(recordOptOut.mock.calls[0][1]).toBe('+263771234567');
  });

  it('resumes texts on START, and ignores ordinary replies', async () => {
    enableTwilio();
    const start = { From: '+263771234567', Body: 'START' };
    await hook('/webhooks/sms/twilio/inbound', start, sign('/webhooks/sms/twilio/inbound', start));
    expect(clearOptOut).toHaveBeenCalledWith(expect.anything(), '+263771234567');

    const chat = { From: '+263771234567', Body: "Yes, I'll be there" };
    await hook('/webhooks/sms/twilio/inbound', chat, sign('/webhooks/sms/twilio/inbound', chat));
    expect(recordOptOut).not.toHaveBeenCalled();
  });

  it('applies delivery receipts from a correctly signed status callback', async () => {
    enableTwilio();
    const params = { MessageSid: 'SM123', MessageStatus: 'delivered' };
    const res = await hook('/webhooks/sms/twilio/status', params, sign('/webhooks/sms/twilio/status', params));
    expect(res.status).toBe(200);
    expect(applyDeliveryStatus).toHaveBeenCalledWith(expect.anything(), 'SM123', 'delivered', undefined);
  });
});

describe('member text preferences', () => {
  beforeEach(() => asRole('member'));
  const view = (over = {}) => ({ announcements: false, dailyVerse: false, birthday: false, phone: '0771234567', phoneUsable: true, optedOut: false, ...over });

  it('will not switch anything on without a usable mobile number', async () => {
    getSmsPreferences.mockResolvedValue(view({ phone: null, phoneUsable: false }));
    const res = await call('PUT', '/me/sms-preferences', { announcements: true, dailyVerse: false, birthday: false });
    expect(res.status).toBe(400);
    expect(saveSmsPreferences).not.toHaveBeenCalled();
  });

  it('lets a member turn everything off even with no number', async () => {
    getSmsPreferences.mockResolvedValue(view({ phone: null, phoneUsable: false }));
    const res = await call('PUT', '/me/sms-preferences', { announcements: false, dailyVerse: false, birthday: false });
    expect(res.status).toBe(200);
    expect(saveSmsPreferences).toHaveBeenCalled();
  });

  it('saves valid preferences for the signed-in member only', async () => {
    getSmsPreferences.mockResolvedValue(view());
    await call('PUT', '/me/sms-preferences', { announcements: true, dailyVerse: true, birthday: false });
    expect(saveSmsPreferences).toHaveBeenCalledWith(expect.anything(), 'user-1', { announcements: true, dailyVerse: true, birthday: false });
  });

  it('rejects incomplete or non-boolean preferences', async () => {
    expect((await call('PUT', '/me/sms-preferences', { announcements: true })).status).toBe(400);
    expect((await call('PUT', '/me/sms-preferences', { announcements: 'yes', dailyVerse: false, birthday: false })).status).toBe(400);
  });
});

describe('editable message wording', () => {
  const view = { key: 'visitor_welcome', body: 'Hi {first_name}!', isCustom: true };

  it('lists the templates for leaders', async () => {
    asRole('bishop');
    listTemplates.mockResolvedValue([view]);
    const res = await call('GET', '/messages/templates');
    expect(res.status).toBe(200);
    expect(((await res.json()) as { templates: unknown[] }).templates).toHaveLength(1);
  });

  it('previews wording without saving anything', async () => {
    asRole('admin');
    const res = await call('POST', '/messages/templates/preview', { key: 'visitor_welcome', body: 'Hi {first_name}, welcome!' });
    const json = (await res.json()) as { valid: boolean; preview: { text: string; segments: number } };
    expect(res.status).toBe(200);
    expect(json.valid).toBe(true);
    expect(json.preview.text).toContain('Hi Grace, welcome!');
    expect(json.preview.text.endsWith('Reply STOP to opt out.')).toBe(true);
    expect(saveTemplate).not.toHaveBeenCalled();
  });

  it('explains what is wrong with bad wording instead of failing', async () => {
    asRole('bishop');
    const res = await call('POST', '/messages/templates/preview', { key: 'daily_verse', body: 'No verse here' });
    const json = (await res.json()) as { valid: boolean; error: string };
    expect(json.valid).toBe(false);
    expect(json.error).toContain('{verse}');
  });

  it('saves cleaned wording, records who changed it, and audits it', async () => {
    asRole('bishop');
    saveTemplate.mockResolvedValue(view);
    const res = await call('PUT', '/messages/templates/visitor_welcome', { body: '  Hi {first_name}!  Reply STOP to opt out.' });
    expect(res.status).toBe(200);
    expect(saveTemplate).toHaveBeenCalledWith({}, 'visitor_welcome', 'Hi {first_name}!', 'user-1');
    expect(recordAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: 'sms.template_updated', targetId: 'visitor_welcome' }));
  });

  it('refuses to save invalid wording', async () => {
    asRole('bishop');
    const res = await call('PUT', '/messages/templates/daily_verse', { body: 'No verse here' });
    expect(res.status).toBe(400);
    expect(saveTemplate).not.toHaveBeenCalled();
  });

  it('404s for an unknown message and resets a known one', async () => {
    asRole('bishop');
    expect((await call('PUT', '/messages/templates/nonsense', { body: 'x' })).status).toBe(404);
    expect((await call('DELETE', '/messages/templates/nonsense')).status).toBe(404);

    resetTemplate.mockResolvedValue({ ...view, isCustom: false });
    const res = await call('DELETE', '/messages/templates/visitor_welcome');
    expect(res.status).toBe(200);
    expect(resetTemplate).toHaveBeenCalledWith({}, 'visitor_welcome');
    expect(recordAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: 'sms.template_reset' }));
  });
});
