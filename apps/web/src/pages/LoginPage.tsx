import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/auth';

export default function LoginPage() {
  const { user } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) navigate('/', { replace: true });
  }, [user, navigate]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8">
      {/* Ambient glow effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-brand-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-1/3 w-64 h-64 bg-surface-300/10 rounded-full blur-3xl" />
      </div>

      {/* Content */}
      <div className="relative z-10 w-full max-w-sm">
        {/* Logo & Tagline */}
        <div className="text-center mb-10 animate-fade-in">
          <h1 className="text-5xl font-extrabold tracking-tight mb-3">
            <span className="text-gradient">UNSTPBL</span>
          </h1>
          <p className="text-white/40 text-sm font-medium tracking-wide">
            Your daily verse, delivered with purpose.
          </p>
        </div>

        {/* Auth Card */}
        <div className="glass-card p-6 animate-slide-up">
          <Auth
            supabaseClient={supabase}
            appearance={{
              theme: ThemeSupa,
              variables: {
                default: {
                  colors: {
                    brand: '#f59e0b',
                    brandAccent: '#d97706',
                    inputBackground: 'rgba(255, 255, 255, 0.05)',
                    inputBorder: 'rgba(255, 255, 255, 0.1)',
                    inputText: '#ffffff',
                    inputPlaceholder: 'rgba(255, 255, 255, 0.3)',
                    inputLabelText: 'rgba(255, 255, 255, 0.6)',
                    anchorTextColor: '#fbbf24',
                    dividerBackground: 'rgba(255, 255, 255, 0.1)',
                  },
                  borderWidths: {
                    buttonBorderWidth: '0px',
                    inputBorderWidth: '1px',
                  },
                  radii: {
                    borderRadiusButton: '12px',
                    buttonBorderRadius: '12px',
                    inputBorderRadius: '12px',
                  },
                  fontSizes: {
                    baseBodySize: '14px',
                    baseInputSize: '14px',
                    baseLabelSize: '13px',
                    baseButtonSize: '15px',
                  },
                },
              },
            }}
            providers={[]}
            redirectTo={window.location.origin}
          />
        </div>

        {/* Footer */}
        <p className="text-center text-white/20 text-xs mt-8 animate-fade-in">
          &copy; {new Date().getFullYear()} UNSTPBL &middot; Powered by faith
        </p>
      </div>
    </div>
  );
}
