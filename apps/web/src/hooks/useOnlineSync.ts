import { useEffect } from 'react';
import { api } from '../lib/api';
import { useOnline } from './useOnline';

/**
 * Sends anything queued while the device was offline (see lib/offlineQueue.ts), once on start-up
 * and again each time the connection comes back. Returns whether the device is online.
 */
export function useOnlineSync(): boolean {
  const online = useOnline();
  useEffect(() => {
    if (online) void api.syncPendingQueue();
  }, [online]);
  return online;
}
