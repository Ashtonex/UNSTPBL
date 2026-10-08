import { useState, useRef, useCallback } from 'react';
import type { DailyVerse } from '@unstpbl/shared';
import Tilt3DCard from './3d/Tilt3DCard';
import ParticleBurst from './3d/ParticleBurst';

interface VerseCardProps {
  dailyVerse: DailyVerse;
  onMarkRead?: () => void;
  isRead?: boolean;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  isSpeaking?: boolean;
  spokenCharIndex?: number | null;
  onToggleSpeak?: () => void;
  selectedReaction?: string;
  onSelectReaction?: (reaction: string) => void;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
  dateLabel?: string;
}

const REACTIONS = [
  { emoji: '🙏', label: 'Amen' },
  { emoji: '❤️', label: 'Loved' },
  { emoji: '🔥', label: 'Fire' },
  { emoji: '✨', label: 'Blessed' },
];

export default function VerseCard({
  dailyVerse,
  onMarkRead,
  isRead,
  isFavorite = false,
  onToggleFavorite,
  isSpeaking = false,
  spokenCharIndex = null,
  onToggleSpeak,
  selectedReaction,
  onSelectReaction,
  onSwipeLeft,
  onSwipeRight,
  hasPrev = false,
  hasNext = false,
  dateLabel,
}: VerseCardProps) {
  const [animateRead, setAnimateRead] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [showBurst, setShowBurst] = useState(false);
  const [burstOrigin, setBurstOrigin] = useState<{ x: number; y: number } | undefined>(undefined);
  const [showDoubleTapBadge, setShowDoubleTapBadge] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);

  // Font size toggle: normal -> large -> xlarge
  const [fontSize, setFontSize] = useState<'normal' | 'large' | 'xlarge'>(() => {
    return (localStorage.getItem('unstpbl_font_size') as 'normal' | 'large' | 'xlarge') || 'normal';
  });

  const cardRef = useRef<HTMLDivElement>(null);
  const lastTapRef = useRef<number>(0);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  const { verse, book, schedule } = dailyVerse;

  // Trigger gentle haptic feedback on mobile if supported
  const triggerHaptic = (pattern: number | number[] = 25) => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(pattern);
      } catch {
        /* haptics are optional */
      }
    }
  };

  const cycleFontSize = () => {
    triggerHaptic(15);
    const next = fontSize === 'normal' ? 'large' : fontSize === 'large' ? 'xlarge' : 'normal';
    setFontSize(next);
    localStorage.setItem('unstpbl_font_size', next);
  };

  const handleMarkRead = () => {
    triggerHaptic([30, 40]);
    setAnimateRead(true);
    setBurstOrigin(undefined);
    setShowBurst(true);
    onMarkRead?.();
    setTimeout(() => setAnimateRead(false), 600);
  };

  const handleToggleFavWithBurst = () => {
    triggerHaptic(25);
    if (!isFavorite) {
      setBurstOrigin(undefined);
      setShowBurst(true);
    }
    onToggleFavorite?.();
  };

  // Double tap card detection for celebration
  const handleCardTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 1) {
      touchStartX.current = e.touches[0].clientX;
      touchStartY.current = e.touches[0].clientY;
    }

    const now = Date.now();
    const DOUBLE_TAP_DELAY = 320;
    if (now - lastTapRef.current < DOUBLE_TAP_DELAY && e.touches.length > 0) {
      // Double tap detected!
      const touch = e.touches[0];
      if (cardRef.current) {
        const rect = cardRef.current.getBoundingClientRect();
        setBurstOrigin({
          x: touch.clientX - rect.left,
          y: touch.clientY - rect.top,
        });
      }
      triggerHaptic([30, 45, 30]);
      setShowBurst(true);
      setShowDoubleTapBadge(true);
      setTimeout(() => setShowDoubleTapBadge(false), 1100);

      if (!isFavorite) {
        onToggleFavorite?.();
      }
    }
    lastTapRef.current = now;
  };

  const handleCardTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (touchStartX.current === null || touchStartY.current === null || e.changedTouches.length === 0) return;
    const diffX = touchStartX.current - e.changedTouches[0].clientX;
    const diffY = touchStartY.current - e.changedTouches[0].clientY;

    // Detect horizontal card swipe (swipe threshold > 65px with low vertical movement)
    if (Math.abs(diffX) > 65 && Math.abs(diffY) < 55) {
      if (diffX > 0 && onSwipeLeft) {
        // Swiped Left
        triggerHaptic(20);
        onSwipeLeft();
      } else if (diffX < 0 && onSwipeRight) {
        // Swiped Right
        triggerHaptic(20);
        onSwipeRight();
      }
    }

    touchStartX.current = null;
    touchStartY.current = null;
  };

  const handleReactionClick = (reactionLabel: string) => {
    triggerHaptic([20, 30]);
    setBurstOrigin(undefined);
    setShowBurst(true);
    onSelectReaction?.(reactionLabel);
  };

  const handleShareImage = async () => {
    if (!cardRef.current) return;
    setSharing(true);
    triggerHaptic(20);
    try {
      const { toPng } = await import('html-to-image');

      const dataUrl = await toPng(cardRef.current, {
        pixelRatio: 2,
        backgroundColor: '#0b0f13',
        style: {
          transform: 'scale(1)',
          borderRadius: '16px',
        },
      });

      const response = await fetch(dataUrl);
      const blob = await response.blob();
      const file = new File([blob], `UNSTPBL-${book.name}-${verse.chapter}-${verse.verseNumber}.png`, {
        type: 'image/png',
      });

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

  // Word-by-word karaoke audio highlighter
  const renderHighlightedVerseText = () => {
    if (!isSpeaking || spokenCharIndex === null || spokenCharIndex === undefined || spokenCharIndex < 0) {
      return verse.text;
    }

    const text = verse.text;
    // Find word boundary around spokenCharIndex
    let start = Math.max(0, Math.min(spokenCharIndex, text.length - 1));
    while (start > 0 && /\S/.test(text[start - 1])) {
      start--;
    }
    let end = start;
    while (end < text.length && /\S/.test(text[end])) {
      end++;
    }

    const before = text.slice(0, start);
    const word = text.slice(start, end);
    const after = text.slice(end);

    return (
      <>
        <span>{before}</span>
        <span className="bg-amber-400/40 text-amber-200 px-1 py-0.5 rounded-md font-semibold ring-2 ring-amber-400/50 shadow-sm inline-block transition-all duration-75">
          {word}
        </span>
        <span>{after}</span>
      </>
    );
  };

  const handleOpenWhatsAppDirect = () => {
    triggerHaptic(20);
    const shareMessage = `📖 *UNSTPBL Daily Scripture*\n\n"${verse.text}"\n— *${book.name} ${verse.chapter}:${verse.verseNumber} (${verse.translation})*\n\n🙏 Victory Tabernacle City Mutare\nRead more & listen: ${window.location.origin}`;
    const encoded = encodeURIComponent(shareMessage);
    window.open(`https://api.whatsapp.com/send?text=${encoded}`, '_blank');
    setShowShareModal(false);
  };

  const fontSizeClass =
    fontSize === 'xlarge'
      ? 'text-3xl md:text-4xl leading-loose font-medium'
      : fontSize === 'large'
      ? 'text-2xl md:text-3xl leading-relaxed font-normal'
      : 'text-xl md:text-2xl leading-relaxed font-normal';

  const formattedDate =
    dateLabel ||
    new Date(schedule.date + 'T00:00:00').toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });

  return (
    <div className="animate-fade-in relative select-none">
      {/* Date Header & Nav Swipe Indicators */}
      <div className="flex items-center justify-between gap-2 mb-4">
        {onSwipeRight ? (
          <button
            onClick={onSwipeRight}
            className={`p-1 text-white/50 hover:text-brand-300 active:scale-95 transition-all ${
              !hasNext ? 'opacity-30 pointer-events-none' : ''
            }`}
            title="Next reading"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        ) : (
          <div className="w-4" />
        )}

        <div className="flex items-center gap-2 flex-1 justify-center">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
          <span className="text-white/60 text-xs font-semibold tracking-widest uppercase truncate max-w-[220px]">
            {formattedDate}
          </span>
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        </div>

        {onSwipeLeft ? (
          <button
            onClick={onSwipeLeft}
            className={`p-1 text-white/50 hover:text-brand-300 active:scale-95 transition-all ${
              !hasPrev ? 'opacity-30 pointer-events-none' : ''
            }`}
            title="Previous reading"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        ) : (
          <div className="w-4" />
        )}
      </div>

      {/* 3D Interactive Spatial Tilt Card */}
      <Tilt3DCard maxTilt={14} scale={1.025} glareOpacity={0.32} className="w-full">
        <div
          ref={cardRef}
          onTouchStart={handleCardTouchStart}
          onTouchEnd={handleCardTouchEnd}
          className="glass-card p-6 md:p-8 relative overflow-hidden transform-gpu"
        >
          {/* Particle Burst Explosion Layer */}
          <ParticleBurst
            active={showBurst}
            originX={burstOrigin?.x}
            originY={burstOrigin?.y}
            onComplete={() => setShowBurst(false)}
          />

          {/* Double-Tap Celebration Pop Badge */}
          {showDoubleTapBadge && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-40 animate-pop-scale">
              <div className="bg-surface-950/90 border border-brand-400/60 text-brand-300 font-extrabold px-5 py-3 rounded-2xl shadow-2xl backdrop-blur-xl flex items-center gap-2 ring-4 ring-brand-500/20">
                <span className="text-2xl animate-spin-slow">✨</span>
                <span className="text-base tracking-wider">Amen! Favorited</span>
                <span className="text-2xl">⭐</span>
              </div>
            </div>
          )}

          {/* Depth Layer -10: Church Watermark */}
          <div
            className="absolute inset-0 opacity-10 pointer-events-none flex items-center justify-center p-8 transition-transform duration-200"
            style={{ transform: 'translateZ(-10px)' }}
          >
            <img src="/church_logo.png" alt="" className="w-full h-full object-contain" />
          </div>

          {/* Top Card Controls: Audio Narration & Font Size Switcher */}
          <div
            className="flex items-center justify-between mb-4 relative z-20 transition-transform duration-200"
            style={{ transform: 'translateZ(25px)' }}
          >
            {/* Audio Listen Pill */}
            {onToggleSpeak ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  triggerHaptic(20);
                  onToggleSpeak();
                }}
                className={`px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-2 transition-all border shadow-sm active:scale-95 ${
                  isSpeaking
                    ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 ring-2 ring-amber-400/30'
                    : 'bg-white/10 hover:bg-white/20 border-white/15 text-white/80 hover:text-white'
                }`}
              >
                {isSpeaking ? (
                  <>
                    <span className="flex items-center gap-0.5">
                      <span className="w-1 h-3 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1 h-4 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '120ms' }} />
                      <span className="w-1 h-2.5 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '240ms' }} />
                    </span>
                    <span className="text-[11px] font-bold">Listening...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                    </svg>
                    <span className="text-[11px]">Listen</span>
                  </>
                )}
              </button>
            ) : (
              <div />
            )}

            {/* Font Size Toggle Button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                cycleFontSize();
              }}
              className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-white/10 hover:bg-white/20 border border-white/15 text-white/80 hover:text-white active:scale-95 transition-all flex items-center gap-1"
              title="Cycle font size (Normal, Large, Extra Large)"
            >
              <span>Aa</span>
              <span className="text-[9px] text-brand-400">
                {fontSize === 'normal' ? '1x' : fontSize === 'large' ? '2x' : '3x'}
              </span>
            </button>
          </div>

          {/* Quotation Mark */}
          <div
            className="text-brand-500/30 text-5xl font-serif leading-none mb-1 select-none relative z-10 transition-transform duration-200"
            style={{ transform: 'translateZ(20px)' }}
          >
            &ldquo;
          </div>

          {/* Verse Text */}
          <blockquote
            className={`verse-text mb-6 pl-2 relative z-10 transition-transform duration-200 drop-shadow-md ${fontSizeClass}`}
            style={{ transform: 'translateZ(35px)' }}
          >
            {renderHighlightedVerseText()}
          </blockquote>

          {/* Reference & Badges */}
          <div
            className="flex items-end justify-between relative z-10 transition-transform duration-200"
            style={{ transform: 'translateZ(45px)' }}
          >
            <div>
              <p className="verse-reference">
                {book.name} {verse.chapter}:{verse.verseNumber}
              </p>
              <p className="text-[10px] text-white/60 font-medium uppercase tracking-wider mt-1 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-pulse" />
                Victory Tabernacle City Mutare
              </p>
            </div>
            <span className="text-white/70 text-xs font-semibold px-2.5 py-1 rounded-full bg-white/10 border border-white/15 shadow-sm backdrop-blur-md">
              {verse.translation}
            </span>
          </div>

          {/* Kid-friendly Double-Tap Hint */}
          <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-[10px] text-white/40">
            <span>✨ Double-tap to celebrate</span>
            {(hasPrev || hasNext) && <span>👈 Swipe to flip readings 👉</span>}
          </div>
        </div>
      </Tilt3DCard>

      {/* Main Action Buttons */}
      <div className="mt-5 flex justify-center gap-3">
        {!isRead && (
          <button
            onClick={handleMarkRead}
            className={`btn-primary flex items-center gap-2 shadow-lg shadow-brand-500/20 ${
              animateRead ? 'scale-95 opacity-80' : ''
            }`}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            Mark as Read
          </button>
        )}

        {isRead && (
          <div className="flex items-center gap-2 text-brand-400 animate-fade-in py-2 px-3 rounded-xl bg-brand-500/10 border border-brand-500/20">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
            <span className="text-sm font-semibold">Completed Today</span>
          </div>
        )}

        {onToggleFavorite && (
          <button
            onClick={handleToggleFavWithBurst}
            className={`bg-white/10 hover:bg-white/20 active:scale-[0.98] text-white font-semibold py-2 px-4 rounded-xl transition-all duration-200 flex items-center gap-2 border text-sm ${
              isFavorite ? 'border-brand-400/40 text-brand-300 bg-brand-500/10' : 'border-white/10'
            }`}
          >
            <svg className="w-5 h-5" fill={isFavorite ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.562.562 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.563.563 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345l2.125-5.111z"
              />
            </svg>
            {isFavorite ? 'Saved' : 'Save'}
          </button>
        )}

        <button
          onClick={() => {
            triggerHaptic(20);
            setShowShareModal(true);
          }}
          className="bg-white/10 hover:bg-white/20 active:scale-[0.98] text-white font-semibold py-2 px-4 rounded-xl transition-all duration-200 flex items-center gap-2 border border-white/10 text-sm"
        >
          <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 10.742l4.084-2.042m0 6.6l-4.084-2.042M19 12a3 3 0 11-6 0 3 3 0 016 0zM9 6a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Share
        </button>
      </div>

      {/* Quick 1-Tap Family Reactions */}
      <div className="mt-6 flex flex-col items-center gap-2">
        <p className="text-[11px] uppercase tracking-widest text-white/50 font-bold flex items-center gap-1.5">
          <span>React to Today&apos;s Scripture</span>
        </p>
        <div className="flex items-center justify-center gap-2 flex-wrap">
          {REACTIONS.map((r) => {
            const reactionKey = `${r.emoji} ${r.label}`;
            const isSelected = selectedReaction === reactionKey;
            return (
              <button
                key={r.label}
                onClick={() => handleReactionClick(reactionKey)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all active:scale-95 flex items-center gap-1.5 border shadow-sm ${
                  isSelected
                    ? 'bg-brand-500/25 border-brand-400 text-brand-300 ring-2 ring-brand-400/40 shadow-lg shadow-brand-500/20 scale-105'
                    : 'bg-white/5 border-white/10 hover:bg-white/10 text-white/80 hover:text-white'
                }`}
              >
                <span className="text-sm">{r.emoji}</span>
                <span>{r.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* WhatsApp & Social Share Modal */}
      {showShareModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in">
          <div className="bg-surface-950 border border-white/15 rounded-3xl p-6 w-full max-w-sm shadow-2xl relative animate-pop-scale">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-xl">✨</span>
                <h3 className="text-lg font-bold text-white">Share Scripture</h3>
              </div>
              <button
                onClick={() => setShowShareModal(false)}
                className="p-1.5 rounded-full bg-white/5 text-white/60 hover:text-white"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-white/70 mb-5 leading-relaxed">
              Spread God's word with family and friends across WhatsApp, Instagram, or download a card.
            </p>

            <div className="space-y-3">
              {/* 1-Tap WhatsApp Share */}
              <button
                onClick={handleOpenWhatsAppDirect}
                className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 font-bold text-sm transition-all active:scale-[0.98]"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">💬</span>
                  <div className="text-left">
                    <p className="font-extrabold text-white text-sm">Send to WhatsApp</p>
                    <p className="text-[11px] text-emerald-300/80 font-normal">Opens WhatsApp with verse ready to send</p>
                  </div>
                </div>
                <span>→</span>
              </button>

              {/* Download Story Card Image */}
              <button
                onClick={async () => {
                  setShowShareModal(false);
                  await handleShareImage();
                }}
                disabled={sharing}
                className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/15 text-white font-bold text-sm transition-all active:scale-[0.98]"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">📸</span>
                  <div className="text-left">
                    <p className="font-extrabold text-white text-sm">Instagram / Status Card</p>
                    <p className="text-[11px] text-white/60 font-normal">Generate styled 2x HD story image</p>
                  </div>
                </div>
                {sharing ? (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <span>📥</span>
                )}
              </button>
            </div>

            <div className="mt-5 pt-3 border-t border-white/10 text-center">
              <button
                onClick={() => setShowShareModal(false)}
                className="text-xs text-white/50 hover:text-white transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
