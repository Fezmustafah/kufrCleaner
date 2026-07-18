import { describe, it, expect } from 'vitest';
import { getCalloutGroup } from '@/utils/callout-registry';

describe('getCalloutGroup', () => {
  it('classifies source, dialectic, notice', () => {
    expect(getCalloutGroup('scholar')).toBe('source');
    expect(getCalloutGroup('quran')).toBe('source');
    expect(getCalloutGroup('quote')).toBe('source');
    expect(getCalloutGroup('objection')).toBe('dialectic');
    expect(getCalloutGroup('response')).toBe('dialectic');
    expect(getCalloutGroup('note')).toBe('notice');
    expect(getCalloutGroup('warning')).toBe('notice');
  });
});
