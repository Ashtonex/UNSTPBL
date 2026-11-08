interface SpinnerProps {
  /** Tailwind size classes, e.g. "w-4 h-4". Defaults to a small inline spinner. */
  className?: string;
  /** Read out by screen readers. Pass an empty string when the surrounding text already says it. */
  label?: string;
}

/** A small spinning ring that takes its colour from the surrounding text. */
export default function Spinner({ className = 'w-4 h-4', label = 'Loading' }: SpinnerProps) {
  return (
    <span
      role={label ? 'status' : undefined}
      aria-label={label || undefined}
      aria-hidden={label ? undefined : true}
      className={`inline-block shrink-0 rounded-full border-2 border-current border-t-transparent animate-spin ${className}`}
    />
  );
}
