import { useState, useEffect } from 'react';

function detectStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as any).standalone === true
  );
}

// iPhones and iPads never fire beforeinstallprompt. (iPadOS 13+ reports itself as a Mac.)
function detectIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  return (
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

export function usePWA() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(detectStandalone);
  const [isIOS] = useState(detectIOS);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent the default browser mini-infobar from showing
      e.preventDefault();
      // Stash the event so it can be triggered later
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsInstallable(false);
      setDeferredPrompt(null);
      console.log('🎉 UNSTPBL has been installed successfully!');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const install = async (): Promise<boolean> => {
    if (!deferredPrompt) {
      console.warn('⚠️ Installation prompt not available yet.');
      return false;
    }
    
    // Show the browser's install prompt
    deferredPrompt.prompt();
    
    // Wait for the user to respond to the prompt
    try {
      const { outcome } = await deferredPrompt.userChoice;
      console.log(`👤 User installation response: ${outcome}`);
      
      // Clean up the prompt
      setDeferredPrompt(null);
      setIsInstallable(false);
      
      return outcome === 'accepted';
    } catch (err) {
      console.error('❌ Error during PWA installation:', err);
      return false;
    }
  };

  return { isInstallable, isInstalled, isIOS, install };
}
