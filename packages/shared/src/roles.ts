/**
 * Who can do what. One table, used by both the API (to enforce it) and the app (to decide
 * what to show), so the two can never disagree.
 *
 * - member         everyone: the daily verse, reflections, their own settings
 * - usher          the welcome team: registers guests and sees who has visited
 * - pastor         an usher's tools, plus visitor follow-up and texting a congregation or circle
 * - communications keeps the church's messaging: wording, announcements to anyone, guests
 * - bishop / admin everything, including the dashboards (admin also manages roles)
 */
export const USER_ROLES = ['member', 'usher', 'pastor', 'communications', 'bishop', 'admin'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export type Capability =
  | 'staff.hub' // sees the Team page
  | 'visitors.view' // sees the guest list
  | 'visitors.register' // registers a guest, records a return visit, sends the welcome text
  | 'visitors.followup' // changes a guest's follow-up status and notes
  | 'messages.view' // sees text message history
  | 'messages.send' // sends announcements (and a test to themselves), uses saved messages
  | 'messages.sendToAll' // may address all members or all leaders, not just a congregation, circle or guests
  | 'messages.wording'; // edits the standing texts (thank-you, birthday, daily verse)

const USHER: Capability[] = ['staff.hub', 'visitors.view', 'visitors.register'];
const PASTOR: Capability[] = [...USHER, 'visitors.followup', 'messages.view', 'messages.send'];
const COMMUNICATIONS: Capability[] = [...PASTOR, 'messages.sendToAll', 'messages.wording'];

export const ROLE_CAPABILITIES: Record<UserRole, readonly Capability[]> = {
  member: [],
  usher: USHER,
  pastor: PASTOR,
  communications: COMMUNICATIONS,
  bishop: COMMUNICATIONS,
  admin: COMMUNICATIONS,
};

export const ROLE_LABELS: Record<UserRole, string> = {
  member: 'Member',
  usher: 'Usher',
  pastor: 'Pastor',
  communications: 'Communications',
  bishop: 'Bishop',
  admin: 'Admin',
};

export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  member: 'The daily verse, reflections and prayer.',
  usher: 'Registers guests at the door and sees who has visited.',
  pastor: 'Registers and follows up guests, and texts a congregation or home circle.',
  communications: 'Looks after the church texts: wording, announcements to anyone, and guests.',
  bishop: 'Everything, including the Bishop dashboard.',
  admin: 'Everything, plus managing who holds which role.',
};

export function isUserRole(value: unknown): value is UserRole {
  return typeof value === 'string' && (USER_ROLES as readonly string[]).includes(value);
}

/** An unknown or missing role has no powers: it is treated as an ordinary member. */
export function can(role: string | null | undefined, capability: Capability): boolean {
  return isUserRole(role) && ROLE_CAPABILITIES[role].includes(capability);
}

/** True for anyone on the church's staff, that is, anyone with a tool to show on the Team page. */
export function isStaff(role: string | null | undefined): boolean {
  return can(role, 'staff.hub');
}
