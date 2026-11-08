import type { ReactNode } from 'react';

type Tone = 'error' | 'success' | 'info' | 'warning';

const TONES: Record<Tone, string> = {
  error: 'bg-red-500/10 border-red-500/30 text-red-300',
  success: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300',
  info: 'bg-sky-500/10 border-sky-500/30 text-sky-200',
  warning: 'bg-amber-500/10 border-amber-500/30 text-amber-200',
};

/**
 * An inline message box. Errors are announced to screen readers straight away (role="alert");
 * the other tones are announced politely (role="status").
 */
export default function Notice({
  tone = 'info',
  children,
  className = '',
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={`p-4 border rounded-xl text-sm leading-relaxed ${TONES[tone]} ${className}`}
    >
      {children}
    </div>
  );
}
