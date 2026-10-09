import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

type Topic = 'announcements' | 'dailyVerse' | 'birthday';

const TOPICS: Array<{ key: Topic; title: string; detail: string }> = [
  { key: 'announcements', title: 'Church announcements', detail: 'Important news and updates from church leadership.' },
  { key: 'dailyVerse', title: "Today's verse", detail: 'The daily verse as a text message each morning.' },
  { key: 'birthday', title: 'Birthday blessing', detail: 'A birthday message from the church on your day.' },
];

/**
 * A member's own text-message choices. Everything starts switched off: the church only
 * texts people who deliberately turn a topic on, and anyone can reply STOP at any time.
 */
export default function SmsPreferencesCard() {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey: ['sms-preferences'], queryFn: api.getSmsPreferences });
  const [draft, setDraft] = useState<Record<Topic, boolean> | null>(null);
  const [message, setMessage] = useState<{ text: string; good: boolean } | null>(null);

  const saved = data?.preferences;
  const values: Record<Topic, boolean> | null = draft ?? (saved ? { announcements: saved.announcements, dailyVerse: saved.dailyVerse, birthday: saved.birthday } : null);
  const changed = !!draft && !!saved && TOPICS.some(({ key }) => draft[key] !== saved[key]);

  const save = useMutation({
    mutationFn: (next: Record<Topic, boolean>) => api.saveSmsPreferences(next),
    onSuccess: () => {
      setDraft(null);
      setMessage({ good: true, text: 'Your text message choices are saved.' });
      queryClient.invalidateQueries({ queryKey: ['sms-preferences'] });
    },
    onError: (err: Error) => setMessage({ good: false, text: err.message.replace(/^API error: \d+ – /, '') }),
  });

  if (isLoading) return null;
  if (error || !saved || !values) return null;

  const anyOn = TOPICS.some(({ key }) => values[key]);

  return (
    <section className="glass-card p-5 border border-white/10 space-y-4">
      <div>
        <h3 className="text-sm font-bold text-white">Text messages</h3>
        <p className="text-xs text-white/45 mt-1">
          Choose what the church may text to {saved.phone ? <strong className="text-white/70">{saved.phone}</strong> : 'your phone'}. All of it is off unless you turn it on, and you can reply STOP to any text to opt out.
        </p>
      </div>

      {!saved.phoneUsable && (
        <p className="text-xs text-amber-300 p-3 rounded-xl border border-amber-500/30 bg-amber-500/10">
          Add a valid mobile number to your profile above (for example 077 123 4567), save it, then come back here to turn texts on.
        </p>
      )}

      {saved.optedOut && (
        <p className="text-xs text-amber-300 p-3 rounded-xl border border-amber-500/30 bg-amber-500/10">
          You replied STOP, so no texts will be sent to this number. Reply START to a church text to resume.
        </p>
      )}

      <div className="space-y-3">
        {TOPICS.map(({ key, title, detail }) => (
          <label key={key} className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              className="mt-1 accent-amber-400"
              checked={values[key]}
              // Turning something OFF is always allowed; turning it ON needs a usable number.
              disabled={!saved.phoneUsable && !values[key]}
              onChange={(e) => {
                setMessage(null);
                setDraft({ ...values, [key]: e.target.checked });
              }}
            />
            <span>
              <span className="block text-sm text-white font-medium">{title}</span>
              <span className="block text-xs text-white/40">{detail}</span>
            </span>
          </label>
        ))}
      </div>

      <button
        onClick={() => draft && save.mutate(draft)}
        disabled={!changed || save.isPending}
        className="w-full bg-brand-500 hover:bg-brand-600 disabled:opacity-40 text-white font-semibold py-3 rounded-xl text-sm transition-colors"
      >
        {save.isPending ? 'Saving...' : anyOn ? 'Save text choices' : 'Save (no texts)'}
      </button>

      {message && (
        <p className={`text-xs ${message.good ? 'text-emerald-300' : 'text-amber-300'}`} role="status">
          {message.text}
        </p>
      )}
    </section>
  );
}
