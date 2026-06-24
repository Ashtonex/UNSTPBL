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
