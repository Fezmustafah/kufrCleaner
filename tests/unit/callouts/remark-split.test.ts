import { describe, it, expect } from 'vitest';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import rehypeRaw from 'rehype-raw';
import rehypeStringify from 'rehype-stringify';
import remarkCallouts from '@/utils/remark-callouts';

async function render(md: string): Promise<string> {
  const file = await unified()
    .use(remarkParse)
    .use(remarkCallouts)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
    .use(rehypeStringify, { allowDangerousHtml: true })
    .process(md);
  return String(file);
}

describe('remark callouts single-line quote split', () => {
  it('splits single-line source callout at the first quote', async () => {
    const html = await render('> [!research] Bone Ossification (NIH / StatPearls) "Bone formation begins in week six."');
    expect(html).toMatch(/callout-title[\s\S]*Bone Ossification \(NIH \/ StatPearls\)/);
    expect(html).toMatch(/callout-content[\s\S]*Bone formation begins in week six\./);
    // Bounded to the title-inner span itself (not an unanchored substring
    // check) — the quote text legitimately appears later, in callout-content,
    // so an unbounded [\s\S]* match against the rest of the document would
    // always succeed regardless of whether the split actually happened.
    expect(html).not.toMatch(/callout-title-inner"><span>[^<]*Bone formation begins/);
  });

  it('preserves emphasis inside the quoted body', async () => {
    const html = await render('> [!scholar] Ibn Kathir "Allah _refutes_ their claim."');
    expect(html).toMatch(/callout-content[\s\S]*<em>refutes<\/em>/);
  });

  it('strips wrapping quotes only for the quote type', async () => {
    const q = await render('> [!quote] Bukhari 5779 "Seven dates a day."');
    expect(q).toMatch(/callout-content[\s\S]*Seven dates a day\./);
    expect(q).not.toMatch(/callout-content[\s\S]*"Seven dates a day\."/);

    const s = await render('> [!hadith] Bukhari 3332 "Forty days."');
    expect(s).toMatch(/callout-content[\s\S]*"Forty days\."/);
  });

  it('does NOT split when there is no double-quote', async () => {
    const html = await render('> [!bible] Genesis 25:16–18 sixteen sons');
    expect(html).toMatch(/callout-title-inner[\s\S]*Genesis 25:16/);
  });

  it('does not split non-source types', async () => {
    const html = await render('> [!note] Heads up "this stays in the title area"');
    expect(html).toMatch(/callout-title-inner[\s\S]*this stays in the title area/);
  });
});
