import { describe, it, expect } from 'vitest';
import { lintText, collectIssues } from '../../../scripts/lint-callouts.js';

describe('collectIssues', () => {
  it('returns an empty array instead of throwing when the root does not exist', () => {
    expect(() => collectIssues('/nonexistent-path-xyz')).not.toThrow();
    expect(collectIssues('/nonexistent-path-xyz')).toEqual([]);
  });
});

describe('lintText', () => {
  it('flags a marker with no leading > (renders as plain text)', () => {
    const issues = lintText('some para\n[!objection] hey\nmore');
    expect(issues.some(i => i.kind === 'missing-gt' && i.line === 2)).toBe(true);
  });
  it('flags a title-only callout whose body lost its > prefix', () => {
    const issues = lintText('> [!quote]\n((Nuaim said this))\n');
    expect(issues.some(i => i.kind === 'orphaned-body' && i.line === 1)).toBe(true);
  });
  it('passes a well-formed callout', () => {
    expect(lintText('> [!quran] 2:255\n> Ayat al-Kursi')).toEqual([]);
  });
  it('does not flag a normal blockquote-wrapped callout continuation', () => {
    expect(lintText('> [!hadith] Bukhari\n> chain\n> matn')).toEqual([]);
  });
});
