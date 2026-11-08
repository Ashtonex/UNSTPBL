// Prayer wall, birthdays, circles, sermons, trivia and church-wide milestones.
import { apiFetch } from './client';
import type {
  CircleWithMembership,
  Circle,
  Milestone,
  PrayerRequest,
  PrayerRequestRecord,
  PrayerType,
  Sermon,
  TriviaQuestion,
} from '@unstpbl/shared';
import type { BirthdayFeed } from './types';

export const communityApi = {
  getPrayerRequests: () =>
    apiFetch<{ prayers: PrayerRequest[] }>('/prayers'),
  createPrayerRequest: (data: { title: string; content: string; type?: PrayerType; isAnonymous?: boolean }) =>
    apiFetch<{ prayer: PrayerRequestRecord }>('/prayers', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  joinPrayer: (id: string) =>
    apiFetch<{ success: boolean }>(`/prayers/${id}/join`, {
      method: 'POST',
    }),
  leavePrayer: (id: string) =>
    apiFetch<{ success: boolean }>(`/prayers/${id}/join`, {
      method: 'DELETE',
    }),
  markPrayerAnswered: (id: string) =>
    apiFetch<{ prayer: PrayerRequestRecord }>(`/prayers/${id}/answered`, {
      method: 'PUT',
    }),
  getBirthdays: () =>
    apiFetch<BirthdayFeed>('/birthdays'),
  dispatchTodaysBirthdays: () =>
    apiFetch<{ success: boolean; processed: number; created: number; sent: number; failed: number }>('/birthdays/dispatch-today', {
      method: 'POST',
    }),
  getCircles: () =>
    apiFetch<{ circles: CircleWithMembership[] }>('/circles'),
  createCircle: (data: { name: string; description?: string }) =>
    apiFetch<{ circle: Circle }>('/circles', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  joinCircle: (id: string) =>
    apiFetch<{ success: boolean }>(`/circles/${id}/join`, {
      method: 'POST',
    }),
  leaveCircle: (id: string) =>
    apiFetch<{ success: boolean }>(`/circles/${id}/join`, {
      method: 'DELETE',
    }),
  getSermons: () =>
    apiFetch<{ sermons: Sermon[] }>('/sermons'),
  createSermon: (data: { title: string; preacher: string; date: string; outline: string }) =>
    apiFetch<{ sermon: Sermon }>('/sermons', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getSermonNotes: (id: string) =>
    apiFetch<{ notes: string }>(`/sermons/${id}/notes`),
  saveSermonNotes: (id: string, notes: string) =>
    apiFetch<{ success: boolean }>(`/sermons/${id}/notes`, {
      method: 'PUT',
      body: JSON.stringify({ notes }),
    }),
  getWeeklyTrivia: () =>
    apiFetch<{ trivia: TriviaQuestion[] }>('/trivia/weekly'),
  submitTriviaAnswer: (questionId: string, selectedOptionIndex: number) =>
    apiFetch<{ success: boolean; isCorrect: boolean; correctOptionIndex: number; explanation?: string }>('/trivia/submit', {
      method: 'POST',
      body: JSON.stringify({ questionId, selectedOptionIndex }),
    }),
  createTriviaQuestion: (data: { question: string; options: string[]; correctOptionIndex: number; explanation?: string; weekDate: string }) =>
    apiFetch<{ trivia: TriviaQuestion }>('/admin/trivia', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getMilestones: () =>
    apiFetch<{ totalReads: number; milestones: Milestone[] }>('/stats/milestones'),

  // ── Visitors & text messages (bishops/admins; preferences are for every member) ──,
};
