/**
 * Decides when everything the app has cached in memory (React Query) must be thrown away
 * because the person using it changed.
 *
 * Without this, signing out and letting someone else sign in on the same phone could briefly
 * show them the previous person's favourites, progress and prayers: cached data counts as fresh
 * for 5 minutes and the app does not reload the page between the two sign-ins.
 */
export function shouldResetCache(
  event: string,
  previousUserId: string | null,
  nextUserId: string | null,
): boolean {
  if (event === 'SIGNED_OUT') return true;
  return Boolean(previousUserId && nextUserId && previousUserId !== nextUserId);
}
