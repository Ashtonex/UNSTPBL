import { useState } from 'react';
import type { DailyVerse } from '@unstpbl/shared';

interface VerseCardProps {
  dailyVerse: DailyVerse;
  onMarkRead?: () => void;
  isRead?: boolean;
}

export default function VerseCard({ dailyVerse, onMarkRead, isRead }: VerseCardProps) {
  const [animateRead, setAnimateRead] = useState(false);
  const { verse, book, schedule } = dailyVerse;

  const handleMarkRead = () => {
    setAnimateRead(true);
    onMarkRead?.();
    setTimeout(() => setAnimateRead(false), 600);
  };

  return (
    <div className="animate-fade-in">
      {/* Date Badge */}
      <div className="flex items-center gap-2 mb-6">
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        <span className="text-white/30 text-xs font-medium tracking-widest uppercase">
          {new Date(schedule.date + 'T00:00:00').toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
          })}
        </span>
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      </div>

      {/* Verse Card */}
      <div className="glass-card p-6 md:p-8 animate-slide-up">
        {/* Decorative quotation mark */}
        <div className="text-brand-500/20 text-6xl font-serif leading-none mb-2 select-none">
          &ldquo;
        </div>

        {/* Verse Text */}
        <blockquote className="verse-text mb-6 pl-2">{verse.text}</blockquote>

        {/* Reference */}
        <div className="flex items-center justify-between">
          <p className="verse-reference">
            {book.name} {verse.chapter}:{verse.verseNumber}
          </p>
          <span className="text-white/20 text-xs font-medium px-2 py-1 rounded-full bg-white/5">
            {verse.translation}
          </span>
        </div>
      </div>

      {/* Mark as Read Button */}
      <div className="mt-6 flex justify-center">
        {isRead ? (
          <div className="flex items-center gap-2 text-brand-400 animate-fade-in">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
            <span className="text-sm font-medium">Read</span>
          </div>
        ) : (
          <button
            onClick={handleMarkRead}
            className={`btn-primary flex items-center gap-2 ${
              animateRead ? 'scale-95 opacity-80' : ''
            }`}
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            Mark as Read
          </button>
        )}
      </div>
    </div>
  );
}
