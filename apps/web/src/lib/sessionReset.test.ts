import { describe, expect, it } from 'vitest';
import { shouldResetCache } from './sessionReset';

describe('shouldResetCache', () => {
  it('resets on every sign-out, so the next person never sees cached data', () => {
    expect(shouldResetCache('SIGNED_OUT', 'alice', null)).toBe(true);
    expect(shouldResetCache('SIGNED_OUT', null, null)).toBe(true);
  });

  it('resets when a different person signs in without a sign-out in between', () => {
    expect(shouldResetCache('SIGNED_IN', 'alice', 'bob')).toBe(true);
  });

  it('keeps the cache when the same person is re-confirmed or refreshed', () => {
    expect(shouldResetCache('TOKEN_REFRESHED', 'alice', 'alice')).toBe(false);
    expect(shouldResetCache('SIGNED_IN', 'alice', 'alice')).toBe(false);
    expect(shouldResetCache('INITIAL_SESSION', 'alice', 'alice')).toBe(false);
  });

  it('keeps the cache for the first sign-in of a fresh page load', () => {
    expect(shouldResetCache('SIGNED_IN', null, 'alice')).toBe(false);
    expect(shouldResetCache('INITIAL_SESSION', null, null)).toBe(false);
  });
});
