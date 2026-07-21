import { describe, it, expect } from 'vitest';
import { isHapticsEnabled } from '@/scripts/haptics';

describe('isHapticsEnabled', () => {
  it('enabled by default (motion ok, no stored pref)', () => {
    expect(isHapticsEnabled(false, null)).toBe(true);
  });

  it('disabled when the user prefers reduced motion', () => {
    expect(isHapticsEnabled(true, null)).toBe(false);
  });

  it('disabled when the stored pref is "off"', () => {
    expect(isHapticsEnabled(false, 'off')).toBe(false);
  });

  it('any non-"off" stored value leaves it enabled', () => {
    expect(isHapticsEnabled(false, 'on')).toBe(true);
  });
});
