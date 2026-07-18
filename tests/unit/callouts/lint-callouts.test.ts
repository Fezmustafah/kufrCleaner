import { describe, it, expect } from 'vitest';
import { lintText } from '../../../scripts/lint-callouts.js';

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
