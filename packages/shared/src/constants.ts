export const DEFAULT_FALLBACK_VERSE = {
  book: 'Psalms',
  chapter: 119,
  verseNumber: 105,
  text: 'Thy word is a lamp unto my feet, and a light unto my path.',
  translation: 'KJV',
};

export const ROLES = {
  MEMBER: 'member' as const,
  BISHOP: 'bishop' as const,
};

export const API_PATHS = {
  HEALTH: '/health',
  VERSES_TODAY: '/verses/today',
  VERSES_HISTORY: '/verses/history',
  VERSES_READ: '/verses/read',
  ADMIN_SCHEDULE: '/admin/schedule',
  ADMIN_NOTIFY: '/admin/notify',
  ADMIN_MEMBERS: '/admin/members',
  ADMIN_STATS: '/admin/stats',
  PUSH_SUBSCRIBE: '/push/subscribe',
  AUTH_WEBHOOK: '/auth/webhook',
} as const;

export const APP_NAME = 'UNSTPBL';
export const DEFAULT_TRANSLATION = 'KJV';
