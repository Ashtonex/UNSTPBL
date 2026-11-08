// Visitors, text messages and members' text preferences.
import { apiFetch } from './client';
import type { Visitor, NewVisitor, RegisterVisitorResult, MessageAudience, MessagingStatus, SavedAnnouncement, MessageTemplate, TemplatePreview, MessagePreview, MessageLogEntry, SmsPreferences } from './types';

export const messagingApi = {
  getVisitors: (search = '') =>
    apiFetch<{ visitors: Visitor[] }>(`/visitors${search ? `?search=${encodeURIComponent(search)}` : ''}`),
  registerVisitor: (data: NewVisitor) =>
    apiFetch<RegisterVisitorResult>('/visitors', { method: 'POST', body: JSON.stringify(data) }),
  recordVisitorVisit: (id: string) =>
    apiFetch<{ visitRecorded: boolean; visitor: Visitor }>(`/visitors/${id}/visit`, { method: 'POST' }),
  updateVisitor: (id: string, data: { followupStatus?: Visitor['followupStatus']; notes?: string | null }) =>
    apiFetch<{ visitor: Visitor }>(`/visitors/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  sendVisitorWelcome: (id: string) =>
    apiFetch<{ status: string; reason?: string; detail?: string }>(`/visitors/${id}/welcome`, { method: 'POST' }),
  getMessagingStatus: () => apiFetch<MessagingStatus>('/messages/status'),
  getSavedMessages: () => apiFetch<{ saved: SavedAnnouncement[]; limit: number }>('/messages/saved'),
  saveMessage: (title: string, body: string) =>
    apiFetch<{ saved: SavedAnnouncement }>('/messages/saved', { method: 'POST', body: JSON.stringify({ title, body }) }),
  deleteSavedMessage: (id: string) => apiFetch<{ ok: boolean }>(`/messages/saved/${id}`, { method: 'DELETE' }),
  getMessageTemplates: () => apiFetch<{ templates: MessageTemplate[] }>('/messages/templates'),
  previewMessageTemplate: (key: MessageTemplate['key'], body: string) =>
    apiFetch<TemplatePreview>('/messages/templates/preview', { method: 'POST', body: JSON.stringify({ key, body }) }),
  saveMessageTemplate: (key: MessageTemplate['key'], body: string) =>
    apiFetch<{ template: MessageTemplate }>(`/messages/templates/${key}`, { method: 'PUT', body: JSON.stringify({ body }) }),
  resetMessageTemplate: (key: MessageTemplate['key']) =>
    apiFetch<{ template: MessageTemplate }>(`/messages/templates/${key}`, { method: 'DELETE' }),
  previewMessage: (message: string, audience: MessageAudience) =>
    apiFetch<MessagePreview>('/messages/preview', { method: 'POST', body: JSON.stringify({ message, audience }) }),
  sendMessage: (message: string, audience: MessageAudience, confirmRecipients: number) =>
    apiFetch<{ accepted: boolean; recipients: number; dryRun: boolean }>('/messages/send', {
      method: 'POST',
      body: JSON.stringify({ message, audience, confirmRecipients }),
    }),
  sendTestMessage: (message: string) =>
    apiFetch<{ status: string; reason: string | null; detail: string | null; segments: number }>('/messages/test', {
      method: 'POST',
      body: JSON.stringify({ message }),
    }),
  getMessageLog: () => apiFetch<{ messages: MessageLogEntry[] }>('/messages/log?limit=40'),
  getSmsPreferences: () => apiFetch<{ preferences: SmsPreferences }>('/me/sms-preferences'),
  saveSmsPreferences: (data: Pick<SmsPreferences, 'announcements' | 'dailyVerse' | 'birthday' | 'channel'>) =>
    apiFetch<{ preferences: SmsPreferences }>('/me/sms-preferences', { method: 'PUT', body: JSON.stringify(data) }),
};
