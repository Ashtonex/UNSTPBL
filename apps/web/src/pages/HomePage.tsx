import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { DEFAULT_FALLBACK_VERSE } from '@unstpbl/shared';
import VerseCard from '../components/VerseCard';
import type { DailyVerse } from '@unstpbl/shared';

export default function HomePage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [isRead, setIsRead] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [reflection, setReflection] = useState('');
  const [prayerTitle, setPrayerTitle] = useState('');
  const [prayerContent, setPrayerContent] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);

  useEffect(() => {
    return () => {
      window.speechSynthesis.cancel();
    };
  }, []);

  const {
    data: dailyVerse,
    isLoading,
    error,
  } = useQuery<DailyVerse>({
    queryKey: ['verse-today'],
    queryFn: api.getVerseToday,
    retry: 2,
  });

  const {
    data: historyData,
    isLoading: historyLoading,
  } = useQuery({
    queryKey: ['verse-history'],
    queryFn: () => api.getVerseHistory(10),
    enabled: showHistory,
  });

  const {
    data: relatedData,
    isLoading: relatedLoading,
  } = useQuery({
    queryKey: ['related-verses', dailyVerse?.verse?.id],
    queryFn: () => api.getRelatedVerses(dailyVerse!.verse.id),
    enabled: !!dailyVerse?.verse?.id && dailyVerse.verse.id !== 0,
  });

  const { data: progress } = useQuery({
    queryKey: ['user-progress'],
    queryFn: api.getUserProgress,
    enabled: !!dailyVerse?.verse?.id,
  });

  const { data: favoritesData } = useQuery({
    queryKey: ['favorite-verses'],
    queryFn: api.getFavoriteVerses,
    enabled: !!dailyVerse?.verse?.id,
  });

  const { data: reflectionsData } = useQuery({
    queryKey: ['verse-reflections', dailyVerse?.schedule?.id],
    queryFn: () => api.getVerseReflections(undefined, dailyVerse?.schedule?.id),
    enabled: !!dailyVerse?.schedule?.id && dailyVerse.schedule.id !== 'fallback',
  });

  const { data: prayersData } = useQuery({
    queryKey: ['prayer-requests'],
    queryFn: api.getPrayerRequests,
  });

  const addFavoriteMutation = useMutation({
    mutationFn: api.addFavoriteVerse,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['favorite-verses'] });
      queryClient.invalidateQueries({ queryKey: ['user-progress'] });
    },
  });

  const removeFavoriteMutation = useMutation({
    mutationFn: api.removeFavoriteVerse,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['favorite-verses'] });
      queryClient.invalidateQueries({ queryKey: ['user-progress'] });
    },
  });

  const reflectionMutation = useMutation({
    mutationFn: api.createVerseReflection,
    onSuccess: () => {
      setReflection('');
      queryClient.invalidateQueries({ queryKey: ['verse-reflections', dailyVerse?.schedule?.id] });
    },
  });

  const prayerMutation = useMutation({
    mutationFn: api.createPrayerRequest,
    onSuccess: () => {
      setPrayerTitle('');
      setPrayerContent('');
      queryClient.invalidateQueries({ queryKey: ['prayer-requests'] });
      queryClient.invalidateQueries({ queryKey: ['user-progress'] });
    },
  });

  useEffect(() => {
    if (dailyVerse?.schedule?.id) {
      const readKey = `read-verse-${dailyVerse.schedule.id}`;
      setIsRead(localStorage.getItem(readKey) === 'true');
    }
  }, [dailyVerse]);

  const fallbackVerse: DailyVerse = {
    schedule: {
      id: 'fallback',
      date: new Date().toISOString().split('T')[0],
      verseId: 0,
      mode: 'manual',
    },
    verse: {
      id: 0,
      bookId: 19,
      chapter: DEFAULT_FALLBACK_VERSE.chapter,
      verseNumber: DEFAULT_FALLBACK_VERSE.verseNumber,
      text: DEFAULT_FALLBACK_VERSE.text,
      translation: DEFAULT_FALLBACK_VERSE.translation,
    },
    book: {
      id: 19,
      name: DEFAULT_FALLBACK_VERSE.book,
      abbreviation: 'Ps',
      testament: 'old',
    },
  };

  const handleMarkRead = async () => {
    if (!dailyVerse?.schedule?.id) return;
    setIsRead(true);
    localStorage.setItem(`read-verse-${dailyVerse.schedule.id}`, 'true');
    try {
      await api.markAsRead(dailyVerse.schedule.id);
      queryClient.invalidateQueries({ queryKey: ['user-progress'] });
    } catch (err) {
      console.error('Failed to report reading completion to API:', err);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-12 h-12 border-[3px] border-brand-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-white/40 text-sm">Fetching today&apos;s verse...</p>
      </div>
    );
  }

  const currentVerse = error ? fallbackVerse : dailyVerse || fallbackVerse;
  const showRelated = !!dailyVerse?.verse?.id && dailyVerse.verse.id !== 0;
  const isFavorite = !!favoritesData?.favorites.some((favorite) => favorite.verseId === currentVerse.verse.id);

  const handleToggleFavorite = () => {
    if (!currentVerse.verse.id) return;
    if (isFavorite) {
      removeFavoriteMutation.mutate(currentVerse.verse.id);
    } else {
      addFavoriteMutation.mutate(currentVerse.verse.id);
    }
  };

  const handleSaveReflection = () => {
    if (!currentVerse.verse.id || !reflection.trim()) return;
    reflectionMutation.mutate({
      verseId: currentVerse.verse.id,
      verseScheduleId: currentVerse.schedule.id !== 'fallback' ? currentVerse.schedule.id : undefined,
      content: reflection,
    });
  };

  const handleSavePrayer = () => {
    if (!prayerTitle.trim() || !prayerContent.trim()) return;
    prayerMutation.mutate({ title: prayerTitle, content: prayerContent, type: 'request', isAnonymous: false });
  };

  const handleSpeak = () => {
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    const textToSpeak = `Today's Scripture: ${currentVerse.book.name} chapter ${currentVerse.verse.chapter} verse ${currentVerse.verse.verseNumber}. ${currentVerse.verse.text}. ${
      currentVerse.schedule.pastoralNote ? `Bishop's Devotional Note: ${currentVerse.schedule.pastoralNote}` : ''
    }`;

    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    const voices = window.speechSynthesis.getVoices();
    const englishVoice = voices.find(v => v.lang.startsWith('en') && v.name.includes('Google')) || voices.find(v => v.lang.startsWith('en'));
    if (englishVoice) {
      utterance.voice = englishVoice;
    }

    utterance.rate = 0.95;
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className="py-4 relative min-h-[calc(100vh-8rem)]">
      {/* Greeting */}
      <div className="mb-8 animate-fade-in flex justify-between items-end gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1">Today&apos;s Verse</h2>
          <p className="text-white/40 text-xs sm:text-sm">Take a moment to reflect on God&apos;s word.</p>
        </div>
        <button
          onClick={handleSpeak}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all border shrink-0 ${
            isSpeaking
              ? 'bg-amber-500/10 border-amber-500/30 text-amber-400 animate-pulse-soft'
              : 'bg-white/5 border-white/10 hover:bg-white/10 text-white/60 hover:text-white/90'
          }`}
        >
          {isSpeaking ? (
            <>
              <svg className="w-4 h-4 fill-current animate-pulse-soft" viewBox="0 0 24 24">
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
              </svg>
              Stop Audio
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"/>
              </svg>
              Listen Devotional
            </>
          )}
        </button>
      </div>

      {/* Verse Display */}
      <VerseCard
        dailyVerse={currentVerse}
        onMarkRead={handleMarkRead}
        isRead={isRead}
        isFavorite={isFavorite}
        onToggleFavorite={currentVerse.verse.id ? handleToggleFavorite : undefined}
      />

      {/* Bishop's Devotional Note */}
      {currentVerse.schedule.pastoralNote && (
        <div className="mt-6 glass-card p-5 border-l-4 border-l-amber-500 animate-slide-up relative overflow-hidden">
          <div className="absolute -right-4 -bottom-4 opacity-[0.03] pointer-events-none">
            <svg className="w-24 h-24 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
            </svg>
          </div>
          <div className="flex items-center gap-3 mb-2.5">
            <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-amber-500 to-yellow-600 flex items-center justify-center font-bold text-white text-xs shadow-md">
              Bp
            </div>
            <div>
              <h4 className="text-xs font-bold text-white/50 uppercase tracking-widest">Bishop's Devotional Note</h4>
              <p className="text-[9px] text-brand-400 font-semibold">Victory Tabernacle</p>
            </div>
          </div>
          <p className="text-xs text-white/80 leading-relaxed italic pr-2 whitespace-pre-line">
            "{currentVerse.schedule.pastoralNote}"
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 mt-6">
        <div className="glass-card p-4">
          <p className="text-white/40 text-xs uppercase font-semibold tracking-wider">Current Streak</p>
          <p className="text-3xl font-bold text-gradient mt-1">{progress?.currentStreak ?? 0}</p>
          <p className="text-white/30 text-xs mt-1">days</p>
        </div>
        <div className="glass-card p-4">
          <p className="text-white/40 text-xs uppercase font-semibold tracking-wider">Saved Verses</p>
          <p className="text-3xl font-bold text-gradient mt-1">{progress?.favoriteCount ?? 0}</p>
          <p className="text-white/30 text-xs mt-1">{progress?.openPrayerCount ?? 0} active prayers</p>
        </div>
      </div>

      {/* reflections block */}
      <div className="glass-card p-5 mt-6 space-y-4">
        <div>
          <h3 className="text-white font-bold text-sm">Family Reflections</h3>
          <p className="text-white/30 text-xs mt-1">Capture and share what today&apos;s scripture speaks to your heart.</p>
        </div>
        <div className="flex gap-2">
          <textarea
            value={reflection}
            onChange={(event) => setReflection(event.target.value)}
            rows={2}
            maxLength={250}
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs text-white focus:border-brand-500 focus:outline-none resize-none"
            placeholder="Share your reflection with the church family..."
          />
          <button
            onClick={handleSaveReflection}
            disabled={!reflection.trim() || reflectionMutation.isPending}
            className="bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white font-bold px-4 rounded-xl text-xs active:scale-[0.98] transition-all whitespace-nowrap self-stretch flex items-center justify-center"
          >
            {reflectionMutation.isPending ? 'Sharing...' : 'Share'}
          </button>
        </div>

        {reflectionsData?.reflections && reflectionsData.reflections.length > 0 && (
          <div className="space-y-3 border-t border-white/10 pt-4 mt-2 max-h-[220px] overflow-y-auto pr-1">
            {reflectionsData.reflections.map((ref: any) => (
              <div key={ref.id} className="p-3 rounded-xl bg-white/5 border border-white/5 relative">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-semibold text-brand-400">
                    {ref.user?.displayName || 'Family Member'}
                  </span>
                  {ref.user?.congregation && (
                    <span className="text-[9px] text-white/30">
                      {ref.user.congregation}
                    </span>
                  )}
                </div>
                <p className="text-xs text-white/80 leading-relaxed">
                  {ref.content}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* prayer block */}
      <div className="glass-card p-5 mt-6 space-y-3">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-white font-bold text-sm">Prayer Wall</h3>
            <p className="text-white/30 text-xs mt-1">Post a prayer request or thanksgiving praise to the family wall.</p>
          </div>
          <button
            onClick={() => navigate('/prayers')}
            className="text-brand-400 hover:text-brand-300 text-xs font-semibold"
          >
            View Wall →
          </button>
        </div>
        <input
          value={prayerTitle}
          onChange={(event) => setPrayerTitle(event.target.value)}
          maxLength={120}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs text-white focus:border-brand-500 focus:outline-none"
          placeholder="Prayer title"
        />
        <textarea
          value={prayerContent}
          onChange={(event) => setPrayerContent(event.target.value)}
          rows={2}
          maxLength={2000}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs text-white focus:border-brand-500 focus:outline-none resize-none"
          placeholder="What are you praying about?"
        />
        <button
          onClick={handleSavePrayer}
          disabled={!prayerTitle.trim() || !prayerContent.trim() || prayerMutation.isPending}
          className="btn-secondary w-full text-sm disabled:opacity-50"
        >
          Add to Wall
        </button>
        {prayersData?.prayers?.filter((prayer: any) => prayer.status === 'open').slice(0, 2).map((prayer: any) => (
          <div key={prayer.id} className="border-t border-white/10 pt-3 flex justify-between items-start">
            <div>
              <p className="text-white/70 text-sm font-semibold">{prayer.title}</p>
              <p className="text-white/40 text-xs mt-1 line-clamp-1">{prayer.content}</p>
            </div>
            <span className="text-[9px] bg-white/10 px-1.5 py-0.5 rounded text-white/50">{prayer.user?.displayName || 'Family'}</span>
          </div>
        ))}
      </div>

      {/* Related Scriptures (NLP Recommendations) */}
      {showRelated && (
        <div className="mt-12 animate-slide-up" style={{ animationDelay: '0.1s' }}>
          <div className="flex items-center gap-2 mb-6">
            <svg
              className="w-5 h-5 text-brand-400 animate-pulse-soft"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
              />
            </svg>
            <h3 className="text-lg font-bold text-white tracking-wide">Inspired Connections</h3>
            <span className="text-[10px] bg-brand-500/10 text-brand-400 border border-brand-500/20 px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider">
              AI Recommended
            </span>
          </div>

          {relatedLoading ? (
            <div className="flex items-center justify-center py-10 glass-card">
              <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mr-3" />
              <p className="text-white/40 text-xs">Finding related scriptures...</p>
            </div>
          ) : relatedData?.related && relatedData.related.length > 0 ? (
            <div className="flex flex-col gap-3">
              {relatedData.related.map((item) => (
                <div
                  key={item.verse.id}
                  className="glass-card-hover p-4 relative overflow-hidden flex flex-col sm:flex-row gap-3 sm:gap-4 justify-between sm:items-center group border-l-2 border-l-brand-500/50 hover:border-l-brand-400"
                >
                  {/* Subtle PAOZ Watermark behind each recommendations card */}
                  <div className="absolute inset-0 opacity-[0.02] pointer-events-none flex items-center justify-center p-4">
                    <img src="/church_logo.png" alt="" className="w-full h-full object-contain" />
                  </div>

                  <div className="relative z-10 flex-1 min-w-0 pr-2">
                    <p className="text-sm text-white/80 leading-relaxed italic break-words">
                      &ldquo;{item.verse.text}&rdquo;
                    </p>
                  </div>

                  <div className="relative z-10 flex items-center gap-3 sm:flex-col sm:items-end shrink-0 sm:border-l sm:border-white/10 sm:pl-4 pt-2 sm:pt-0 border-t border-white/5 sm:border-t-0 mt-2 sm:mt-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-brand-400 bg-brand-500/10 px-2 py-0.5 rounded border border-brand-500/20 whitespace-nowrap">
                        {Math.round(item.score * 100)}% Match
                      </span>
                      <span className="text-[10px] text-white/30 uppercase font-bold tracking-widest sm:hidden">
                        {item.verse.translation}
                      </span>
                    </div>
                    <span className="text-xs font-semibold text-white/60 whitespace-nowrap">
                      {item.book.name} {item.verse.chapter}:{item.verse.verseNumber}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="glass-card p-6 text-center">
              <p className="text-white/30 text-sm">No related scriptures found in cache yet.</p>
              <p className="text-white/20 text-xs mt-1">Read more scriptures to populate AI connections!</p>
            </div>
          )}
        </div>
      )}

      {/* History Teaser */}
      <div
        className="mt-10 glass-card-hover p-5 animate-slide-up cursor-pointer"
        style={{ animationDelay: '0.2s' }}
        onClick={() => setShowHistory(true)}
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-white/70 font-semibold text-sm">Past Verses</h3>
            <p className="text-white/30 text-xs mt-0.5">Revisit recent readings</p>
          </div>
          <svg
            className="w-5 h-5 text-white/30 transition-transform group-hover:translate-x-1"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>

      {/* History Drawer/Modal */}
      {showHistory && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-end items-end transition-opacity duration-300">
          {/* Backdrop click closer */}
          <div className="absolute inset-0" onClick={() => setShowHistory(false)} />

          <div className="relative w-full max-w-md bg-neutral-900 border-t border-white/10 rounded-t-3xl p-6 shadow-2xl z-10 animate-slide-up max-h-[85vh] overflow-y-auto">
            {/* Handle bar */}
            <div className="w-12 h-1 bg-white/20 rounded-full mx-auto mb-6" />

            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-white">Verse History</h3>
              <button 
                onClick={() => setShowHistory(false)}
                className="text-white/50 hover:text-white bg-white/5 rounded-full p-2"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {historyLoading ? (
              <div className="flex flex-col items-center justify-center py-10">
                <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mb-3" />
                <p className="text-white/40 text-xs">Loading history...</p>
              </div>
            ) : historyData?.verses && historyData.verses.length > 0 ? (
              <div className="space-y-4 pr-1">
                {historyData.verses.map((pastVerse) => (
                  <div 
                    key={pastVerse.schedule.id}
                    className="p-4 rounded-xl border border-white/5 bg-white/5 hover:bg-white/10 transition-colors"
                  >
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs font-semibold text-brand-400">
                        {new Date(pastVerse.schedule.date).toLocaleDateString(undefined, {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric'
                        })}
                      </span>
                      <span className="text-xs text-white/30 uppercase font-bold tracking-widest">
                        {pastVerse.verse.translation}
                      </span>
                    </div>
                    <p className="text-sm text-white/80 leading-relaxed italic mb-2">
                      &ldquo;{pastVerse.verse.text}&rdquo;
                    </p>
                    <p className="text-xs font-medium text-white/50 text-right">
                      {pastVerse.book.name} {pastVerse.verse.chapter}:{pastVerse.verse.verseNumber}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-10">
                <p className="text-white/30 text-sm">No recent verse history found.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
