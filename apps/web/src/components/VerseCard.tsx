import { useState, useRef } from 'react';
import type { DailyVerse } from '@unstpbl/shared';

interface VerseCardProps {
  dailyVerse: DailyVerse;
  onMarkRead?: () => void;
  isRead?: boolean;
}

export default function VerseCard({ dailyVerse, onMarkRead, isRead }: VerseCardProps) {
  const [animateRead, setAnimateRead] = useState(false);
  const [sharing, setSharing] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const { verse, book, schedule } = dailyVerse;

  const handleMarkRead = () => {
    setAnimateRead(true);
    onMarkRead?.();
    setTimeout(() => setAnimateRead(false), 600);
  };

  const handleShareImage = async () => {
    if (!cardRef.current) return;
    setSharing(true);
    try {
      const { toPng } = await import('html-to-image');
      
      const dataUrl = await toPng(cardRef.current, {
        pixelRatio: 2,
        backgroundColor: '#0b0f13',
        style: {
          transform: 'scale(1)',
          borderRadius: '16px',
        }
      });

      const response = await fetch(dataUrl);
      const blob = await response.blob();
      const file = new File([blob], `UNSTPBL-${book.name}-${verse.chapter}-${verse.verseNumber}.png`, { type: 'image/png' });

      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `UNSTPBL - Daily Verse`,
          text: `"${verse.text}" - ${book.name} ${verse.chapter}:${verse.verseNumber}`,
        });
      } else {
        const link = document.createElement('a');
        link.download = `UNSTPBL-${book.name}-${verse.chapter}-${verse.verseNumber}.png`;
        link.href = dataUrl;
        link.click();
      }
    } catch (err) {
      console.error('Failed to generate sharing image:', err);
    } finally {
      setSharing(false);
    }
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
      <div ref={cardRef} className="glass-card p-6 md:p-8 animate-slide-up relative overflow-hidden">
        {/* Background PAOZ Map logo as watermark overlay */}
        <div className="absolute inset-0 opacity-5 pointer-events-none flex items-center justify-center p-8">
          <img src="/church_logo.png" alt="" className="w-full h-full object-contain" />
        </div>

        {/* Decorative quotation mark */}
        <div className="text-brand-500/20 text-6xl font-serif leading-none mb-2 select-none relative z-10">
          &ldquo;
        </div>

        {/* Verse Text */}
        <blockquote className="verse-text mb-6 pl-2 relative z-10">{verse.text}</blockquote>

        {/* Reference */}
        <div className="flex items-end justify-between relative z-10">
          <div>
            <p className="verse-reference">
              {book.name} {verse.chapter}:{verse.verseNumber}
            </p>
            <p className="text-[10px] text-white/30 font-medium uppercase tracking-wider mt-1">
              Victory Tabernacle Harare
            </p>
          </div>
          <span className="text-white/20 text-xs font-medium px-2 py-1 rounded-full bg-white/5">
            {verse.translation}
          </span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="mt-6 flex justify-center gap-4">
        {!isRead && (
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
        
        {isRead && (
          <div className="flex items-center gap-2 text-brand-400 animate-fade-in py-2">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
            <span className="text-sm font-medium">Read</span>
          </div>
        )}

        <button
          onClick={handleShareImage}
          disabled={sharing}
          className="bg-white/10 hover:bg-white/20 active:scale-[0.98] disabled:opacity-50 text-white font-semibold py-2 px-4 rounded-xl transition-all duration-200 flex items-center gap-2 border border-white/10 text-sm"
        >
          {sharing ? (
            <span className="w-4 h-4 border-2 border-white/30 border-t-transparent rounded-full animate-spin" />
          ) : (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 10.742l4.084-2.042m0 6.6l-4.084-2.042M19 12a3 3 0 11-6 0 3 3 0 016 0zM9 6a3 3 0 11-6 0 3 3 0 016 0zm0 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          )}
          Share Verse
        </button>
      </div>
    </div>
  );
}
