import { useState, useRef } from 'react';
import type { DailyVerse } from '@unstpbl/shared';
import Tilt3DCard from './3d/Tilt3DCard';
import ParticleBurst from './3d/ParticleBurst';

interface VerseCardProps {
  dailyVerse: DailyVerse;
  onMarkRead?: () => void;
  isRead?: boolean;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
}

export default function VerseCard({
  dailyVerse,
  onMarkRead,
  isRead,
  isFavorite = false,
  onToggleFavorite,
}: VerseCardProps) {
  const [animateRead, setAnimateRead] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [showBurst, setShowBurst] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const { verse, book, schedule } = dailyVerse;

  const handleMarkRead = () => {
    setAnimateRead(true);
    setShowBurst(true);
    onMarkRead?.();
    setTimeout(() => setAnimateRead(false), 600);
  };

  const handleToggleFavWithBurst = () => {
    if (!isFavorite) {
      setShowBurst(true);
    }
    onToggleFavorite?.();
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
    <div className="animate-fade-in relative">
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

      {/* 3D Interactive Spatial Tilt Card */}
      <Tilt3DCard maxTilt={14} scale={1.025} glareOpacity={0.3} className="w-full">
        <div ref={cardRef} className="glass-card p-6 md:p-8 relative overflow-hidden transform-gpu">
          {/* Particle Burst Explosion Layer */}
          <ParticleBurst active={showBurst} onComplete={() => setShowBurst(false)} />

          {/* Depth Layer -10: Background PAOZ Map logo watermark overlay */}
          <div
            className="absolute inset-0 opacity-5 pointer-events-none flex items-center justify-center p-8 transition-transform duration-200"
            style={{ transform: 'translateZ(-10px)' }}
          >
            <img src="/church_logo.png" alt="" className="w-full h-full object-contain" />
          </div>

          {/* Depth Layer 20: Decorative quotation mark */}
          <div
            className="text-brand-500/25 text-6xl font-serif leading-none mb-2 select-none relative z-10 transition-transform duration-200"
            style={{ transform: 'translateZ(20px)' }}
          >
            &ldquo;
          </div>

          {/* Depth Layer 35: Verse Text */}
          <blockquote
            className="verse-text mb-6 pl-2 relative z-10 transition-transform duration-200 drop-shadow-md"
            style={{ transform: 'translateZ(35px)' }}
          >
            {verse.text}
          </blockquote>

          {/* Depth Layer 45: Reference & Badges */}
          <div
            className="flex items-end justify-between relative z-10 transition-transform duration-200"
            style={{ transform: 'translateZ(45px)' }}
          >
            <div>
              <p className="verse-reference">
                {book.name} {verse.chapter}:{verse.verseNumber}
              </p>
              <p className="text-[10px] text-white/40 font-medium uppercase tracking-wider mt-1 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-pulse" />
                Victory Tabernacle City Mutare
              </p>
            </div>
            <span className="text-white/40 text-xs font-semibold px-2.5 py-1 rounded-full bg-white/10 border border-white/10 shadow-sm backdrop-blur-md">
              {verse.translation}
            </span>
          </div>
        </div>
      </Tilt3DCard>

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

        {onToggleFavorite && (
          <button
            onClick={handleToggleFavWithBurst}
            className={`bg-white/10 hover:bg-white/20 active:scale-[0.98] text-white font-semibold py-2 px-4 rounded-xl transition-all duration-200 flex items-center gap-2 border text-sm ${
              isFavorite ? 'border-brand-400/40 text-brand-300' : 'border-white/10'
            }`}
          >
            <svg className="w-5 h-5" fill={isFavorite ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.562.562 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.563.563 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345l2.125-5.111z" />
            </svg>
            {isFavorite ? 'Saved' : 'Save'}
          </button>
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

