import { describe, it, expect } from 'vitest';
import { fixText } from '../../../scripts/fix-callouts.js';

describe('fixText', () => {
  it('prefixes a missing-gt callout block', () => {
    expect(fixText('para\n[!objection] hey\nbody line\n\nafter'))
      .toBe('para\n> [!objection] hey\n> body line\n\nafter');
  });
  it('re-prefixes an orphaned body under a title-only callout', () => {
    expect(fixText('> [!quote]\n((Nuaim said))\nmore\n\nx'))
      .toBe('> [!quote]\n> ((Nuaim said))\n> more\n\nx');
  });
  it('leaves well-formed callouts untouched', () => {
    const ok = '> [!quran] 2:255\n> Ayat al-Kursi';
    expect(fixText(ok)).toBe(ok);
  });
  it('is idempotent', () => {
    const once = fixText('para\n[!objection] hey\nbody\n\nx');
    expect(fixText(once)).toBe(once);
  });
});
