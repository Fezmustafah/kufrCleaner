import { describe, it, expect } from 'vitest';
import { resolveCalloutType, getCalloutMeta, aliases } from '@/utils/callout-registry';

describe('resolveCalloutType', () => {
  it('lowercases and passes known types through', () => {
    expect(resolveCalloutType('Quran')).toBe('quran');
    expect(resolveCalloutType('scholar')).toBe('scholar');
  });
  it('heals typo/synonym types via the alias map', () => {
    expect(resolveCalloutType('FAIL')).toBe('failure');
    expect(resolveCalloutType('done')).toBe('success');
    expect(resolveCalloutType('check')).toBe('success');
    expect(resolveCalloutType('critical')).toBe('danger');
    expect(resolveCalloutType('reference')).toBe('cite');
  });
});

describe('getCalloutMeta', () => {
  it('gives real icons to academic/dialectic types (no info fallback)', () => {
    expect(getCalloutMeta('scholar').icon).toBe('graduation-cap');
    expect(getCalloutMeta('objection').icon).toBe('swords');
    expect(getCalloutMeta('response').icon).toBe('shield');
  });
  it('falls back to info icon + capitalized title for unknown types (never blue name)', () => {
    expect(getCalloutMeta('totallyunknown')).toEqual({ icon: 'info', title: 'Totallyunknown' });
  });
  it('lets Obsidian-generated JSON override in-repo defaults', () => {
    // src/generated/callouts-custom.json ships hadith -> scroll-text
    expect(getCalloutMeta('hadith').icon).toBe('scroll-text');
  });
  it('exposes the alias map for the linter', () => {
    expect(aliases.fail).toBe('failure');
  });
});
