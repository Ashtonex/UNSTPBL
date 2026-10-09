import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type MessageTemplate, type TemplatePreview } from '../lib/api';
import SmsModeBanner from '../components/SmsModeBanner';

const FIELD =
  'w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-brand-500 focus:outline-none';

const MAX_LENGTH = 320;
const OPT_OUT_LINE = 'Reply STOP to opt out.';

const cleanError = (err: Error) => err.message.replace(/^API error: \d+ – /, '');

const formatTime = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

function TemplateCard({ template }: { template: MessageTemplate }) {
  const queryClient = useQueryClient();
  const textarea = useRef<HTMLTextAreaElement>(null);
  const [draft, setDraft] = useState(template.body);
  const [live, setLive] = useState<TemplatePreview | null>(null);
  const [feedback, setFeedback] = useState<{ text: string; good: boolean } | null>(null);

  // Follow the saved version when it changes (after a save or a reset).
  useEffect(() => {
    setDraft(template.body);
    setLive(null);
  }, [template.body]);

  // Show the finished text, length and cost as the leader types (after a short pause).
  useEffect(() => {
    if (draft === template.body) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      api
        .previewMessageTemplate(template.key, draft)
        .then((result) => !cancelled && setLive(result))
        .catch((err: Error) => !cancelled && setLive({ valid: false, error: cleanError(err) }));
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [draft, template.body, template.key]);

  const changed = draft.trim() !== template.body.trim();
  const shown = changed && live ? live : null;
  const invalid = shown?.valid === false;
  const preview = shown?.valid ? shown.preview : template.preview;
  const cost = shown?.valid ? shown.costPerMessageUsd : null;

  const insert = (token: string) => {
    const el = textarea.current;
    const start = el?.selectionStart ?? draft.length;
    const end = el?.selectionEnd ?? draft.length;
    const next = `${draft.slice(0, start)}${token}${draft.slice(end)}`;
    setDraft(next);
    setFeedback(null);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + token.length, start + token.length);
    });
  };

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['message-templates'] });

  const save = useMutation({
    mutationFn: () => api.saveMessageTemplate(template.key, draft),
    onSuccess: () => {
      setFeedback({ good: true, text: 'Saved. New texts will use this wording.' });
      refresh();
    },
    onError: (err: Error) => setFeedback({ good: false, text: cleanError(err) }),
  });

  const reset = useMutation({
    mutationFn: () => api.resetMessageTemplate(template.key),
    onSuccess: () => {
      setFeedback({ good: true, text: 'Back to the original wording.' });
      refresh();
    },
    onError: (err: Error) => setFeedback({ good: false, text: cleanError(err) }),
  });

  return (
    <section className="glass-card p-5 space-y-3">
      <div>
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-white">{template.label}</h3>
          {template.isCustom && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-brand-500/15 text-brand-300 whitespace-nowrap">Customised</span>
          )}
        </div>
        <p className="text-white/40 text-xs mt-0.5">{template.when}</p>
      </div>

      <div>
        <textarea
          ref={textarea}
          className={`${FIELD} resize-none ${invalid ? 'border-rose-500/50' : ''}`}
          rows={4}
          maxLength={MAX_LENGTH}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setFeedback(null);
          }}
          aria-label={`${template.label} wording`}
        />
        <p className="text-[11px] text-white/35 mt-1 text-right">
          {draft.length}/{MAX_LENGTH}
        </p>
      </div>

      <div className="flex flex-wrap gap-2" aria-label="Insert a detail">
        {template.placeholders.map((p) => (
          <button
            key={p.token}
            type="button"
            onClick={() => insert(p.token)}
            title={`Inserts ${p.meaning}`}
            className="px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-white/70 hover:bg-white/10"
          >
            {p.token}
            <span className="text-white/35"> · {p.meaning}</span>
          </button>
        ))}
      </div>

      {invalid && shown?.valid === false && (
        <p className="text-xs text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">{shown.error}</p>
      )}

      <div className="rounded-xl bg-black/20 border border-white/5 p-3">
        <p className="text-[10px] uppercase tracking-wider text-white/30 mb-1">
          {changed && shown?.valid ? 'Preview of your wording' : 'How it reads now'} (made-up name)
        </p>
        <p className="text-sm text-white/80 whitespace-pre-wrap break-words">{preview.text}</p>
        <p className="text-[11px] text-white/35 mt-2">
          {preview.characters} characters · {preview.segments} text segment{preview.segments === 1 ? '' : 's'}
          {cost !== null && ` · about $${cost.toFixed(2)} per person`}
          {preview.encoding === 'ucs2' && ' · special characters make this cost more'}
        </p>
        <p className="text-[11px] text-white/30 mt-1">&ldquo;{OPT_OUT_LINE}&rdquo; is always added automatically.</p>
      </div>

      {feedback && <p className={`text-xs ${feedback.good ? 'text-emerald-300' : 'text-rose-300'}`}>{feedback.text}</p>}

      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={!changed || invalid || save.isPending}
          onClick={() => save.mutate()}
          className="btn-primary px-4 py-2 text-sm disabled:opacity-40"
        >
          {save.isPending ? 'Saving…' : 'Save wording'}
        </button>
        {changed && (
          <button type="button" onClick={() => setDraft(template.body)} className="px-3 py-2 text-xs text-white/50 hover:text-white">
            Undo changes
          </button>
        )}
        {template.isCustom && !changed && (
          <button
            type="button"
            disabled={reset.isPending}
            onClick={() => {
              if (window.confirm('Go back to the original wording for this message?')) reset.mutate();
            }}
            className="px-3 py-2 text-xs text-white/50 hover:text-white disabled:opacity-40"
          >
            Reset to original
          </button>
        )}
      </div>

      {template.updatedAt && <p className="text-[11px] text-white/30">Last changed {formatTime(template.updatedAt)}</p>}
    </section>
  );
}

export default function MessageWordingPage() {
  const templates = useQuery({ queryKey: ['message-templates'], queryFn: api.getMessageTemplates });

  return (
    <div className="w-full max-w-lg mx-auto py-4 animate-fade-in space-y-5">
      <section>
        <Link to="/messages" className="text-xs text-white/40 hover:text-white">
          &larr; Text messages
        </Link>
        <h2 className="text-2xl font-bold text-white mb-1 mt-2">Message wording</h2>
        <p className="text-white/40 text-sm">
          Change what the standing texts say. Use the buttons to drop in a name or the verse. Short texts cost less: one segment is 160
          plain characters.
        </p>
      </section>

      <SmsModeBanner />

      {templates.isLoading && <p className="text-white/40 text-sm">Loading…</p>}
      {templates.isError && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-xl">
          Could not load the wording. {cleanError(templates.error as Error)}
        </div>
      )}

      {templates.data?.templates.map((template) => (
        <TemplateCard key={template.key} template={template} />
      ))}

      <p className="text-[11px] text-white/30">
        One-off announcements are written on the Text messages page. WhatsApp messages are not set up yet.
      </p>
    </div>
  );
}
