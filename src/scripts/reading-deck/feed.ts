import type { CompiledReadingFeed, DeckCard, FeedKind } from './types';

const SOURCE_HEADING = /^(?:sources?|source and notes|notes|footnotes|references|bibliography)$/i;
const TOC_HEADING = /^(?:contents|table of contents|toc)$/i;

interface SourceGroup {
  title: string;
  nodes: ChildNode[];
}

export interface CompileReadingFeedOptions {
  kind: FeedKind;
  title: string;
  description: string;
  coverImage: string | null;
  citationTemplate: HTMLTemplateElement | null;
  cardHash(feed: FeedKind, index: number): string;
}

export function compileReadingFeed(
  renderedSource: HTMLElement,
  options: CompileReadingFeedOptions,
): CompiledReadingFeed {
  const source = renderedSource.cloneNode(true) as HTMLElement;
  const document = source.ownerDocument;
  const sources = new Map<string, HTMLElement>();
  const minutes = Math.max(
    1,
    Math.ceil(textWords(source.textContent ?? '') / (options.kind === 'tldr' ? 240 : 210)),
  );

  source.querySelectorAll('script, style, .post-colophon, [data-pagefind-ignore]').forEach((node) => node.remove());
  const sourceSections = detachSourceSections(source, options.citationTemplate, sources);
  const cards: DeckCard[] = [createCoverCard(document, options, minutes)];

  groupSourceNodes(source).forEach((group) => {
    chunkGroup(group.nodes).forEach((chunk, chunkIndex) => {
      const card = document.createElement('section');
      card.className = 'reading-deck-card prose dark:prose-dark max-w-none';
      card.tabIndex = -1;
      card.setAttribute('role', 'group');
      card.setAttribute('aria-roledescription', 'slide');
      chunk.forEach((node) => card.appendChild(node));
      const fallback = chunkIndex ? `${group.title}, continued` : group.title;
      cards.push({ element: card, title: cleanHeading(card.querySelector('h2, h3'), fallback) });
    });
  });

  appendSourcesCard(document, cards, sourceSections);
  if (cards.length === 1) appendFallbackCard(document, cards, source);
  decorateCards(cards, sources, options);

  return { cards, sources, minutes };
}

function textWords(value: string): number {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

function cleanHeading(heading: Element | null, fallback: string): string {
  if (!heading) return fallback;
  const copy = heading.cloneNode(true) as HTMLElement;
  copy.querySelectorAll('[data-role="anchor"], .heading-link').forEach((node) => node.remove());
  return copy.textContent?.replace(/\s+/g, ' ').trim() || fallback;
}

function meaningfulNode(node: ChildNode): boolean {
  if (node.nodeType === Node.TEXT_NODE) return Boolean(node.textContent?.trim());
  return node.nodeType === Node.ELEMENT_NODE;
}

function decodeFragment(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function detachSourceSections(
  source: HTMLElement,
  citationTemplate: HTMLTemplateElement | null,
  sources: Map<string, HTMLElement>,
): HTMLElement[] {
  const sections = Array.from(
    source.querySelectorAll<HTMLElement>('section[data-footnotes], .deck-citation-registry'),
  );
  const citationSection = citationTemplate?.content.firstElementChild?.cloneNode(true) as HTMLElement | undefined;
  if (citationSection) sections.push(citationSection);

  sections.forEach((section) => {
    if (section.isConnected || source.contains(section)) section.remove();
    if (section.id) sources.set(section.id, section);
    section.querySelectorAll<HTMLElement>('[id]').forEach((element) => sources.set(element.id, element));
  });

  return sections;
}

function createCoverCard(
  document: Document,
  options: CompileReadingFeedOptions,
  minutes: number,
): DeckCard {
  const card = document.createElement('section');
  card.className = 'reading-deck-card reading-deck-cover-card';
  card.tabIndex = -1;
  card.setAttribute('role', 'group');
  card.setAttribute('aria-roledescription', 'slide');

  if (options.coverImage) {
    const image = document.createElement('img');
    image.className = 'reading-deck-cover-image';
    image.src = options.coverImage;
    image.alt = '';
    image.setAttribute('aria-hidden', 'true');
    card.appendChild(image);
  }

  const veil = document.createElement('div');
  veil.className = 'reading-deck-cover-veil';
  const copy = document.createElement('div');
  copy.className = 'reading-deck-cover-copy';
  const mode = document.createElement('span');
  mode.className = 'reading-deck-cover-mode';
  mode.textContent = options.kind === 'tldr' ? 'TLDR view' : 'Deep read';
  const title = document.createElement('h2');
  title.textContent = options.title || 'Article';
  const description = document.createElement('p');
  description.textContent = options.description || 'Read the argument one card at a time.';
  const meta = document.createElement('p');
  meta.className = 'reading-deck-cover-meta';
  meta.textContent = `${minutes} min read`;
  const start = document.createElement('button');
  start.type = 'button';
  start.className = 'reading-deck-cover-start';
  start.dataset.deckAction = 'start';
  start.innerHTML = '<span>Begin</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
  copy.append(mode, title, description, meta, start);
  veil.appendChild(copy);
  card.appendChild(veil);
  return { element: card, title: 'Cover', isCover: true };
}

function groupSourceNodes(source: HTMLElement): SourceGroup[] {
  const groups: SourceGroup[] = [];
  let title = 'Overview';
  let nodes: ChildNode[] = [];
  let skippingNavigation = false;

  const flush = () => {
    if (nodes.some(meaningfulNode)) groups.push({ title, nodes });
    nodes = [];
  };

  Array.from(source.childNodes).forEach((node) => {
    if (!meaningfulNode(node)) return;
    const element = node.nodeType === Node.ELEMENT_NODE ? node as HTMLElement : null;
    const isH2 = element?.tagName === 'H2';
    const heading = isH2 ? cleanHeading(element, '') : '';

    if (isH2 && TOC_HEADING.test(heading)) {
      flush();
      skippingNavigation = true;
      return;
    }
    if (isH2 && SOURCE_HEADING.test(heading)) {
      flush();
      skippingNavigation = true;
      return;
    }
    if (isH2) {
      if (skippingNavigation) skippingNavigation = false;
      flush();
      title = heading || 'Section';
    }
    if (!skippingNavigation) nodes.push(node);
  });
  flush();
  return groups;
}

function chunkGroup(nodes: ChildNode[]): ChildNode[][] {
  const total = textWords(nodes.map((node) => node.textContent ?? '').join(' '));
  if (total <= 480) return [nodes];

  const chunks: ChildNode[][] = [];
  let chunk: ChildNode[] = [];
  let words = 0;
  const flush = () => {
    if (chunk.length) chunks.push(chunk);
    chunk = [];
    words = 0;
  };

  nodes.forEach((node, index) => {
    const element = node.nodeType === Node.ELEMENT_NODE ? node as HTMLElement : null;
    const nodeWords = textWords(node.textContent ?? '');
    const h3Boundary = element?.tagName === 'H3' && words >= 120;
    const blockBoundary = words >= 380 && index > 0;
    if (chunk.length && (h3Boundary || blockBoundary)) flush();
    chunk.push(node);
    words += nodeWords;
  });
  flush();
  return chunks.length ? chunks : [[...nodes]];
}

function appendSourcesCard(
  document: Document,
  cards: DeckCard[],
  sourceSections: HTMLElement[],
): void {
  if (!sourceSections.length) return;
  const card = document.createElement('section');
  card.className = 'reading-deck-card prose dark:prose-dark max-w-none reading-deck-sources-card';
  card.tabIndex = -1;
  card.setAttribute('role', 'group');
  card.setAttribute('aria-roledescription', 'slide');
  const heading = document.createElement('h2');
  heading.textContent = 'Sources';
  card.appendChild(heading);

  sourceSections.forEach((section) => {
    section.querySelectorAll('[data-footnote-backref]').forEach((backref) => backref.remove());
    const nestedHeading = section.querySelector(':scope > h2');
    if (nestedHeading && SOURCE_HEADING.test(cleanHeading(nestedHeading, ''))) nestedHeading.remove();
    card.appendChild(section);
  });
  cards.push({ element: card, title: 'Sources' });
}

function appendFallbackCard(document: Document, cards: DeckCard[], source: HTMLElement): void {
  const fallback = document.createElement('section');
  fallback.className = 'reading-deck-card prose dark:prose-dark max-w-none';
  fallback.tabIndex = -1;
  const heading = document.createElement('h2');
  heading.textContent = 'Overview';
  fallback.append(heading, ...Array.from(source.childNodes));
  cards.push({ element: fallback, title: 'Overview' });
}

function decorateCards(
  cards: DeckCard[],
  sources: Map<string, HTMLElement>,
  options: CompileReadingFeedOptions,
): void {
  const contentTotal = cards.filter((card) => !card.isCover).length;
  cards.forEach((card, index) => {
    card.element.setAttribute(
      'aria-label',
      card.isCover
        ? `${options.kind === 'tldr' ? 'TLDR view' : 'Deep read'} cover`
        : `${card.title}, card ${index} of ${contentTotal}`,
    );
    namespaceCard(card.element, `${options.kind}-${index + 1}`, sources, options.cardHash(options.kind, index));
    card.element.querySelectorAll<HTMLImageElement>('img:not(.reading-deck-cover-image)').forEach((image) => {
      image.classList.add('reading-deck-zoomable');
      image.tabIndex = 0;
      image.setAttribute('role', 'button');
      image.setAttribute('aria-label', image.alt ? `Expand image: ${image.alt}` : 'Expand image');
    });
  });
}

function namespaceCard(
  card: HTMLElement,
  prefix: string,
  sources: Map<string, HTMLElement>,
  cardHash: string,
): void {
  const ids = new Map<string, string>();
  card.querySelectorAll<HTMLElement>('[id]').forEach((element) => {
    const oldId = element.id;
    const nextId = `deck-${prefix}-${oldId}`;
    ids.set(oldId, nextId);
    element.id = nextId;
  });

  card.querySelectorAll<HTMLAnchorElement>('a[href^="#"]').forEach((anchor) => {
    const oldId = decodeFragment(anchor.getAttribute('href')!.slice(1));
    if (sources.has(oldId)) {
      anchor.dataset.deckSourceId = oldId;
      anchor.href = cardHash;
      anchor.setAttribute('data-no-swup', '');
    } else if (ids.has(oldId)) {
      anchor.href = `#${ids.get(oldId)}`;
      anchor.setAttribute('data-no-swup', '');
    }
  });

  card.querySelectorAll<HTMLElement>('.footnote-number').forEach((marker) => {
    marker.tabIndex = 0;
    marker.setAttribute('role', 'button');
    marker.setAttribute('aria-label', 'Open margin note');
  });
}
