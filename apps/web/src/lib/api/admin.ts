// Leadership tools: statistics, user roles, scheduled verses and push notifications.
import { apiFetch } from './client';
import type {
  BibleBook,
  ScheduledPushNotification,
  UserRole,
} from '@unstpbl/shared';
import type { AdminStats, AdminAuditLog } from './types';

export const adminApi = {
  getAdminBooks: () =>
    apiFetch<{ books: BibleBook[] }>('/admin/books'),
  getAdminStats: () =>
    apiFetch<AdminStats>('/admin/stats'),
  getAdminStatsTrends: () =>
    apiFetch<{ trends: Array<{ date: string; signups: number; reads: number }> }>('/admin/stats/trends'),
  getAdminStatsTranslations: () =>
    apiFetch<{ translations: Array<{ name: string; value: number }> }>('/admin/stats/translations'),
  getAdminStatsCongregations: () =>
    apiFetch<{ congregations: Array<{ congregation: string; members: number; readsToday: number; readRate: number }> }>('/admin/stats/congregations'),
  getAdminAuditLogs: (limit = 10) =>
    apiFetch<{ logs: AdminAuditLog[] }>(`/admin/audit?limit=${limit}`),
  getAdminUsersList: () =>
    apiFetch<{ users: Array<{ id: string; email: string; role: string; displayName?: string; congregation?: string; createdAt: string }> }>('/admin/users'),
  updateUserRole: (userId: string, role: UserRole) =>
    apiFetch<{ success: boolean }>(`/admin/users/${userId}/role`, {
      method: 'PUT',
      body: JSON.stringify({ role }),
    }),
  scheduleVerse: (data: { date: string; bookId: number; chapter: number; verseNumber: number; pastoralNote?: string }) =>
    apiFetch<{ success: boolean }>('/admin/schedule', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  schedulePushNotification: (data: { title: string; body: string; url?: string; scheduledFor: string }) =>
    apiFetch<{ notification: ScheduledPushNotification }>('/admin/push/schedule', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getScheduledPushNotifications: () =>
    apiFetch<{ notifications: ScheduledPushNotification[] }>('/admin/push/scheduled'),
  dispatchDuePushNotifications: () =>
    apiFetch<{ success: boolean; processed: number; sent: number; failed: number }>('/admin/push/dispatch-due', {
      method: 'POST',
    }),
  subscribePush: (subscription: PushSubscription) =>
    apiFetch<{ success: boolean }>('/push/subscribe', {
      method: 'POST',
      body: JSON.stringify(subscription),
    }),
  unsubscribePush: () =>
    apiFetch<{ success: boolean }>('/push/unsubscribe', {
      method: 'POST',
    }),
};
