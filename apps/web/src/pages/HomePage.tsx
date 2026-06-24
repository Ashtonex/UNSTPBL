import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { DEFAULT_FALLBACK_VERSE } from '@unstpbl/shared';
import VerseCard from '../components/VerseCard';
import type { DailyVerse } from '@unstpbl/shared';

export default function HomePage() {
  const [isRead, setIsRead] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

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

  return (
    <div className="py-4 relative min-h-[calc(100vh-8rem)]">
      {/* Greeting */}
      <div className="mb-8 animate-fade-in">
        <h2 className="text-2xl font-bold text-white mb-1">Today&apos;s Verse</h2>
        <p className="text-white/40 text-sm">Take a moment to reflect on God&apos;s word.</p>
      </div>

      {/* Verse Display */}
      <VerseCard
        dailyVerse={currentVerse}
        onMarkRead={handleMarkRead}
        isRead={isRead}
      />

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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {relatedData.related.map((item) => (
                <div
                  key={item.verse.id}
                  className="glass-card-hover p-5 relative overflow-hidden flex flex-col justify-between group border-l-2 border-l-brand-500/50 hover:border-l-brand-400"
                >
                  {/* Subtle PAOZ Watermark behind each recommendations card */}
                  <div className="absolute inset-0 opacity-[0.02] pointer-events-none flex items-center justify-center p-4">
                    <img src="/church_logo.png" alt="" className="w-full h-full object-contain" />
                  </div>

                  <div className="relative z-10">
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-[10px] font-bold text-brand-400 bg-brand-500/10 px-2 py-0.5 rounded border border-brand-500/20">
                        {Math.round(item.score * 100)}% Match
                      </span>
                      <span className="text-[10px] text-white/30 uppercase font-bold tracking-widest">
                        {item.verse.translation}
                      </span>
                    </div>

                    <p className="text-sm text-white/80 leading-relaxed italic mb-4">
                      &ldquo;{item.verse.text}&rdquo;
                    </p>
                  </div>

                  <div className="relative z-10 flex justify-between items-end mt-auto pt-2 border-t border-white/5">
                    <span className="text-xs font-semibold text-white/60">
                      {item.book.name} {item.verse.chapter}:{item.verse.verseNumber}
                    </span>
                    
                    {/* Visual similarity meter */}
                    <div className="w-16 h-1 bg-white/10 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-brand-500 to-brand-400" 
                        style={{ width: `${Math.round(item.score * 100)}%` }}
                      />
                    </div>
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
