import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

export default function FamilyHubPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'milestones' | 'trivia' | 'circles' | 'sermons'>('milestones');

  // 1. Fetch data
  const { data: milestonesData, isLoading: milestonesLoading } = useQuery({
    queryKey: ['milestones'],
    queryFn: api.getMilestones,
  });

  const { data: triviaData, isLoading: triviaLoading } = useQuery({
    queryKey: ['weekly-trivia'],
    queryFn: api.getWeeklyTrivia,
  });

  const { data: circlesData, isLoading: circlesLoading } = useQuery({
    queryKey: ['circles'],
    queryFn: api.getCircles,
  });

  const { data: sermonsData, isLoading: sermonsLoading } = useQuery({
    queryKey: ['sermons'],
    queryFn: api.getSermons,
  });

  // 2. Mutations
  const joinCircleMutation = useMutation({
    mutationFn: api.joinCircle,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['circles'] }),
  });

  const leaveCircleMutation = useMutation({
    mutationFn: api.leaveCircle,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['circles'] }),
  });

  const submitTriviaMutation = useMutation({
    mutationFn: ({ questionId, optionIndex }: { questionId: string; optionIndex: number }) =>
      api.submitTriviaAnswer(questionId, optionIndex),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['weekly-trivia'] }),
  });

  const [activeSermon, setActiveSermon] = useState<any | null>(null);
  const [sermonNotes, setSermonNotes] = useState('');
  const [notesSaving, setNotesSaving] = useState(false);

  const { data: notesData } = useQuery({
    queryKey: ['sermon-notes', activeSermon?.id],
    queryFn: () => api.getSermonNotes(activeSermon.id),
    enabled: !!activeSermon?.id,
  });

  const handleOpenSermon = (sermon: any) => {
    setActiveSermon(sermon);
    setSermonNotes('');
    // Wait for query enabled trigger
  };

  const handleSaveNotes = async () => {
    if (!activeSermon) return;
    setNotesSaving(true);
    try {
      await api.saveSermonNotes(activeSermon.id, sermonNotes);
    } catch (err) {
      console.error(err);
    } finally {
      setNotesSaving(false);
    }
  };

  const [selectedTriviaOption, setSelectedTriviaOption] = useState<Record<string, number>>({});

  const handleTriviaSubmit = (questionId: string) => {
    const optionIdx = selectedTriviaOption[questionId];
    if (optionIdx === undefined) return;
    submitTriviaMutation.mutate({ questionId, optionIndex: optionIdx });
  };

  return (
    <div className="py-4 animate-fade-in space-y-6">
      {/* Title */}
      <div>
        <h2 className="text-2xl font-bold text-white mb-1">Family Hub</h2>
        <p className="text-white/40 text-sm">Grow, learn, and coordinate with the church body.</p>
      </div>

      {/* Tabs Selector */}
      <div className="flex gap-2 overflow-x-auto pb-1 border-b border-white/5 no-scrollbar">
        <button
          onClick={() => setActiveTab('milestones')}
          className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all shrink-0 border ${
            activeTab === 'milestones'
              ? 'bg-brand-500/10 text-brand-400 border-brand-500/20 font-bold'
              : 'text-white/40 border-transparent hover:text-white/70'
          }`}
        >
          🏆 Congregation Goals
        </button>
        <button
          onClick={() => setActiveTab('trivia')}
          className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all shrink-0 border ${
            activeTab === 'trivia'
              ? 'bg-brand-500/10 text-brand-400 border-brand-500/20 font-bold'
              : 'text-white/40 border-transparent hover:text-white/70'
          }`}
        >
          🧠 Weekly Trivia
        </button>
        <button
          onClick={() => setActiveTab('circles')}
          className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all shrink-0 border ${
            activeTab === 'circles'
              ? 'bg-brand-500/10 text-brand-400 border-brand-500/20 font-bold'
              : 'text-white/40 border-transparent hover:text-white/70'
          }`}
        >
          👥 Home Circles
        </button>
        <button
          onClick={() => setActiveTab('sermons')}
          className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all shrink-0 border ${
            activeTab === 'sermons'
              ? 'bg-brand-500/10 text-brand-400 border-brand-500/20 font-bold'
              : 'text-white/40 border-transparent hover:text-white/70'
          }`}
        >
          📖 Sermon Notes
        </button>
      </div>

      {/* ── Tab Content: Milestones ────────────────────────────────────────── */}
      {activeTab === 'milestones' && (
        <div className="space-y-6">
          {milestonesLoading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {/* Progress Summary Card */}
              <div className="glass-card p-6 relative overflow-hidden bg-gradient-to-br from-brand-950/20 via-neutral-900/40 to-neutral-950/20">
                <div className="absolute inset-0 opacity-[0.03] pointer-events-none flex items-center justify-center p-6">
                  <img src="/church_logo.png" alt="" className="w-full h-full object-contain" />
                </div>
                <div className="relative z-10 space-y-4">
                  <div className="flex justify-between items-end">
                    <div>
                      <span className="text-[10px] text-brand-400 font-bold uppercase tracking-widest">Victory Tabernacle Family Progress</span>
                      <h3 className="text-3xl font-extrabold text-white mt-1">
                        {milestonesData?.totalReads ?? 0}
                      </h3>
                      <p className="text-white/40 text-xs mt-0.5">Total scripture readings this month</p>
                    </div>
                  </div>

                  {/* Circular/Linear progress representation */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs text-white/50">
                      <span>Monthly Milestone Journey</span>
                      <span className="font-semibold text-white/80">
                        {Math.min(100, Math.round(((milestonesData?.totalReads ?? 0) / 1000) * 100))}% towards 1,000 target
                      </span>
                    </div>
                    <div className="w-full h-3 bg-white/5 rounded-full overflow-hidden border border-white/5">
                      <div
                        className="h-full bg-gradient-to-r from-brand-500 to-amber-500 rounded-full transition-all duration-1000"
                        style={{ width: `${Math.min(100, Math.round(((milestonesData?.totalReads ?? 0) / 1000) * 100))}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Milestones Checklist */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-white/50 uppercase tracking-widest px-1">Collective Family Goals</h4>
                <div className="space-y-3">
                  {milestonesData?.milestones?.map((m: any) => (
                    <div
                      key={m.target}
                      className={`glass-card p-4 flex gap-4 items-center transition-all ${
                        m.achieved ? 'border-brand-500/20 bg-brand-950/5' : 'opacity-65'
                      }`}
                    >
                      <div
                        className={`w-8 h-8 rounded-full border flex items-center justify-center shrink-0 ${
                          m.achieved
                            ? 'bg-brand-500/10 border-brand-500 text-brand-400'
                            : 'bg-white/5 border-white/10 text-white/20'
                        }`}
                      >
                        {m.achieved ? (
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <span className="text-[10px] font-bold">{m.target}</span>
                        )}
                      </div>
                      <div>
                        <h5 className="text-xs font-bold text-white">{m.label}</h5>
                        <p className="text-[11px] text-white/40 mt-0.5">{m.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Tab Content: Trivia ────────────────────────────────────────────── */}
      {activeTab === 'trivia' && (
        <div className="space-y-4 animate-fade-in">
          {triviaLoading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : triviaData?.trivia && triviaData.trivia.length > 0 ? (
            triviaData.trivia.map((q: any) => (
              <div key={q.id} className="glass-card p-5 space-y-4">
                <div>
                  <span className="text-[9px] bg-brand-500/10 text-brand-400 border border-brand-500/20 px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                    Weekly Bible Challenge
                  </span>
                  <h4 className="text-sm font-bold text-white mt-2.5 leading-relaxed">{q.question}</h4>
                </div>

                <div className="space-y-2">
                  {q.options.map((opt: string, idx: number) => {
                    const isSelected = selectedTriviaOption[q.id] === idx;
                    const hasAnswered = q.hasAnswered;
                    const isCorrectOption = q.correctOptionIndex === idx;

                    let buttonClass = 'w-full text-left p-3 rounded-xl text-xs transition-all border ';
                    if (hasAnswered) {
                      if (isCorrectOption) {
                        buttonClass += 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 font-bold';
                      } else if (q.selectedOptionIndex === idx && !q.isCorrect) {
                        buttonClass += 'bg-red-500/15 border-red-500/40 text-red-300';
                      } else {
                        buttonClass += 'bg-white/5 border-white/5 text-white/40';
                      }
                    } else {
                      if (isSelected) {
                        buttonClass += 'bg-brand-500/15 border-brand-500/50 text-white font-semibold';
                      } else {
                        buttonClass += 'bg-white/5 border-white/5 hover:bg-white/10 text-white/70';
                      }
                    }

                    return (
                      <button
                        key={idx}
                        disabled={hasAnswered}
                        onClick={() => setSelectedTriviaOption({ ...selectedTriviaOption, [q.id]: idx })}
                        className={buttonClass}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>

                {!q.hasAnswered ? (
                  <button
                    onClick={() => handleTriviaSubmit(q.id)}
                    disabled={selectedTriviaOption[q.id] === undefined || submitTriviaMutation.isPending}
                    className="w-full bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-xs active:scale-[0.98] transition-all shadow-md"
                  >
                    Submit Answer
                  </button>
                ) : (
                  <div className="p-3.5 rounded-xl bg-white/5 border border-white/5 text-xs text-white/70 leading-relaxed space-y-2">
                    <div className="flex items-center gap-1.5 font-bold">
                      {q.isCorrect ? (
                        <span className="text-emerald-400">🎉 Correct!</span>
                      ) : (
                        <span className="text-red-400">❌ Incorrect</span>
                      )}
                    </div>
                    {q.explanation && <p className="italic text-[11px] text-white/50">"{q.explanation}"</p>}
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="glass-card p-10 text-center text-white/30 italic text-xs">
              No weekly trivia scheduled for this week. Check back later!
            </div>
          )}
        </div>
      )}

      {/* ── Tab Content: Circles ───────────────────────────────────────────── */}
      {activeTab === 'circles' && (
        <div className="space-y-4 animate-fade-in">
          {circlesLoading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : circlesData?.circles && circlesData.circles.length > 0 ? (
            circlesData.circles.map((c: any) => (
              <div key={c.id} className="glass-card p-5 flex justify-between items-start gap-4">
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-white">{c.name}</h4>
                  {c.description && <p className="text-xs text-white/40 leading-relaxed">{c.description}</p>}
                </div>

                <button
                  onClick={() => {
                    if (c.hasJoined) {
                      leaveCircleMutation.mutate(c.id);
                    } else {
                      joinCircleMutation.mutate(c.id);
                    }
                  }}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold tracking-wide uppercase transition-all active:scale-[0.97] border ${
                    c.hasJoined
                      ? 'bg-brand-500/10 border-brand-500/30 text-brand-400'
                      : 'bg-white/5 border-white/10 hover:bg-white/10 text-white/60'
                  }`}
                >
                  {c.hasJoined ? 'Joined' : 'Join'}
                </button>
              </div>
            ))
          ) : (
            <div className="glass-card p-10 text-center text-white/30 italic text-xs">
              No Home Circles configured yet. Contact your administration.
            </div>
          )}
        </div>
      )}

      {/* ── Tab Content: Sermons ───────────────────────────────────────────── */}
      {activeTab === 'sermons' && (
        <div className="space-y-4 animate-fade-in">
          {sermonsLoading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : sermonsData?.sermons && sermonsData.sermons.length > 0 ? (
            sermonsData.sermons.map((s: any) => (
              <div
                key={s.id}
                onClick={() => handleOpenSermon(s)}
                className="glass-card-hover p-5 flex justify-between items-center cursor-pointer border-l-2 border-l-brand-500"
              >
                <div>
                  <h4 className="text-sm font-bold text-white">{s.title}</h4>
                  <p className="text-xs text-white/40 mt-1">Preached by {s.preacher}</p>
                </div>
                <span className="text-[10px] text-brand-400 font-bold bg-brand-500/10 border border-brand-500/20 px-2 py-0.5 rounded uppercase tracking-wider whitespace-nowrap">
                  {new Date(s.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </span>
              </div>
            ))
          ) : (
            <div className="glass-card p-10 text-center text-white/30 italic text-xs">
              No Sunday sermon outlines posted yet.
            </div>
          )}
        </div>
      )}

      {/* ── Sermon Drawer Modal ────────────────────────────────────────────── */}
      {activeSermon && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-end items-end transition-opacity duration-300">
          <div className="absolute inset-0" onClick={() => setActiveSermon(null)} />
          <div className="relative w-full max-w-md bg-neutral-900 border-t border-white/10 rounded-t-3xl p-6 shadow-2xl z-10 animate-slide-up max-h-[85vh] overflow-y-auto flex flex-col space-y-6">
            <div className="w-12 h-1 bg-white/20 rounded-full mx-auto shrink-0" />

            <div className="flex justify-between items-start shrink-0">
              <div>
                <h3 className="text-lg font-bold text-white">{activeSermon.title}</h3>
                <p className="text-xs text-white/40 mt-0.5">Preacher: {activeSermon.preacher} • {new Date(activeSermon.date).toLocaleDateString()}</p>
              </div>
              <button
                onClick={() => setActiveSermon(null)}
                className="text-white/40 hover:text-white bg-white/5 rounded-full p-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content area */}
            <div className="space-y-6 overflow-y-auto flex-1 pr-1">
              {/* Outline card */}
              <div className="glass-card p-4 space-y-2 border border-white/5 bg-white/5">
                <h4 className="text-xs font-bold text-brand-400 uppercase tracking-widest border-b border-white/5 pb-2">Sermon Outline</h4>
                <p className="text-xs text-white/80 leading-relaxed whitespace-pre-line font-medium pr-1">
                  {activeSermon.outline}
                </p>
              </div>

              {/* Personal notes textbox */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <h4 className="text-xs font-bold text-white/50 uppercase tracking-widest">My Personal Study Notes</h4>
                  <button
                    onClick={handleSaveNotes}
                    disabled={notesSaving}
                    className="text-[10px] font-bold text-brand-400 bg-brand-500/10 border border-brand-500/25 px-2.5 py-1 rounded"
                  >
                    {notesSaving ? 'Saving...' : 'Save Notes'}
                  </button>
                </div>
                <textarea
                  value={sermonNotes || notesData?.notes || ''}
                  onChange={(e) => setSermonNotes(e.target.value)}
                  rows={6}
                  placeholder="Capture key scriptures, thoughts, or application notes from this message..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs text-white focus:border-brand-500 focus:outline-none resize-none transition-colors"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
