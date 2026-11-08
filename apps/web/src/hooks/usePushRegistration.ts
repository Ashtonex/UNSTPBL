import { useEffect } from 'react';
import type { User } from '@unstpbl/shared';
import { api } from '../lib/api';

/**
 * Subscribes this device to push notifications once the person's profile has loaded.
 *
 * Note: this asks for notification permission by itself two seconds after sign-in. Browsers (and
 * all of iOS) expect that request to follow a tap on a button, so a visible "Turn on alerts"
 * control would be more reliable. Left as it was; see the roadmap.
 */
export function usePushRegistration(profile: User | null): void {
  useEffect(() => {
    if (!profile) return;
    const timer = setTimeout(() => {
      void registerForPush();
    }, 2000);
    return () => clearTimeout(timer);
  }, [profile]);
}

async function registerForPush(): Promise<void> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('Push notifications not supported on this browser.');
    return;
  }
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.log('Notification permission denied.');
      return;
    }

    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
      if (!vapidPublicKey) {
        console.error('VITE_VAPID_PUBLIC_KEY is not defined.');
        return;
      }

      // Convert VAPID key to Uint8Array
      const urlBase64ToUint8Array = (base64String: string) => {
        const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
        const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        for (let i = 0; i < rawData.length; ++i) {
          outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
      };

      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });
    }

    // Send subscription to backend
    await api.subscribePush(subscription);
    console.log('Push notification subscription successfully registered!');
  } catch (err) {
    console.error('Failed to set up push notifications:', err);
  }
}
