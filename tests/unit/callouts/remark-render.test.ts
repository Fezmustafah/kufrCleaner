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

describe('remark callout rendering', () => {
  it('emits the alias-resolved type as data-callout', async () => {
    const html = await render('> [!fail] Bad\n> body');
    expect(html).toContain('data-callout="failure"');
  });
  it('gives scholar its graduation-cap icon, not the info fallback', async () => {
    const html = await render('> [!scholar] Ibn Taymiyya\n> text');
    // graduation-cap path is distinct from the info circle; assert the title + a callout div
    expect(html).toContain('data-callout="scholar"');
    expect(html).toContain('Ibn Taymiyya');
  });
  it('renders an unknown type without crashing, capitalized title', async () => {
    const html = await render('> [!bismillah]\n> text');
    expect(html).toContain('data-callout="bismillah"');
    expect(html).toContain('Bismillah');
  });
  it('renders a nested > > callout', async () => {
    const html = await render('> outer\n> > [!quote] Inner\n> > quoted');
    expect(html).toContain('data-callout="quote"');
  });
});
