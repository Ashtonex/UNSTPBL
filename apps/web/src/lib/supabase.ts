import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase configuration. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    flowType: 'pkce',
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});

// A password-reset email link signs the person in with a one-time session, but Supabase only
// announces that once, at start-up, before any page is mounted to hear it. Remember it, and
// send them to the "choose a new password" form, wherever the link happened to land.
export const RECOVERY_FLAG = 'unstpbl-password-recovery';

supabase.auth.onAuthStateChange((event) => {
  if (event === 'SIGNED_OUT') {
    try {
      sessionStorage.removeItem(RECOVERY_FLAG);
    } catch {
      // Nothing to clean up.
    }
    return;
  }
  if (event !== 'PASSWORD_RECOVERY') return;
  try {
    sessionStorage.setItem(RECOVERY_FLAG, '1');
  } catch {
    // Storage blocked: the redirect below still gets them to the form.
  }
  if (window.location.pathname !== '/login') window.location.replace('/login?reset=1');
});
