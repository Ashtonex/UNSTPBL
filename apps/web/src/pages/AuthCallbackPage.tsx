import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RECOVERY_FLAG, supabase } from '../lib/supabase';

/**
 * AuthCallbackPage
 *
 * Supabase email verification / magic-link / OAuth links all land here
 * in PKCE flow:  https://yourapp.com/auth/callback?code=XXXX
 *
 * The Supabase client's `detectSessionInUrl: true` setting automatically
 * exchanges the ?code for a session — we just need to wait for that exchange
 * and then redirect the user to the home screen.
 */
export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    // getSession() waits for the ?code= exchange to finish, so this resolves as soon as the
    // link has been processed instead of after a fixed delay.
    (async () => {
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (cancelled) return;

      if (data.session) {
        let recovering = false;
        try {
          recovering = sessionStorage.getItem(RECOVERY_FLAG) === '1';
        } catch {
          // Storage blocked: treat as an ordinary sign-in.
        }
        navigate(recovering ? '/login?reset=1' : '/', { replace: true });
      } else {
        setError(
          sessionError?.message ||
            'This link has expired, was already used, or was opened in a different browser from the one you signed up in. Please request a new one.',
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  if (error) {
    return (
      <div className="h-[100dvh] flex flex-col items-center justify-center px-6 bg-surface-950 text-center">
        <div className="text-4xl mb-4">⚠️</div>
        <h2 className="text-white font-bold text-lg mb-2">Link Expired</h2>
        <p className="text-white/50 text-sm mb-6 max-w-xs">{error}</p>
        <button
          onClick={() => navigate('/login', { replace: true })}
          className="px-6 py-3 rounded-xl bg-brand-500 text-white font-semibold text-sm hover:bg-brand-400 transition-colors"
        >
          Back to Sign In
        </button>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] flex flex-col items-center justify-center bg-surface-950">
      <div className="w-10 h-10 border-[3px] border-brand-500 border-t-transparent rounded-full animate-spin mb-4" />
      <p className="text-white/50 text-sm">Verifying your account…</p>
    </div>
  );
}
