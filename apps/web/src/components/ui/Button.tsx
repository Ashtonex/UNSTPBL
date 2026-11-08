import { forwardRef, type ButtonHTMLAttributes } from 'react';
import Spinner from './Spinner';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  /** Shows a spinner, disables the button and tells screen readers it is busy. */
  loading?: boolean;
  fullWidth?: boolean;
}

const BASE =
  'inline-flex items-center justify-center gap-2 rounded-xl font-semibold select-none ' +
  'transition-[background-color,border-color,color,transform,opacity] active:scale-95 ' +
  'disabled:opacity-60 disabled:active:scale-100 disabled:cursor-not-allowed ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/60';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-gradient-to-r from-brand-500 to-brand-400 text-surface hover:from-brand-400 hover:to-brand-300',
  secondary: 'bg-white/5 border border-white/10 text-fg-soft hover:bg-white/10 hover:text-white',
  ghost: 'text-fg-soft hover:bg-white/5 hover:text-white',
  danger: 'bg-red-500/15 border border-red-500/30 text-red-300 hover:bg-red-500/25',
};

// md meets the 44px minimum touch target recommended for phones; sm is for dense rows.
const SIZES: Record<Size, string> = {
  md: 'min-h-[44px] px-5 py-2.5 text-sm',
  sm: 'min-h-[36px] px-3.5 py-1.5 text-xs',
};

/** The app's one button. Prefer this over hand-written bg-brand-500 buttons. */
const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading = false, fullWidth = false, disabled, className = '', children, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`${BASE} ${VARIANTS[variant]} ${SIZES[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...rest}
    >
      {loading && <Spinner label="" />}
      {children}
    </button>
  );
});

export default Button;
