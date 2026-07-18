import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

describe('getCalloutMeta override on key conflict', () => {
  const generatedJsonPath = join(process.cwd(), 'src/generated/callouts-custom.json');
  let originalContent: string;

  beforeEach(() => {
    // Save the original generated file content
    originalContent = readFileSync(generatedJsonPath, 'utf-8');
  });

  afterEach(() => {
    // Restore the original generated file
    writeFileSync(generatedJsonPath, originalContent, 'utf-8');
    // Clear module cache so next test reads the restored file
    vi.resetModules();
  });

  it('proves Obsidian JSON overrides in-repo defaults when key conflicts', async () => {
    // Temporarily add 'note' override to the generated JSON
    // In-repo default: { icon: 'info', title: 'Note' }
    // Our override: { icon: 'flame', title: 'MOCKED NOTE' }
    const overrideJson = {
      hadith: JSON.parse(originalContent).hadith,
      bible: JSON.parse(originalContent).bible,
      quran: JSON.parse(originalContent).quran,
      note: { icon: 'flame', iconType: 'lucide', title: 'MOCKED NOTE' },
    };
    writeFileSync(generatedJsonPath, JSON.stringify(overrideJson), 'utf-8');

    // Clear module cache so the dynamic import reads the modified file
    vi.resetModules();

    // Dynamically import after file modification so getMerged() reads the override
    const { getCalloutMeta } = await import('@/utils/callout-registry');

    const noteMeta = getCalloutMeta('note');

    // Assert the JSON override won (icon='flame', title='MOCKED NOTE')
    // not the in-repo default (icon='info', title='Note')
    expect(noteMeta.icon).toBe('flame');
    expect(noteMeta.title).toBe('MOCKED NOTE');
    expect(noteMeta.iconType).toBe('lucide');
  });
});
