import { useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';

type View = 'sign_in' | 'sign_up' | 'forgot_password' | 'update_password';

interface Props {
  /** Start on the "choose a new password" form (arrived from a reset email). */
  recovering?: boolean;
}

const MIN_PASSWORD_LENGTH = 6;

const inputClass =
  // 16px text on purpose: anything smaller makes iOS Safari zoom the page on focus.
  'w-full rounded-xl bg-white/[0.03] border border-white/10 px-4 py-3 text-base text-white ' +
  'placeholder:text-fg-muted focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/30 ' +
  'disabled:opacity-60';

const linkClass =
  'text-brand-300 hover:text-brand-200 underline-offset-2 hover:underline focus-visible:outline-none ' +
  'focus-visible:ring-2 focus-visible:ring-brand-400/50 rounded';

/**
 * Email + password sign-in, sign-up, forgot-password and new-password forms, built
 * directly on supabase.auth. Replaces @supabase/auth-ui-react (~65 kB) and lets the
 * form share the app's own styling.
 *
 * Signing in (and finishing a password reset) changes the Supabase session; the
 * LoginPage and App listeners react to that and navigate, so nothing here redirects.
 */
export default function AuthForm({ recovering = false }: Props) {
  const [view, setView] = useState<View>(recovering ? 'update_password' : 'sign_in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const go = (next: View) => {
    setView(next);
    setError(null);
    setNotice(null);
    setPassword('');
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setError(null);
    setNotice(null);

    if ((view === 'sign_up' || view === 'update_password') && password.length < MIN_PASSWORD_LENGTH) {
      setError(`Your password needs at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }

    setBusy(true);
    try {
      const cleanEmail = email.trim();

      if (view === 'sign_in') {
        const { error: err } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
        if (err) setError(err.message);
      } else if (view === 'sign_up') {
        const { data, error: err } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
        });
        if (err) setError(err.message);
        else if (!data.session) setNotice('Check your email for a link to confirm your account.');
      } else if (view === 'forgot_password') {
        const { error: err } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
          redirectTo: `${window.location.origin}/auth/callback`,
        });
        if (err) setError(err.message);
        else setNotice('If that email has an account, a password reset link is on its way.');
      } else {
        const { error: err } = await supabase.auth.updateUser({ password });
        if (err) setError(err.message);
        // On success Supabase emits USER_UPDATED, which LoginPage listens for.
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const showEmail = view !== 'update_password';
  const showPassword = view !== 'forgot_password';
  const submitLabel = {
    sign_in: 'Sign in',
    sign_up: 'Create account',
    forgot_password: 'Send reset link',
    update_password: 'Save new password',
  }[view];
  const busyLabel = {
    sign_in: 'Signing in…',
    sign_up: 'Creating account…',
    forgot_password: 'Sending…',
    update_password: 'Saving…',
  }[view];

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate={false}>
      {showEmail && (
        <div>
          <label htmlFor="auth-email" className="block text-xs font-medium text-fg-muted mb-1.5">
            Email address
          </label>
          <input
            id="auth-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Your email address"
            className={inputClass}
            disabled={busy}
          />
        </div>
      )}

      {showPassword && (
        <div>
          <label htmlFor="auth-password" className="block text-xs font-medium text-fg-muted mb-1.5">
            {view === 'update_password' ? 'New password' : 'Your password'}
          </label>
          <input
            id="auth-password"
            type="password"
            autoComplete={view === 'sign_in' ? 'current-password' : 'new-password'}
            required
            minLength={view === 'sign_in' ? undefined : MIN_PASSWORD_LENGTH}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={view === 'sign_in' ? 'Your password' : 'Choose a password'}
            className={inputClass}
            disabled={busy}
          />
        </div>
      )}

      <div aria-live="polite" className="empty:hidden">
        {error && (
          <p role="alert" className="text-sm text-red-300 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
            {error}
          </p>
        )}
        {notice && (
          <p className="text-sm text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-2">
            {notice}
          </p>
        )}
      </div>

      <button type="submit" disabled={busy} className="btn-primary w-full disabled:opacity-60 disabled:active:scale-100">
        {busy ? busyLabel : submitLabel}
      </button>

      {view !== 'update_password' && (
        <div className="flex flex-col items-center gap-2 text-sm pt-1">
          {view === 'sign_in' && (
            <>
              <button type="button" className={linkClass} onClick={() => go('forgot_password')}>
                Forgot your password?
              </button>
              <button type="button" className={linkClass} onClick={() => go('sign_up')}>
                Don&apos;t have an account? Sign up
              </button>
            </>
          )}
          {view === 'sign_up' && (
            <button type="button" className={linkClass} onClick={() => go('sign_in')}>
              Already have an account? Sign in
            </button>
          )}
          {view === 'forgot_password' && (
            <button type="button" className={linkClass} onClick={() => go('sign_in')}>
              Back to sign in
            </button>
          )}
        </div>
      )}
    </form>
  );
}
