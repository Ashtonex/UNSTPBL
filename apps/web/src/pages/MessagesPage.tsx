import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type MessageAudience, type MessageLogEntry, type MessagePreview } from '../lib/api';
import { can } from '@unstpbl/shared';
import SmsModeBanner from '../components/SmsModeBanner';
import { useAuthStore } from '../stores/auth';

const FIELD =
  'w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-brand-500 focus:outline-none';

const MAX_LENGTH = 320;

type AudienceType = MessageAudience['type'];

const AUDIENCE_LABEL: Record<AudienceType, string> = {
  all_members: 'All members who opted in to announcements',
  leaders: 'Church leaders: pastors, communications, bishops, admins (who opted in)',
  visitors: 'Visitors who agreed to texts',
  congregation: 'One congregation',
  circle: 'One home circle',
};

const STATUS_STYLE: Record<MessageLogEntry['status'], string> = {
  sent: 'bg-emerald-500/15 text-emerald-300',
  delivered: 'bg-emerald-500/20 text-emerald-200',
  dry_run: 'bg-amber-500/15 text-amber-300',
  blocked: 'bg-white/10 text-white/50',
  failed: 'bg-rose-500/15 text-rose-300',
};

const STATUS_LABEL: Record<MessageLogEntry['status'], string> = {
  sent: 'Sent',
  delivered: 'Delivered',
  dry_run: 'Test mode',
  blocked: 'Blocked',
  failed: 'Failed',
};

const PURPOSE_LABEL: Record<string, string> = {
  visitor_welcome: 'Visitor welcome',
  birthday: 'Birthday',
  announcement: 'Announcement',
  daily_verse: 'Daily verse',
  test: 'Test',
};

// Starting points a leader can tap and then edit. Anything in [brackets] must be filled in first.
const STARTER_IDEAS: Array<{ title: string; body: string }> = [
  { title: 'Service time change', body: 'Please note: this Sunday\'s service will start at [time]. See you there!' },
  { title: 'Prayer meeting', body: 'Join us for prayer on [day] at [time] at [place]. Come expecting God to move.' },
  { title: 'Special event', body: 'You are invited to [event] on [date] at [time]. Bring a friend!' },
  { title: 'Encouragement', body: 'Be encouraged this week: God is faithful and He is with you. Stay strong in the Lord.' },
];

const hasUnfilledBlank = (text: string) => /\[[^\]]+\]/.test(text);

const cleanError = (err: Error) => err.message.replace(/^API error: \d+ – /, '');

const formatTime = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

// Pastors may text a congregation, a home circle or guests; only communications, bishops and admins may text everyone.
const PASTOR_AUDIENCES: AudienceType[] = ['visitors', 'congregation', 'circle'];

export default function MessagesPage() {
  const queryClient = useQueryClient();
  const role = useAuthStore((state) => state.profile?.role);
  const textsEveryone = can(role, 'messages.sendToAll');
  const audienceChoices = (Object.keys(AUDIENCE_LABEL) as AudienceType[]).filter((type) => textsEveryone || PASTOR_AUDIENCES.includes(type));
  const [message, setMessage] = useState('');
  const [audienceType, setAudienceType] = useState<AudienceType>(textsEveryone ? 'all_members' : 'visitors');
  const [congregation, setCongregation] = useState('');
  const [circleId, setCircleId] = useState('');
  const [preview, setPreview] = useState<MessagePreview | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [feedback, setFeedback] = useState<{ text: string; good: boolean } | null>(null);

  const circles = useQuery({ queryKey: ['circles'], queryFn: api.getCircles, enabled: audienceType === 'circle' });
  const saved = useQuery({ queryKey: ['saved-messages'], queryFn: api.getSavedMessages, retry: false });
  const [saveTitle, setSaveTitle] = useState<string | null>(null);
  const log = useQuery({ queryKey: ['message-log'], queryFn: api.getMessageLog, refetchInterval: 15_000 });

  const audience: MessageAudience | null =
    audienceType === 'congregation'
      ? congregation.trim()
        ? { type: 'congregation', congregation: congregation.trim() }
        : null
      : audienceType === 'circle'
        ? circleId
          ? { type: 'circle', circleId }
          : null
        : { type: audienceType };

  // Anything that changes what would be sent invalidates the preview the leader confirmed.
  const resetPreview = () => {
    setPreview(null);
    setConfirmed(false);
    setFeedback(null);
  };

  const previewMutation = useMutation({
    mutationFn: () => api.previewMessage(message, audience!),
    onSuccess: (result) => {
      setPreview(result);
      setConfirmed(false);
      setFeedback(null);
    },
    onError: (err: Error) => setFeedback({ good: false, text: cleanError(err) }),
  });

  const saveMutation = useMutation({
    mutationFn: (title: string) => api.saveMessage(title, message),
    onSuccess: () => {
      setSaveTitle(null);
      setFeedback({ good: true, text: 'Saved. Find it under "Start from" next time.' });
      queryClient.invalidateQueries({ queryKey: ['saved-messages'] });
    },
    onError: (err: Error) => setFeedback({ good: false, text: cleanError(err) }),
  });

  const deleteSavedMutation = useMutation({
    mutationFn: (id: string) => api.deleteSavedMessage(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['saved-messages'] }),
    onError: (err: Error) => setFeedback({ good: false, text: cleanError(err) }),
  });

  const useText = (body: string) => {
    setMessage(body);
    setSaveTitle(null);
    resetPreview();
  };

  const testMutation = useMutation({
    mutationFn: () => api.sendTestMessage(message),
    onSuccess: (result) => {
      setFeedback({
        good: result.status === 'sent' || result.status === 'dry_run',
        text:
          result.status === 'dry_run'
            ? 'Test mode: the test text was recorded, not sent.'
            : result.status === 'sent'
              ? 'Test text sent to your own phone.'
              : `Test text not sent${result.detail ? `: ${result.detail}` : '.'}`,
      });
      queryClient.invalidateQueries({ queryKey: ['message-log'] });
      queryClient.invalidateQueries({ queryKey: ['messaging-status'] });
    },
    onError: (err: Error) => setFeedback({ good: false, text: cleanError(err) }),
  });

  const sendMutation = useMutation({
    mutationFn: () => api.sendMessage(message, audience!, preview!.recipients),
    onSuccess: (result) => {
      setFeedback({
        good: true,
        text: result.dryRun
          ? `Test mode: ${result.recipients} texts are being recorded (none are really sent).`
          : `Sending ${result.recipients} texts now. Watch the history below for delivery.`,
      });
      setMessage('');
      setPreview(null);
      setConfirmed(false);
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['message-log'] });
        queryClient.invalidateQueries({ queryKey: ['messaging-status'] });
      }, 1500);
    },
    onError: (err: Error) => {
      setFeedback({ good: false, text: cleanError(err) });
      setConfirmed(false);
    },
  });

  const blank = hasUnfilledBlank(message);
  const canPreview = message.trim().length > 0 && message.length <= MAX_LENGTH && audience !== null && !blank;
  const blockers = preview
    ? [
        preview.tooLong && 'This message is too long once the opt-out line is added. Please shorten it.',
        preview.tooManyRecipients && 'That audience is larger than one send allows. Choose a smaller group.',
        preview.willExceedCap && "This would go over this month's text limit.",
        preview.recipients === 0 && 'No one in this audience has opted in to texts yet.',
      ].filter(Boolean)
    : [];

  return (
    <div className="w-full max-w-lg mx-auto py-4 animate-fade-in space-y-5">
      <section>
        <h2 className="text-2xl font-bold text-white mb-1">Text messages</h2>
        <p className="text-white/40 text-sm">Send an announcement to members or visitors who agreed to hear from the church.</p>
        {can(role, 'messages.wording') && (
          <Link to="/messages/wording" className="inline-block mt-2 text-xs text-brand-300 hover:text-brand-200">
            Change what the thank-you, birthday and daily verse texts say &rarr;
          </Link>
        )}
      </section>

      <SmsModeBanner />

      <section className="glass-card p-5 space-y-3">
        <h3 className="text-sm font-bold text-white">Write a message</h3>

        <div>
          <textarea
            className={`${FIELD} resize-none`}
            rows={4}
            maxLength={MAX_LENGTH}
            placeholder="e.g. Sunday service moves to 9am this week."
            value={message}
            onChange={(e) => {
              setMessage(e.target.value);
              resetPreview();
            }}
          />
          <p className="text-[11px] text-white/35 mt-1 text-right">
            {message.length}/{MAX_LENGTH} · the church name and an opt-out line are added automatically
          </p>
          {blank && <p className="text-[11px] text-amber-300 mt-1">Fill in the [bracketed] parts before sending.</p>}
        </div>

        <div className="space-y-2">
          <p className="text-[11px] uppercase tracking-wider text-white/30">Start from</p>
          <div className="flex flex-wrap gap-2">
            {STARTER_IDEAS.map((idea) => (
              <button
                key={idea.title}
                type="button"
                onClick={() => useText(idea.body)}
                className="px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-white/70 hover:bg-white/10"
              >
                {idea.title}
              </button>
            ))}
            {(saved.data?.saved ?? []).map((item) => (
              <span key={item.id} className="inline-flex items-center rounded-lg bg-brand-500/10 border border-brand-500/25 text-xs text-brand-200">
                <button type="button" onClick={() => useText(item.body)} title={item.body} className="pl-2.5 pr-1.5 py-1.5 hover:text-white">
                  {item.title}
                </button>
                <button
                  type="button"
                  aria-label={`Delete saved message ${item.title}`}
                  disabled={deleteSavedMutation.isPending}
                  onClick={() => {
                    if (window.confirm(`Delete the saved message "${item.title}"?`)) deleteSavedMutation.mutate(item.id);
                  }}
                  className="pr-2 py-1.5 text-white/35 hover:text-rose-300"
                >
                  &times;
                </button>
              </span>
            ))}
          </div>

          {saveTitle === null ? (
            <button
              type="button"
              disabled={message.trim().length === 0}
              onClick={() => setSaveTitle('')}
              className="text-xs text-brand-300 hover:text-brand-200 disabled:opacity-40"
            >
              Save this message to reuse later
            </button>
          ) : (
            <div className="flex gap-2">
              <input
                className={FIELD}
                maxLength={80}
                placeholder="A short name, e.g. Service time change"
                value={saveTitle}
                onChange={(e) => setSaveTitle(e.target.value)}
                aria-label="Name for this saved message"
              />
              <button
                type="button"
                disabled={saveTitle.trim().length === 0 || saveMutation.isPending}
                onClick={() => saveMutation.mutate(saveTitle.trim())}
                className="px-4 bg-white/10 hover:bg-white/15 disabled:opacity-50 text-white font-semibold rounded-xl text-sm"
              >
                {saveMutation.isPending ? 'Saving…' : 'Save'}
              </button>
              <button type="button" onClick={() => setSaveTitle(null)} className="px-2 text-xs text-white/40 hover:text-white">
                Cancel
              </button>
            </div>
          )}
        </div>

        <label className="block text-xs text-white/50">
          Send to
          <select
            className={`${FIELD} mt-1`}
            value={audienceType}
            onChange={(e) => {
              setAudienceType(e.target.value as AudienceType);
              resetPreview();
            }}
          >
            {audienceChoices.map((type) => (
              <option key={type} value={type}>
                {AUDIENCE_LABEL[type]}
              </option>
            ))}
          </select>
        </label>

        {audienceType === 'congregation' && (
          <input
            className={FIELD}
            placeholder="Congregation name, exactly as on member profiles"
            value={congregation}
            onChange={(e) => {
              setCongregation(e.target.value);
              resetPreview();
            }}
          />
        )}

        {audienceType === 'circle' && (
          <select
            className={FIELD}
            value={circleId}
            onChange={(e) => {
              setCircleId(e.target.value);
              resetPreview();
            }}
          >
            <option value="">Choose a circle...</option>
            {(circles.data?.circles ?? []).map((circle: { id: string; name: string }) => (
              <option key={circle.id} value={circle.id}>
                {circle.name}
              </option>
            ))}
          </select>
        )}

        <div className="flex gap-2">
          <button
            onClick={() => previewMutation.mutate()}
            disabled={!canPreview || previewMutation.isPending}
            className="flex-1 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white font-semibold py-3 rounded-xl text-sm transition-colors"
          >
            {previewMutation.isPending ? 'Checking...' : 'Preview'}
          </button>
          <button
            onClick={() => testMutation.mutate()}
            disabled={message.trim().length === 0 || blank || testMutation.isPending}
            className="px-4 bg-white/10 hover:bg-white/15 disabled:opacity-50 text-white font-semibold rounded-xl text-sm transition-colors"
          >
            Text me a test
          </button>
        </div>

        {feedback && (
          <p className={`text-xs ${feedback.good ? 'text-emerald-300' : 'text-amber-300'}`} role="status">
            {feedback.text}
          </p>
        )}
      </section>

      {preview && (
        <section className="glass-card p-5 space-y-4 border border-brand-500/30">
          <h3 className="text-sm font-bold text-white">Check before sending</h3>

          <div className="rounded-xl bg-white/5 border border-white/10 p-3">
            <p className="text-white/80 text-sm whitespace-pre-wrap break-words">{preview.finalMessage}</p>
            <p className="text-[11px] text-white/35 mt-2">
              {preview.characters} characters · {preview.segmentsPerMessage} text {preview.segmentsPerMessage === 1 ? 'segment' : 'segments'} each
              {preview.encoding === 'ucs2' ? ' · contains special characters (costs more)' : ''}
            </p>
          </div>

          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-white/35">Will reach</dt>
              <dd className="text-2xl font-bold text-white">{preview.recipients}</dd>
              <dd className="text-[11px] text-white/35">
                people{preview.whatsappRecipients ? ` · ${preview.smsRecipients ?? 0} by SMS, ${preview.whatsappRecipients} by WhatsApp` : ''}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-white/35">Estimated cost</dt>
              <dd className="text-2xl font-bold text-white">
                {preview.estimatedCostUsd === null ? '—' : `$${preview.estimatedCostUsd.toFixed(2)}`}
              </dd>
              <dd className="text-[11px] text-white/35">
                {preview.totalSegments} segments{preview.estimatedCostUsd === null ? ' · price per text not set' : ''}
              </dd>
            </div>
          </dl>

          {preview.sample.length > 0 && (
            <p className="text-xs text-white/45">
              Including: {preview.sample.map((p) => `${p.name ?? 'Member'} (${p.phone})`).join(', ')}
              {preview.recipients > preview.sample.length ? ` and ${preview.recipients - preview.sample.length} more` : ''}
            </p>
          )}

          {(preview.skippedInvalidPhone > 0 || preview.skippedOptedOut > 0) && (
            <p className="text-[11px] text-white/35">
              Left out: {preview.skippedInvalidPhone} without a usable mobile number, {preview.skippedOptedOut} who replied STOP.
            </p>
          )}

          {blockers.map((reason) => (
            <p key={String(reason)} className="text-xs text-rose-300">
              {reason}
            </p>
          ))}

          {blockers.length === 0 && (
            <>
              <label className="flex items-start gap-3 text-xs text-white/70 cursor-pointer">
                <input type="checkbox" className="mt-0.5 accent-amber-400" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
                <span>
                  I have read the message and checked who it is going to.
                  {preview.dryRun ? ' (Test mode: nothing will really be sent.)' : ' Texts cannot be recalled once sent.'}
                </span>
              </label>
              <button
                onClick={() => sendMutation.mutate()}
                disabled={!confirmed || sendMutation.isPending}
                className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 text-white font-bold py-3 rounded-xl text-sm transition-colors"
              >
                {sendMutation.isPending ? 'Sending...' : `Send to ${preview.recipients} ${preview.recipients === 1 ? 'person' : 'people'}`}
              </button>
            </>
          )}
        </section>
      )}

      <section className="space-y-2">
        <h3 className="text-sm font-bold text-white px-1">Recent texts</h3>
        {log.isLoading && <p className="text-white/40 text-xs text-center py-4">Loading history...</p>}
        {log.error && <p className="text-xs text-rose-300">Could not load history. {(log.error as Error).message}</p>}
        {log.data && log.data.messages.length === 0 && <p className="text-white/35 text-xs text-center py-6">Nothing sent yet.</p>}

        {log.data?.messages.map((entry) => (
          <article key={entry.id} className="glass-card p-3 space-y-1.5">
            <div className="flex items-center justify-between gap-2 text-[11px]">
              <span className="text-white/45">
                {PURPOSE_LABEL[entry.purpose] ?? entry.purpose} · {entry.channel === 'whatsapp' ? 'WhatsApp · ' : ''}{entry.phone}
              </span>
              <span className={`px-2 py-0.5 rounded-full font-bold uppercase tracking-wide ${STATUS_STYLE[entry.status]}`}>{STATUS_LABEL[entry.status]}</span>
            </div>
            <p className="text-white/70 text-xs line-clamp-2 break-words">{entry.body}</p>
            <p className="text-[10px] text-white/30">
              {formatTime(entry.createdAt)} · {entry.segments} {entry.segments === 1 ? 'segment' : 'segments'}
              {entry.error && entry.status !== 'sent' ? ` · ${entry.error}` : ''}
            </p>
          </article>
        ))}
      </section>
    </div>
  );
}
