import { useEffect, useMemo, useState } from 'react';
import { useAuthStore } from '../stores/auth';
import { api } from '../lib/api';
import { usePWA } from '../lib/usePWA';

function initials(name?: string | null, email?: string) {
  const label = name?.trim() || email || 'Member';
  return label
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'M';
}

export default function ProfilePage() {
  const { profile, setProfile } = useAuthStore();
  const { isInstallable, isInstalled, install } = usePWA();
  const [displayName, setDisplayName] = useState('');
  const [congregation, setCongregation] = useState('');
  const [translation, setTranslation] = useState('KJV');
  const [bio, setBio] = useState('');
  const [phone, setPhone] = useState('');
  const [location, setLocation] = useState('');
  const [birthday, setBirthday] = useState('');
  const [birthdayVisibility, setBirthdayVisibility] = useState<'members' | 'private'>('members');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      if (profile) return;

      setIsLoading(true);
      setMessage(null);
      try {
        const { profile: loadedProfile } = await api.getProfile();
        setProfile(loadedProfile);
      } catch (err: any) {
        setMessage({ text: err.message || 'Failed to load profile.', type: 'error' });
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfile();
  }, [profile, setProfile]);

  useEffect(() => {
    if (!profile) return;

    setDisplayName(profile.displayName || '');
    setCongregation(profile.congregation || '');
    setTranslation(profile.translation || 'KJV');
    setBio(profile.bio || '');
    setPhone(profile.phone || '');
    setLocation(profile.location || '');
    setBirthday(profile.birthday || '');
    setBirthdayVisibility(profile.birthdayVisibility || 'members');
    setAvatarUrl(profile.avatarUrl || '');
  }, [profile]);

  const completion = useMemo(() => {
    const fields = [displayName, congregation, bio, phone, location, birthday, avatarUrl];
    return Math.round((fields.filter((field) => field.trim().length > 0).length / fields.length) * 100);
  }, [avatarUrl, bio, birthday, congregation, displayName, location, phone]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage(null);

    try {
      const { profile: updatedProfile } = await api.updateProfile({
        displayName: displayName.trim(),
        congregation: congregation.trim(),
        translation,
        bio: bio.trim(),
        phone: phone.trim(),
        location: location.trim(),
        birthday: birthday || null,
        birthdayVisibility,
        avatarUrl: avatarUrl.trim(),
      });
      setProfile(updatedProfile);
      setMessage({ text: 'Profile saved. Birthday automation will use your latest details.', type: 'success' });
    } catch (err: any) {
      setMessage({ text: err.message || 'Failed to update profile.', type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="w-full max-w-lg mx-auto py-4 animate-fade-in space-y-5">
      <section className="glass-card border border-white/10 overflow-hidden">
        <div className="h-28 bg-gradient-to-r from-brand-500/40 via-amber-500/30 to-emerald-500/30" />
        <div className="px-5 pb-5 -mt-12">
          <div className="flex items-end gap-4">
            <div className="w-24 h-24 rounded-2xl bg-surface-900 border-4 border-surface-950 overflow-hidden flex items-center justify-center shadow-xl">
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-2xl font-black text-brand-300">{initials(displayName, profile?.email)}</span>
              )}
            </div>
            <div className="min-w-0 pb-2">
              <h2 className="text-2xl font-extrabold text-white truncate">{displayName || 'Your name'}</h2>
              <p className="text-sm text-white/50 truncate">{congregation || 'Congregation not set'}</p>
            </div>
          </div>

          <p className="text-white/70 text-sm mt-4 leading-relaxed">
            {bio || 'Add a short bio so church family members know how to connect with you.'}
          </p>

          <div className="mt-5">
            <div className="flex justify-between text-xs text-white/50 mb-2">
              <span>Profile completion</span>
              <span>{completion}%</span>
            </div>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-brand-400 rounded-full transition-all" style={{ width: `${completion}%` }} />
            </div>
          </div>
        </div>
      </section>

      <section className="glass-card p-5 border border-white/10">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="w-10 h-10 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-white/40 text-xs">Loading profile details...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {message && (
              <div
                className={`p-3 rounded-xl text-sm font-medium border ${
                  message.type === 'success'
                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                    : 'bg-rose-500/10 border-rose-500/20 text-rose-300'
                }`}
              >
                {message.text}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="block">
                <span className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">Display Name</span>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Full name"
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 focus:border-brand-500/60 rounded-xl text-sm text-white outline-none"
                />
              </label>

              <label className="block">
                <span className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">Congregation</span>
                <input
                  type="text"
                  value={congregation}
                  onChange={(e) => setCongregation(e.target.value)}
                  placeholder="Victory Tabernacle"
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 focus:border-brand-500/60 rounded-xl text-sm text-white outline-none"
                />
              </label>
            </div>

            <label className="block">
              <span className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">Bio</span>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Share your ministry, family, testimony, or how people can pray with you."
                maxLength={500}
                rows={4}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 focus:border-brand-500/60 rounded-xl text-sm text-white outline-none resize-none"
              />
              <span className="block text-[11px] text-white/30 mt-1">{bio.length}/500</span>
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="block">
                <span className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">Phone</span>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+263..."
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 focus:border-brand-500/60 rounded-xl text-sm text-white outline-none"
                />
              </label>

              <label className="block">
                <span className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">Location</span>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="City or area"
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 focus:border-brand-500/60 rounded-xl text-sm text-white outline-none"
                />
              </label>
            </div>

            <label className="block">
              <span className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">Avatar Image URL</span>
              <input
                type="url"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="https://..."
                className="w-full px-4 py-3 bg-white/5 border border-white/10 focus:border-brand-500/60 rounded-xl text-sm text-white outline-none"
              />
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="block">
                <span className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">Birthday</span>
                <input
                  type="date"
                  value={birthday}
                  onChange={(e) => setBirthday(e.target.value)}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 focus:border-brand-500/60 rounded-xl text-sm text-white outline-none"
                />
              </label>

              <label className="block">
                <span className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">Birthday Visibility</span>
                <select
                  value={birthdayVisibility}
                  onChange={(e) => setBirthdayVisibility(e.target.value as 'members' | 'private')}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 focus:border-brand-500/60 rounded-xl text-sm text-white outline-none"
                >
                  <option value="members" className="bg-surface-900 text-white">Members can celebrate</option>
                  <option value="private" className="bg-surface-900 text-white">Keep private</option>
                </select>
              </label>
            </div>

            <label className="block">
              <span className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">Preferred Bible Translation</span>
              <select
                value={translation}
                onChange={(e) => setTranslation(e.target.value)}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 focus:border-brand-500/60 rounded-xl text-sm text-white outline-none"
              >
                <option value="KJV" className="bg-surface-900 text-white">King James Version (KJV)</option>
                <option value="ESV" className="bg-surface-900 text-white">English Standard Version (ESV)</option>
              </select>
            </label>

            <button
              type="submit"
              disabled={isSaving}
              className="w-full py-3.5 bg-gradient-to-r from-brand-500 to-amber-600 hover:from-brand-400 hover:to-amber-500 active:scale-[0.98] text-white text-sm font-semibold rounded-xl transition-all shadow-lg shadow-brand-500/20 disabled:opacity-70"
            >
              {isSaving ? 'Saving Profile...' : 'Save Profile'}
            </button>
          </form>
        )}
      </section>

      {(isInstallable || isInstalled) && (
        <section className="glass-card p-5 border border-white/10">
          <h3 className="text-sm font-bold text-white mb-2">{isInstalled ? 'Installed on Device' : 'Install UNSTPBL App'}</h3>
          <p className="text-white/50 text-xs mb-4">
            {isInstalled
              ? 'Running standalone as an installed web app with automatic updates.'
              : 'Install the app for quick access, offline reading, and birthday push notifications.'}
          </p>
          {isInstallable && (
            <button onClick={install} className="w-full py-2.5 bg-brand-500 hover:bg-brand-400 text-white text-xs font-bold rounded-xl">
              Add to Home Screen
            </button>
          )}
        </section>
      )}
    </div>
  );
}
