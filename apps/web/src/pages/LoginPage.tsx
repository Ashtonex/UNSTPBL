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
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8 relative overflow-hidden bg-surface-950">
      {/* Alive Background Image Layer */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <img
          src="/background_eagle.png"
          alt="Eagle Background"
          className="w-full h-full object-cover animate-bg-alive"
        />
        <div className="absolute inset-0 bg-radial-vignette-login" />
      </div>

      {/* Ambient glowing background bubble */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute top-[-10%] left-[50%] -translate-x-1/2 w-[500px] h-[500px] bg-brand-500/10 rounded-full blur-[120px] animate-pulse" />
      </div>

      {/* Content Container */}
      <div className="relative z-10 w-full max-w-md animate-fade-in">
        
        {/* Branding Area */}
        <div className="text-center mb-6">
          <div className="inline-block mb-4">
            <img
              src="/church_logo.png"
              alt="Church Logo"
              className="w-16 h-16 mx-auto object-contain"
            />
          </div>
          <h1 className="text-4xl font-black tracking-tight mb-1">
            <span className="text-gradient">UNSTPBL</span>
          </h1>
          <p className="text-white/40 text-xs font-semibold uppercase tracking-widest">
            Victory Tabernacle City Mutare
          </p>
          <p className="text-white/30 text-sm mt-1">
            Your daily scripture, delivered with purpose.
          </p>
        </div>

        {/* Glassmorphic Auth Card */}
        <div className="glass-card p-8 border border-white/5 shadow-2xl relative">
          <div className="absolute -top-10 -left-10 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />
          
          <h2 className="text-lg font-bold text-white mb-6 text-center">Sign In / Register</h2>

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

        {/* Social Media Row */}
        <div className="mt-8 flex items-center justify-center gap-4 animate-slide-up" style={{ animationDelay: '0.1s' }}>
          {/* Facebook */}
          <a href="#" className="w-10 h-10 rounded-full bg-white/5 hover:bg-brand-500/20 border border-white/10 hover:border-brand-500/30 flex items-center justify-center text-white/60 hover:text-white transition-all duration-300 shadow-md">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M9 8H7v3h2v9h3v-9h2.72l.42-3H12V6.5a1 1 0 0 1 1-1h1.5V2H12a3.5 3.5 0 0 0-3.5 3.5z" />
            </svg>
          </a>

          {/* Instagram */}
          <a href="#" className="w-10 h-10 rounded-full bg-white/5 hover:bg-brand-500/20 border border-white/10 hover:border-brand-500/30 flex items-center justify-center text-white/60 hover:text-white transition-all duration-300 shadow-md">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
              <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
              <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
              <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
            </svg>
          </a>

          {/* YouTube */}
          <a href="#" className="w-10 h-10 rounded-full bg-white/5 hover:bg-brand-500/20 border border-white/10 hover:border-brand-500/30 flex items-center justify-center text-white/60 hover:text-white transition-all duration-300 shadow-md">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M23.498 6.163a3.003 3.003 0 0 0-2.11-2.11C19.517 3.545 12 3.545 12 3.545s-7.517 0-9.388.508a3.003 3.003 0 0 0-2.11 2.11C0 8.033 0 12 0 12s0 3.967.502 5.837a3.003 3.003 0 0 0 2.11 2.11c1.871.508 9.388.508 9.388.508s7.517 0 9.388-.508a3.003 3.003 0 0 0 2.11-2.11C24 15.967 24 12 24 12s0-3.967-.502-5.837zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
            </svg>
          </a>

          {/* X (Twitter) */}
          <a href="#" className="w-10 h-10 rounded-full bg-white/5 hover:bg-brand-500/20 border border-white/10 hover:border-brand-500/30 flex items-center justify-center text-white/60 hover:text-white transition-all duration-300 shadow-md">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
          </a>

          {/* WhatsApp */}
          <a href="#" className="w-10 h-10 rounded-full bg-white/5 hover:bg-brand-500/20 border border-white/10 hover:border-brand-500/30 flex items-center justify-center text-white/60 hover:text-white transition-all duration-300 shadow-md">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path fillRule="evenodd" d="M12.015 2c-5.51 0-9.99 4.478-9.99 9.99 0 2.08.637 4.11 1.825 5.855L2.015 22l4.29-1.787a9.89 9.89 0 0 0 5.71 1.777h.005c5.51 0 9.99-4.479 9.99-9.99A9.99 9.99 0 0 0 12.015 2zm5.83 14.195c-.32.775-1.56 1.485-2.215 1.56-.58.07-1.305.12-3.815-.92-3.21-1.335-5.23-4.6-5.39-4.815-.16-.215-1.285-1.705-1.285-3.255 0-1.55.81-2.305 1.095-2.61.285-.305.625-.38.835-.38.21 0 .425.005.61.01.195.005.46-.07.72.56.265.64.905 2.21.985 2.37.08.16.135.35.03.56-.105.21-.16.34-.32.525-.16.18-.335.405-.48.545-.16.155-.325.32-.14.64.18.31.81 1.335 1.745 2.165.935.83 1.725 1.085 2.05 1.25.32.165.51.135.7-.08.19-.215.81-.94.97-1.26.16-.32.32-.265.54-.185.22.08 1.4.66 1.64.78.24.12.4.18.46.28.06.1.06.58-.26 1.355z" clipRule="evenodd" />
            </svg>
          </a>
        </div>

        {/* Footer */}
        <p className="text-center text-white/20 text-xs mt-8">
          &copy; {new Date().getFullYear()} UNSTPBL &middot; Victory Tabernacle
        </p>
      </div>
    </div>
  );
}
