import { afterEach, describe, expect, it } from 'vitest';
import { compileReadingFeed } from '@/scripts/reading-deck/feed';
import type { FeedKind } from '@/scripts/reading-deck/types';

function compile(source: HTMLElement, kind: FeedKind = 'slides') {
  return compileReadingFeed(source, {
    kind,
    title: 'Pilot article',
    description: 'Pilot description',
    coverImage: '/pilot.webp',
    citationTemplate: null,
    cardHash: (feed, index) => `#${feed}-${index}`,
  });
}

function article(html: string): HTMLElement {
  const source = document.createElement('article');
  source.innerHTML = html;
  return source;
}

describe('compileReadingFeed', () => {
  afterEach(() => document.body.replaceChildren());

  it('compiles cover, body Cards, and final Sources Card without Completion', () => {
    const source = article(`
      <p>Introduction.</p>
      <h2 id="claim">Claim</h2><p>Body.</p>
      <section data-footnotes id="footnotes">
        <h2>Sources</h2><ol><li id="fn-1">Reference.</li></ol>
      </section>`);

    const feed = compile(source);

    expect(feed.cards[0]).toMatchObject({ title: 'Cover', isCover: true });
    expect(feed.cards.at(-1)?.title).toBe('Sources');
    expect(feed.cards.some((card) => 'isTerminal' in card)).toBe(false);
    expect(feed.sources.has('fn-1')).toBe(true);
  });

  it('never mutates rendered source DOM', () => {
    const source = article('<h2 id="claim">Claim</h2><p>Body.</p>');
    const before = source.innerHTML;

    compile(source);

    expect(source.innerHTML).toBe(before);
    expect(source.querySelector('#claim')).not.toBeNull();
  });

  it('omits generated Contents and namespaces Card IDs and links', () => {
    const source = article(`
      <h2>Contents</h2><ol><li>Generated navigation</li></ol>
      <h2 id="claim">Claim</h2>
      <p><a href="#detail">Jump</a></p>
      <h3 id="detail">Detail</h3><p>Body.</p>`);

    const feed = compile(source);
    const body = feed.cards[1].element;

    expect(body.textContent).not.toContain('Generated navigation');
    expect(body.querySelector('#deck-slides-2-claim')).not.toBeNull();
    expect(body.querySelector<HTMLAnchorElement>('a')?.getAttribute('href')).toBe('#deck-slides-2-detail');
  });

  it('rewrites source links into persistent popover triggers', () => {
    const source = article(`
      <h2>Claim</h2><p><a href="#fn-1">1</a></p>
      <section data-footnotes id="footnotes"><ol><li id="fn-1">Reference.</li></ol></section>`);

    const feed = compile(source);
    const link = feed.cards[1].element.querySelector<HTMLAnchorElement>('a')!;

    expect(link.dataset.deckSourceId).toBe('fn-1');
    expect(link.getAttribute('href')).toBe('#slides-1');
    expect(link.hasAttribute('data-no-swup')).toBe(true);
  });

  it('creates a fallback Overview Card for empty source', () => {
    const feed = compile(article(''));
    expect(feed.cards.map((card) => card.title)).toEqual(['Cover', 'Overview']);
  });

  it('uses separate Quick and Deep reading rates', () => {
    const words = Array.from({ length: 450 }, () => 'word').join(' ');
    expect(compile(article(`<p>${words}</p>`), 'slides').minutes).toBe(3);
    expect(compile(article(`<p>${words}</p>`), 'tldr').minutes).toBe(2);
  });

  it('splits oversized groups at safe H3 boundaries', () => {
    const first = Array.from({ length: 150 }, () => 'first').join(' ');
    const second = Array.from({ length: 350 }, () => 'second').join(' ');
    const feed = compile(article(`<h2>Claim</h2><p>${first}</p><h3>Detail</h3><p>${second}</p>`));

    expect(feed.cards.slice(1).map((card) => card.title)).toEqual(['Claim', 'Detail']);
  });

  it('decorates article images and marginalia triggers for keyboard use', () => {
    const feed = compile(article(`
      <h2>Claim</h2>
      <img src="/diagram.png" alt="Diagram" />
      <button class="footnote-number">1</button>`));
    const body = feed.cards[1].element;
    const image = body.querySelector<HTMLImageElement>('img')!;
    const marginalia = body.querySelector<HTMLElement>('.footnote-number')!;

    expect(image.classList.contains('reading-deck-zoomable')).toBe(true);
    expect(image.tabIndex).toBe(0);
    expect(image.getAttribute('aria-label')).toBe('Expand image: Diagram');
    expect(marginalia.getAttribute('role')).toBe('button');
    expect(marginalia.tabIndex).toBe(0);
  });
});
