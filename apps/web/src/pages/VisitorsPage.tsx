import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type RegisterVisitorResult, type Visitor } from '../lib/api';
import SmsModeBanner from '../components/SmsModeBanner';

const FIELD =
  'w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-brand-500 focus:outline-none';

const STATUS_STYLE: Record<Visitor['followupStatus'], string> = {
  new: 'bg-sky-500/15 text-sky-300',
  contacted: 'bg-amber-500/15 text-amber-300',
  returning: 'bg-emerald-500/15 text-emerald-300',
  member: 'bg-brand-500/20 text-brand-300',
};

/** Plain-English account of what happened to the thank-you text. */
function describeWelcome(welcome: RegisterVisitorResult['welcome']): { text: string; good: boolean } {
  if (welcome.status === 'skipped') {
    if (welcome.reason === 'no_consent') return { text: "No text sent: they haven't agreed to receive texts.", good: false };
    if (welcome.reason === 'already_sent') return { text: 'They already received a welcome text before.', good: true };
    return { text: 'No text sent.', good: false };
  }
  if (welcome.status === 'sent' || welcome.status === 'delivered') return { text: 'Thank-you text sent.', good: true };
  if (welcome.status === 'dry_run') return { text: 'Test mode: the thank-you text was recorded but not actually sent.', good: true };
  if (welcome.reason === 'opted_out') return { text: 'This number has opted out of texts, so none was sent.', good: false };
  if (welcome.reason === 'monthly_cap') return { text: "This month's text limit is used up, so none was sent.", good: false };
  if (welcome.reason === 'not_configured') return { text: `Texting is not set up: ${welcome.detail ?? 'check the settings'}.`, good: false };
  return { text: `The thank-you text could not be sent${welcome.detail ? `: ${welcome.detail}` : '.'}`, good: false };
}

const formatDate = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

export default function VisitorsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [invitedBy, setInvitedBy] = useState('');
  const [notes, setNotes] = useState('');
  const [smsConsent, setSmsConsent] = useState(false);
  const [feedback, setFeedback] = useState<{ text: string; good: boolean } | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['visitors', search],
    queryFn: () => api.getVisitors(search),
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['visitors'] });

  const register = useMutation({
    mutationFn: api.registerVisitor,
    onSuccess: (result) => {
      const welcome = describeWelcome(result.welcome);
      const who = result.visitor.fullName;
      setFeedback({
        good: welcome.good,
        text: result.created
          ? `${who} has been added. ${welcome.text}`
          : `${who} was already on file, so this was recorded as visit number ${result.visitor.visitCount}. ${welcome.text}`,
      });
      setFullName('');
      setPhone('');
      setInvitedBy('');
      setNotes('');
      setSmsConsent(false);
      refresh();
      queryClient.invalidateQueries({ queryKey: ['messaging-status'] });
      queryClient.invalidateQueries({ queryKey: ['message-log'] });
    },
    onError: (err: Error) => setFeedback({ good: false, text: err.message.replace(/^API error: \d+ – /, '') }),
  });

  const visit = useMutation({ mutationFn: api.recordVisitorVisit, onSuccess: refresh });
  const update = useMutation({
    mutationFn: ({ id, status }: { id: string; status: Visitor['followupStatus'] }) => api.updateVisitor(id, { followupStatus: status }),
    onSuccess: refresh,
  });
  const welcome = useMutation({
    mutationFn: api.sendVisitorWelcome,
    onSuccess: (result) => {
      setFeedback(describeWelcome(result as RegisterVisitorResult['welcome']));
      refresh();
      queryClient.invalidateQueries({ queryKey: ['message-log'] });
    },
    onError: (err: Error) => setFeedback({ good: false, text: err.message.replace(/^API error: \d+ – /, '') }),
  });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setFeedback(null);
    register.mutate({
      fullName,
      phone,
      invitedBy: invitedBy || undefined,
      notes: notes || undefined,
      smsConsent,
    });
  };

  return (
    <div className="w-full max-w-lg mx-auto py-4 animate-fade-in space-y-5">
      <section>
        <h2 className="text-2xl font-bold text-white mb-1">Visitors</h2>
        <p className="text-white/40 text-sm">Welcome our guests, send a thank-you, and follow up so they feel at home.</p>
      </section>

      <SmsModeBanner />

      <form onSubmit={submit} className="glass-card p-5 space-y-3">
        <h3 className="text-sm font-bold text-white">Add a visitor</h3>
        <input className={FIELD} placeholder="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
        <input
          className={FIELD}
          placeholder="Mobile number, e.g. 077 123 4567"
          inputMode="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          required
        />
        <input className={FIELD} placeholder="Invited by (optional)" value={invitedBy} onChange={(e) => setInvitedBy(e.target.value)} />
        <textarea className={`${FIELD} resize-none`} rows={2} placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />

        <label className="flex items-start gap-3 text-xs text-white/70 cursor-pointer">
          <input type="checkbox" className="mt-0.5 accent-amber-400" checked={smsConsent} onChange={(e) => setSmsConsent(e.target.checked)} />
          <span>
            They agreed to receive text messages from the church. <span className="text-white/40">Only tick this if they ticked the box on their visitor card.</span>
          </span>
        </label>

        <button
          type="submit"
          disabled={register.isPending}
          className="w-full bg-brand-500 hover:bg-brand-600 disabled:opacity-60 text-white font-semibold py-3 rounded-xl text-sm transition-colors"
        >
          {register.isPending ? 'Saving...' : smsConsent ? 'Save & send welcome text' : 'Save visitor'}
        </button>

        {feedback && (
          <p className={`text-xs ${feedback.good ? 'text-emerald-300' : 'text-amber-300'}`} role="status">
            {feedback.text}
          </p>
        )}
      </form>

      <section className="space-y-3">
        <input className={FIELD} placeholder="Search by name or number" value={search} onChange={(e) => setSearch(e.target.value)} />

        {isLoading && <p className="text-white/40 text-xs text-center py-6">Loading visitors...</p>}
        {error && (
          <p className="text-xs text-rose-300 p-3 rounded-xl border border-rose-500/30 bg-rose-500/10">
            Could not load visitors. {(error as Error).message}
          </p>
        )}
        {data && data.visitors.length === 0 && <p className="text-white/40 text-sm text-center py-8">No visitors yet. Add the first one above.</p>}

        {data?.visitors.map((visitor) => (
          <article key={visitor.id} className="glass-card p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h4 className="text-white font-semibold text-sm truncate">{visitor.fullName}</h4>
                <a href={`tel:${visitor.phone}`} className="text-brand-400 text-xs">
                  {visitor.phone}
                </a>
              </div>
              <span className={`shrink-0 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ${STATUS_STYLE[visitor.followupStatus]}`}>
                {visitor.followupStatus}
              </span>
            </div>

            <p className="text-white/40 text-xs">
              {visitor.visitCount} {visitor.visitCount === 1 ? 'visit' : 'visits'} · last on {formatDate(visitor.lastVisitDate)}
              {visitor.invitedBy ? ` · invited by ${visitor.invitedBy}` : ''}
            </p>
            {visitor.notes && <p className="text-white/55 text-xs">{visitor.notes}</p>}

            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              <span className={visitor.smsConsent ? 'text-emerald-300' : 'text-white/35'}>
                {visitor.smsConsent ? 'Texts OK' : 'No text consent'}
              </span>
              {visitor.welcomeSentAt && <span className="text-white/35">· welcome sent</span>}
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => visit.mutate(visitor.id)}
                disabled={visit.isPending}
                className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-white text-xs font-semibold transition-colors"
              >
                Here again today
              </button>
              {visitor.smsConsent && !visitor.welcomeSentAt && (
                <button
                  onClick={() => welcome.mutate(visitor.id)}
                  disabled={welcome.isPending}
                  className="px-3 py-2 rounded-lg bg-brand-500/90 hover:bg-brand-500 text-white text-xs font-semibold transition-colors"
                >
                  Send welcome text
                </button>
              )}
              <select
                aria-label={`Follow-up status for ${visitor.fullName}`}
                value={visitor.followupStatus}
                onChange={(e) => update.mutate({ id: visitor.id, status: e.target.value as Visitor['followupStatus'] })}
                className="px-3 py-2 rounded-lg bg-white/10 text-white text-xs font-semibold focus:outline-none"
              >
                <option value="new">New</option>
                <option value="contacted">Contacted</option>
                <option value="returning">Returning</option>
                <option value="member">Now a member</option>
              </select>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
