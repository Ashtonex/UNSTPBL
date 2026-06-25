import { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/auth';
import { api } from '../lib/api';
import { usePWA } from '../lib/usePWA';

export default function ProfilePage() {
  const { profile, setProfile } = useAuthStore();
  const { isInstallable, isInstalled, install } = usePWA();
  const [displayName, setDisplayName] = useState('');
  const [congregation, setCongregation] = useState('');
  const [translation, setTranslation] = useState('KJV');
  
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Load profile on mount if not already present
  useEffect(() => {
    const fetchProfile = async () => {
      if (!profile) {
        setIsLoading(true);
        setMessage(null);
        try {
          const { profile: loadedProfile } = await api.getProfile();
          setProfile(loadedProfile);
        } catch (err: any) {
          console.error('Failed to load profile on mount:', err);
          let errMsg = err.message || 'Failed to load profile.';
          if (errMsg.toLowerCase().includes('fetch')) {
            errMsg = 'Connection error: Failed to fetch profile. Please check your internet connection or disable any ad-blockers.';
          }
          setMessage({ text: errMsg, type: 'error' });
        } finally {
          setIsLoading(false);
        }
      }
    };
    fetchProfile();
  }, [profile, setProfile]);

  // Initialize form values from profile state
  useEffect(() => {
    if (profile) {
      setDisplayName(profile.displayName || '');
      setCongregation(profile.congregation || '');
      setTranslation(profile.translation || 'KJV');
    }
  }, [profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage(null);

    try {
      const { profile: updatedProfile } = await api.updateProfile({
        displayName: displayName.trim(),
        congregation: congregation.trim(),
        translation,
      });
      setProfile(updatedProfile);
      setMessage({ text: 'Profile updated successfully!', type: 'success' });
    } catch (err: any) {
      console.error(err);
      let errMsg = err.message || 'Failed to update profile.';
      if (errMsg.toLowerCase().includes('fetch')) {
        errMsg = 'Connection error: Failed to save profile. Please check your internet connection or disable any ad-blockers.';
      }
      setMessage({ text: errMsg, type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto py-4 animate-fade-in">
      <div className="text-center mb-6">
        <h2 className="text-3xl font-extrabold tracking-tight mb-2">
          <span className="text-gradient">Your Profile</span>
        </h2>
        <p className="text-white/40 text-sm">
          Customize your experience and scripture preferences
        </p>
      </div>

      <div className="glass-card p-6 border border-white/5 shadow-2xl relative overflow-hidden">
        {/* Glow accent */}
        <div className="absolute -top-12 -right-12 w-24 h-24 bg-brand-500/10 rounded-full blur-xl pointer-events-none" />

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="w-10 h-10 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-white/40 text-xs">Loading profile details...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {message && (
              <div
                className={`p-3 rounded-xl text-sm font-medium text-center border animate-slide-up ${
                  message.type === 'success'
                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                    : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                }`}
              >
                {message.text}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">
                Email Address
              </label>
              <input
                type="text"
                value={profile?.email || ''}
                disabled
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white/40 cursor-not-allowed outline-none"
              />
              <p className="text-[11px] text-white/30 mt-1">Email cannot be modified.</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">
                Display Name
              </label>
              <input
                type="text"
                placeholder="e.g. John Doe"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-4 py-3 bg-white/5 hover:bg-white/10 focus:bg-white/10 border border-white/10 focus:border-brand-500/50 rounded-xl text-sm text-white outline-none transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">
                Congregation
              </label>
              <input
                type="text"
                placeholder="e.g. Victory Tabernacle Harare"
                value={congregation}
                onChange={(e) => setCongregation(e.target.value)}
                className="w-full px-4 py-3 bg-white/5 hover:bg-white/10 focus:bg-white/10 border border-white/10 focus:border-brand-500/50 rounded-xl text-sm text-white outline-none transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">
                Preferred Bible Translation
              </label>
              <div className="relative">
                <select
                  value={translation}
                  onChange={(e) => setTranslation(e.target.value)}
                  className="w-full px-4 py-3 bg-white/5 hover:bg-white/10 focus:bg-white/10 border border-white/10 focus:border-brand-500/50 rounded-xl text-sm text-white outline-none appearance-none transition-all cursor-pointer"
                >
                  <option value="KJV" className="bg-surface-900 text-white">King James Version (KJV)</option>
                  <option value="ESV" className="bg-surface-900 text-white">English Standard Version (ESV)</option>
                </select>
                <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-white/40">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
              <p className="text-[11px] text-white/30 mt-1">
                Scriptures on the dashboard will dynamically update to this translation.
              </p>
            </div>

            <button
              type="submit"
              disabled={isSaving}
              className={`w-full py-3.5 bg-gradient-to-r from-brand-500 to-amber-600 hover:from-brand-400 hover:to-amber-500 active:scale-[0.98] text-white text-sm font-semibold rounded-xl transition-all shadow-lg shadow-brand-500/20 flex items-center justify-center gap-2 ${
                isSaving ? 'opacity-80 cursor-not-allowed' : ''
              }`}
            >
              {isSaving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Saving Changes...</span>
                </>
              ) : (
                <span>Save Changes</span>
              )}
            </button>
          </form>
        )}
      </div>

      {isInstallable && (
        <div className="glass-card p-6 border border-brand-500/20 mt-6 shadow-2xl relative overflow-hidden animate-slide-up">
          <div className="absolute -bottom-8 -left-8 w-20 h-20 bg-brand-500/10 rounded-full blur-xl pointer-events-none" />
          <h3 className="text-md font-bold text-white mb-2 flex items-center gap-2">
            <svg className="w-5 h-5 text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            Install UNSTPBL App
          </h3>
          <p className="text-white/60 text-xs mb-4 leading-relaxed">
            Install UNSTPBL on your home screen for quick daily access, push notifications, and offline reading support.
          </p>
          <button
            onClick={install}
            className="w-full py-2.5 bg-brand-500 hover:bg-brand-400 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-brand-500/15 animate-pulse"
          >
            Add to Home Screen
          </button>
        </div>
      )}

      {isInstalled && (
        <div className="glass-card p-5 border border-emerald-500/10 mt-6 shadow-xl relative overflow-hidden">
          <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Installed on Device
          </h3>
          <p className="text-white/40 text-[11px] mt-1">
            Running standalone as an installed web app. You'll receive updates automatically.
          </p>
        </div>
      )}
    </div>
  );
}
