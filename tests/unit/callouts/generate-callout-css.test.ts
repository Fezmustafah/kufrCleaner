import { describe, it, expect } from 'vitest';
import { classifyCondition, toColor } from '../../../scripts/generate-callout-css.js';

describe('toColor', () => {
  it('wraps bare r,g,b triples', () => {
    expect(toColor('15, 118, 110')).toBe('rgb(15, 118, 110)');
  });
  it('passes hex/rgb/hsl through', () => {
    expect(toColor('#abc')).toBe('#abc');
    expect(toColor('rgb(1,2,3)')).toBe('rgb(1,2,3)');
  });
});

describe('classifyCondition', () => {
  it('maps colorScheme conditions', () => {
    expect(classifyCondition({ colorScheme: 'light' })).toBe('light');
    expect(classifyCondition({ colorScheme: 'dark' })).toBe('dark');
  });
  it('treats an unconditional change as both schemes', () => {
    expect(classifyCondition(undefined)).toBe('both');
  });
  it('flattens theme conditions to both schemes instead of dropping them', () => {
    expect(classifyCondition({ theme: 'some-theme' })).toBe('both');
  });
  it('flattens compound and/or conditions to both schemes instead of dropping them', () => {
    expect(classifyCondition({ and: [{ colorScheme: 'dark' }, { theme: 'x' }] })).toBe('both');
    expect(classifyCondition({ or: [{ colorScheme: 'light' }, { theme: 'x' }] })).toBe('both');
  });
});
