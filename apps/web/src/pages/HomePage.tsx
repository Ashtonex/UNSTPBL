import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { DEFAULT_FALLBACK_VERSE } from '@unstpbl/shared';
import VerseCard from '../components/VerseCard';
import type { DailyVerse } from '@unstpbl/shared';

export default function HomePage() {
  const [isRead, setIsRead] = useState(false);

  const {
    data: dailyVerse,
    isLoading,
    error,
  } = useQuery<DailyVerse>({
    queryKey: ['verse-today'],
    queryFn: api.getVerseToday,
    retry: 2,
  });

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
    setIsRead(true);
    // Phase 2: Will call api.markAsRead(dailyVerse.schedule.id)
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-12 h-12 border-[3px] border-brand-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-white/40 text-sm">Fetching today&apos;s verse...</p>
      </div>
    );
  }

  return (
    <div className="py-4">
      {/* Greeting */}
      <div className="mb-8 animate-fade-in">
        <h2 className="text-2xl font-bold text-white mb-1">Today&apos;s Verse</h2>
        <p className="text-white/40 text-sm">Take a moment to reflect on God&apos;s word.</p>
      </div>

      {/* Verse Display */}
      <VerseCard
        dailyVerse={error ? fallbackVerse : dailyVerse || fallbackVerse}
        onMarkRead={handleMarkRead}
        isRead={isRead}
      />

      {/* History Teaser */}
      <div
        className="mt-10 glass-card-hover p-5 animate-slide-up cursor-pointer"
        style={{ animationDelay: '0.2s' }}
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-white/70 font-semibold text-sm">Past Verses</h3>
            <p className="text-white/30 text-xs mt-0.5">Revisit recent readings</p>
          </div>
          <svg
            className="w-5 h-5 text-white/30"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>
    </div>
  );
}
