import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useAuthStore } from '../stores/auth';

export default function PrayersPage() {
  const queryClient = useQueryClient();
  const { profile } = useAuthStore();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [type, setType] = useState<'request' | 'praise'>('request');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [filter, setFilter] = useState<'all' | 'request' | 'praise'>('all');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  // Fetch all prayer requests
  const { data: prayersData, isLoading } = useQuery({
    queryKey: ['prayer-requests'],
    queryFn: api.getPrayerRequests,
    refetchInterval: 10000, // Auto-refresh every 10 seconds to keep the wall live
  });

  // Mutation to create a prayer
  const createPrayerMutation = useMutation({
    mutationFn: api.createPrayerRequest,
    onSuccess: () => {
      setTitle('');
      setContent('');
      setIsAnonymous(false);
      setType('request');
      setShowAddForm(false);
      queryClient.invalidateQueries({ queryKey: ['prayer-requests'] });
      queryClient.invalidateQueries({ queryKey: ['user-progress'] });
    },
  });

  // Mutation to toggle join (pray/amen)
  const joinPrayerMutation = useMutation({
    mutationFn: api.joinPrayer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prayer-requests'] });
    },
  });

  const leavePrayerMutation = useMutation({
    mutationFn: api.leavePrayer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prayer-requests'] });
    },
  });

  // Mutation to mark as answered
  const markAnsweredMutation = useMutation({
    mutationFn: api.markPrayerAnswered,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prayer-requests'] });
      queryClient.invalidateQueries({ queryKey: ['user-progress'] });
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    setIsSubmitting(true);
    try {
      await createPrayerMutation.mutateAsync({
        title: title.trim(),
        content: content.trim(),
        type,
        isAnonymous,
      });
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleJoin = (prayer: any) => {
    if (prayer.hasJoined) {
      leavePrayerMutation.mutate(prayer.id);
    } else {
      joinPrayerMutation.mutate(prayer.id);
    }
  };

  const filteredPrayers = prayersData?.prayers?.filter((prayer: any) => {
    if (filter === 'all') return true;
    return prayer.type === filter;
  }) || [];

  return (
    <div className="py-4 animate-fade-in space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1">Family Prayer Wall</h2>
          <p className="text-white/40 text-sm">Share burdens and praises with your church family.</p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="bg-brand-500 hover:bg-brand-400 active:scale-[0.98] text-white font-bold py-2.5 px-4 rounded-xl text-xs transition-all shadow-md shadow-brand-500/10 flex items-center gap-1.5"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Share Something
        </button>
      </div>

      {/* Add Form Card */}
      {showAddForm && (
        <div className="glass-card p-5 animate-slide-up border border-brand-500/20">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Share on the Wall</h3>
            <button
              onClick={() => setShowAddForm(false)}
              className="text-white/40 hover:text-white/70"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-xs font-semibold text-white/70 cursor-pointer">
                <input
                  type="radio"
                  name="type"
                  checked={type === 'request'}
                  onChange={() => setType('request')}
                  className="accent-brand-500"
                />
                Prayer Request
              </label>
              <label className="flex items-center gap-2 text-xs font-semibold text-white/70 cursor-pointer">
                <input
                  type="radio"
                  name="type"
                  checked={type === 'praise'}
                  onChange={() => setType('praise')}
                  className="accent-amber-500"
                />
                Thanksgiving Praise
              </label>
            </div>

            <input
              type="text"
              placeholder="Give it a brief title (e.g. Health update, Thanksgiving for new home)..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={120}
              required
              className="w-full bg-white/5 border border-white/10 focus:border-brand-500/50 rounded-xl px-4 py-3 text-white text-xs focus:outline-none transition-colors"
            />

            <textarea
              placeholder="What would you like the church family to pray about or thank God for?..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={4}
              maxLength={2000}
              required
              className="w-full bg-white/5 border border-white/10 focus:border-brand-500/50 rounded-xl px-4 py-3 text-white text-xs focus:outline-none resize-none transition-colors"
            />

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-xs text-white/50 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isAnonymous}
                  onChange={(e) => setIsAnonymous(e.target.checked)}
                  className="rounded bg-white/5 border-white/10 text-brand-500 focus:ring-0 cursor-pointer"
                />
                Post anonymously to the wall
              </label>

              <button
                type="submit"
                disabled={isSubmitting || !title.trim() || !content.trim()}
                className="bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white font-bold py-2.5 px-6 rounded-xl text-xs active:scale-[0.98] transition-all shadow-md"
              >
                {isSubmitting ? 'Posting...' : 'Post to Wall'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex gap-2 border-b border-white/5 pb-1">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
            filter === 'all'
              ? 'bg-white/10 text-white font-bold'
              : 'text-white/40 hover:text-white/70'
          }`}
        >
          All Shared
        </button>
        <button
          onClick={() => setFilter('request')}
          className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
            filter === 'request'
              ? 'bg-brand-500/10 text-brand-400 font-bold border border-brand-500/20'
              : 'text-white/40 hover:text-white/70'
          }`}
        >
          🙏 Requests
        </button>
        <button
          onClick={() => setFilter('praise')}
          className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
            filter === 'praise'
              ? 'bg-amber-500/10 text-amber-400 font-bold border border-amber-500/20'
              : 'text-white/40 hover:text-white/70'
          }`}
        >
          🙌 praises
        </button>
      </div>

      {/* List Feed */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-10 h-10 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-white/40 text-xs">Loading prayer wall...</p>
        </div>
      ) : filteredPrayers.length > 0 ? (
        <div className="space-y-4">
          {filteredPrayers.map((prayer: any) => (
            <div
              key={prayer.id}
              className={`glass-card p-5 relative overflow-hidden border-l-4 transition-all ${
                prayer.status === 'answered'
                  ? 'border-l-emerald-500 bg-emerald-950/5'
                  : prayer.type === 'praise'
                  ? 'border-l-amber-500 bg-amber-950/5'
                  : 'border-l-brand-500'
              }`}
            >
              {/* Top Row: Meta info */}
              <div className="flex justify-between items-start mb-2 relative z-10">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white/80">
                      {prayer.user?.displayName || 'Family Member'}
                    </span>
                    {prayer.user?.congregation && (
                      <span className="text-[10px] text-white/30 font-medium">
                        • {prayer.user.congregation}
                      </span>
                    )}
                  </div>
                  <span className="text-[9px] text-white/20">
                    {new Date(prayer.createdAt).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`text-[9px] px-2 py-0.5 rounded font-bold uppercase tracking-wider border ${
                      prayer.status === 'answered'
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : prayer.type === 'praise'
                        ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                        : 'bg-brand-500/10 text-brand-400 border-brand-500/20'
                    }`}
                  >
                    {prayer.status === 'answered' ? 'Answered!' : prayer.type}
                  </span>
                </div>
              </div>

              {/* Title & Body */}
              <div className="mb-4 relative z-10">
                <h4 className="text-sm font-bold text-white mb-1.5">{prayer.title}</h4>
                <p className="text-xs text-white/70 leading-relaxed whitespace-pre-line">{prayer.content}</p>
              </div>

              {/* Bottom Row: Actions */}
              <div className="flex items-center justify-between border-t border-white/5 pt-3 mt-1 relative z-10">
                <button
                  onClick={() => {
                    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
                      try {
                        navigator.vibrate(25);
                      } catch {}
                    }
                    handleToggleJoin(prayer);
                  }}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all active:scale-[0.97] border ${
                    prayer.hasJoined
                      ? 'bg-amber-500/20 border-amber-400/40 text-amber-200 ring-2 ring-amber-400/25 shadow-lg shadow-amber-500/15'
                      : 'bg-white/5 border-white/10 hover:bg-white/10 text-white/70 hover:text-white'
                  }`}
                >
                  {prayer.hasJoined ? (
                    <span className="flex items-center gap-1.5">
                      <span className="text-base animate-pulse">🕯️</span>
                      <span className="font-bold text-amber-300">Candle Lit</span>
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5">
                      <span className="text-base opacity-70">🕯️</span>
                      <span>Light Candle & Pray</span>
                    </span>
                  )}
                  {prayer._count?.joins > 0 && (
                    <span className="ml-1 px-2 py-0.5 bg-amber-500/20 text-amber-300 rounded-full text-[10px] font-bold border border-amber-400/30">
                      {prayer._count.joins} praying
                    </span>
                  )}
                </button>

                {/* Mark as answered if owned by user */}
                {profile?.id === prayer.userId && prayer.status === 'open' && (
                  <button
                    onClick={() => markAnsweredMutation.mutate(prayer.id)}
                    className="text-[10px] text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/25 px-2.5 py-1.5 rounded-lg font-semibold transition-all"
                  >
                    Mark Answered / Thanksgiving
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="glass-card p-10 text-center text-white/30 space-y-2">
          <p className="text-sm font-semibold">The prayer wall is empty.</p>
          <p className="text-xs text-white/20">Click "Share Something" above to post your request or praise.</p>
        </div>
      )}
    </div>
  );
}
