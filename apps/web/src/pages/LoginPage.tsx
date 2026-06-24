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
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8 relative overflow-hidden bg-radial">
      {/* Ambient glowing background bubbles */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[50%] -translate-x-1/2 w-[500px] h-[500px] bg-brand-500/10 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-[-10%] left-[20%] w-[300px] h-[300px] bg-amber-600/5 rounded-full blur-[100px]" />
      </div>

      {/* Content Container */}
      <div className="relative z-10 w-full max-w-md animate-fade-in">
        
        {/* Branding Area */}
        <div className="text-center mb-8">
          <div className="inline-block relative mb-4">
            {/* Logo Glow Ring */}
            <div className="absolute inset-0 bg-brand-500/20 rounded-2xl blur-md scale-105" />
            <img
              src="/church_logo.png"
              alt="Church Logo"
              className="relative z-10 w-20 h-20 rounded-2xl border border-white/10 shadow-2xl object-cover"
            />
          </div>
          <h1 className="text-4xl font-black tracking-tight mb-2">
            <span className="text-gradient">UNSTPBL</span>
          </h1>
          <p className="text-white/40 text-xs font-semibold uppercase tracking-widest">
            Victory Tabernacle Harare
          </p>
          <p className="text-white/30 text-sm mt-1">
            Your daily scripture, delivered with purpose.
          </p>
        </div>

        {/* Glassmorphic Auth Card */}
        <div className="glass-card p-8 border border-white/5 shadow-2xl relative">
          <div className="absolute -top-10 -left-10 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />
          
          <h2 className="text-xl font-bold text-white mb-6 text-center">Sign In / Register</h2>

          <Auth
            supabaseClient={supabase}
            appearance={{
              theme: ThemeSupa,
              variables: {
                default: {
                  colors: {
                    brand: '#f59e0b',
                    brandAccent: '#d97706',
                    inputBackground: 'rgba(255, 255, 255, 0.03)',
                    inputBorder: 'rgba(255, 255, 255, 0.08)',
                    inputText: '#ffffff',
                    inputPlaceholder: 'rgba(255, 255, 255, 0.25)',
                    inputLabelText: 'rgba(255, 255, 255, 0.6)',
                    anchorTextColor: '#fbbf24',
                    dividerBackground: 'rgba(255, 255, 255, 0.08)',
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
                    baseLabelSize: '12px',
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
        <p className="text-center text-white/20 text-xs mt-8">
          &copy; {new Date().getFullYear()} UNSTPBL &middot; Victory Tabernacle
        </p>
      </div>
    </div>
  );
}
