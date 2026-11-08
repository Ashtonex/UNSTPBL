import { adminApi } from './admin';
import { communityApi } from './community';
import { messagingApi } from './messaging';
import { profileApi } from './profile';
import { versesApi } from './verses';

// The API as the app uses it: `api.getVerseToday()`, `api.getPrayerRequests()`, ... One object, kept
// in separate files by area so no single file is hundreds of lines long.
export const api = {
  ...versesApi,
  ...communityApi,
  ...adminApi,
  ...messagingApi,
  ...profileApi,
};

export { prewarmApi } from './client';
export * from './types';
