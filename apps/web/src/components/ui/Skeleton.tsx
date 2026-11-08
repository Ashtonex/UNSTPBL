/** A grey placeholder block that pulses while content loads. Size it with className. */
export function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-xl bg-white/10 ${className}`} />;
}

/** A card-shaped placeholder: a title line and a few text lines. Matches the app's glass cards. */
export function SkeletonCard() {
  return (
    <div aria-hidden="true" className="glass-card p-4 space-y-3">
      <Skeleton className="h-4 w-2/5" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-11/12" />
      <Skeleton className="h-3 w-3/5" />
    </div>
  );
}

/**
 * Placeholders for a list while it loads. Better than a spinner: the page keeps its shape, so
 * nothing jumps when the real content arrives.
 */
export function SkeletonList({ count = 3, label = 'Loading' }: { count?: number; label?: string }) {
  return (
    <div role="status" aria-label={label} className="space-y-3">
      {Array.from({ length: count }, (_, index) => (
        <SkeletonCard key={index} />
      ))}
    </div>
  );
}
