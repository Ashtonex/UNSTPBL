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
  const [avatarError, setAvatarError] = useState(false);
  const [isResolvingUrl, setIsResolvingUrl] = useState(false);
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
    setAvatarError(false);
  }, [profile]);

  // Handle local photo upload (converts & compresses to high-res WebP/JPEG data URL)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setMessage({ text: 'Please select a valid image file (PNG, JPG, or WebP).', type: 'error' });
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        // Create a small square thumbnail on canvas. The photo is stored as a data
        // URL in the profile (and returned with every profile/birthday-wall call),
        // so keep it small: 192px is plenty for an avatar and lands around 8-14 kB.
        const canvas = document.createElement('canvas');
        const MAX_DIM = 192;
        const width = img.width;
        const height = img.height;

        // Crop center square
        const minDim = Math.min(width, height);
        const startX = (width - minDim) / 2;
        const startY = (height - minDim) / 2;

        const targetDim = Math.min(minDim, MAX_DIM);
        canvas.width = targetDim;
        canvas.height = targetDim;

        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, startX, startY, minDim, minDim, 0, 0, targetDim, targetDim);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.72);
          setAvatarUrl(dataUrl);
          setAvatarError(false);
          setMessage({ text: 'Photo loaded! Click "Save Profile" to keep changes.', type: 'success' });
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Convert Pinterest web links into direct image thumbnail URLs if possible
  const handleAvatarUrlChange = async (url: string) => {
    setAvatarUrl(url);
    setAvatarError(false);

    const trimmed = url.trim();
    if (!trimmed) return;

    // Detect if user pasted a Pinterest page URL instead of direct image URL
    if (trimmed.includes('pinterest.com/pin/') && !trimmed.match(/\.(jpg|jpeg|png|webp)/i)) {
      setIsResolvingUrl(true);
      try {
        const oembedUrl = `https://www.pinterest.com/oembed.json?url=${encodeURIComponent(trimmed)}`;
        const res = await fetch(oembedUrl);
        if (res.ok) {
          const data = await res.json();
          if (data.thumbnail_url) {
            // High-res version of Pinterest thumbnail (replace /236x/ with /736x/ or /originals/)
            const highRes = data.thumbnail_url.replace('/236x/', '/736x/');
            setAvatarUrl(highRes);
            setMessage({ text: 'Auto-converted Pinterest link to direct image!', type: 'success' });
          }
        }
      } catch (err) {
        console.warn('Could not auto-resolve Pinterest oEmbed:', err);
      } finally {
        setIsResolvingUrl(false);
      }
    }
  };

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
            <div className="w-24 h-24 rounded-2xl bg-surface-900 border-4 border-surface-950 overflow-hidden flex items-center justify-center shadow-xl relative group">
              {avatarUrl && !avatarError ? (
                <img
                  src={avatarUrl}
                  alt={displayName || 'Profile'}
                  referrerPolicy="no-referrer"
                  onError={() => setAvatarError(true)}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-2xl font-black text-brand-300">{initials(displayName, profile?.email)}</span>
              )}
              {/* Quick camera upload button on top of avatar preview */}
              <label
                htmlFor="avatar-file-upload"
                className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center cursor-pointer transition-opacity text-white text-[10px] font-bold gap-1"
                title="Upload Photo"
              >
                <span>📷</span>
                <span>Change</span>
              </label>
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

            {avatarError && (
              <div className="p-3.5 rounded-xl text-xs bg-amber-500/15 border border-amber-500/40 text-amber-200 flex items-start gap-2.5 shadow-md">
                <span className="text-lg shrink-0">⚠️</span>
                <div>
                  <p className="font-bold text-amber-100">The link entered is a webpage, not an image file.</p>
                  <p className="opacity-90 mt-1 leading-relaxed">
                    Pinterest pin pages (like <code>pinterest.com/pin/...</code>) cannot load directly inside an image tag. You can upload your picture directly from your device below, or right-click the Pinterest picture and choose <strong>"Copy Image Address"</strong>.
                  </p>
                </div>
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

            {/* Profile Avatar Section: Direct Upload & URL */}
            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-3">
              <div className="flex items-center justify-between">
                <span className="block text-xs font-bold text-white/80 uppercase tracking-wider">
                  Profile Photo / Avatar
                </span>
                {avatarUrl && (
                  <button
                    type="button"
                    onClick={() => {
                      setAvatarUrl('');
                      setAvatarError(false);
                    }}
                    className="text-[11px] text-rose-400 hover:text-rose-300 underline"
                  >
                    Remove Photo
                  </button>
                )}
              </div>

              {/* Upload directly from device */}
              <div>
                <input
                  id="avatar-file-upload"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <label
                  htmlFor="avatar-file-upload"
                  className="w-full py-2.5 px-4 rounded-xl bg-white/10 hover:bg-white/15 active:scale-[0.99] border border-white/15 text-white text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-all"
                >
                  <span>📷</span>
                  <span>Upload Photo from Phone / Computer</span>
                </label>
              </div>

              <div className="flex items-center gap-2 my-2">
                <div className="h-px flex-1 bg-white/10" />
                <span className="text-[10px] text-white/40 uppercase tracking-widest font-bold">Or paste direct link</span>
                <div className="h-px flex-1 bg-white/10" />
              </div>

              <div>
                <input
                  type="url"
                  value={avatarUrl}
                  onChange={(e) => handleAvatarUrlChange(e.target.value)}
                  placeholder="https://example.com/photo.jpg"
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 focus:border-brand-500/60 rounded-xl text-xs text-white outline-none font-mono"
                />
                {isResolvingUrl && (
                  <p className="text-[11px] text-amber-300 mt-1 flex items-center gap-1">
                    <span className="w-3 h-3 border-2 border-amber-300 border-t-transparent rounded-full animate-spin inline-block" />
                    Converting webpage link to direct image...
                  </p>
                )}
                <p className="text-[10px] text-white/40 mt-1.5 leading-normal">
                  Tip: Webpage links (like Pinterest, Facebook, or Instagram pin links) are not image files. If linking an image online, right-click the image and choose <em>"Copy Image Address"</em> so it ends in <code>.jpg</code> or <code>.png</code>.
                </p>
              </div>
            </div>

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
