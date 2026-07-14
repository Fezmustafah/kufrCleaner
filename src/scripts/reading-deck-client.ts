import { WebHaptics } from 'web-haptics';

type FeedKind = 'slides' | 'tldr';

interface DeckCardModel {
  element: HTMLElement;
  title: string;
  isCover?: boolean;
  isTerminal?: boolean;
}

interface DeckFeedModel {
  cards: DeckCardModel[];
  sources: Map<string, HTMLElement>;
  minutes: number;
}

interface DeckLocation {
  feed: FeedKind;
  index: number | null;
}

interface SavedDeckState {
  feed?: FeedKind;
  positions?: Partial<Record<FeedKind, number>>;
}

declare global {
  interface Window {
    initializeReadingDeck?: () => void;
    initializeAnnotations?: (opts?: { animate?: boolean }) => void;
    initializeWikilinks?: () => void;
    initializeMermaid?: () => void;
    searchPalette?: { open: (seed?: string) => void; close?: () => void; isOpen?: () => boolean };
    __setNavDrawer?: (open: boolean) => void;
  }
}

const DECK_HASH = /^#(slides|tldr)(?:-(\d+))?$/;
const SWIPE_HINT_KEY = 'reading-deck-swipe-hint-seen';
const SOURCE_HEADING = /^(?:sources?|source and notes|notes|footnotes|references|bibliography)$/i;
const TOC_HEADING = /^(?:contents|table of contents|toc)$/i;

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

function focusableWithin(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(
    'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'
  )).filter((element) => !element.hidden && element.getAttribute('aria-hidden') !== 'true');
}

class ReadingDeckController {
  private readonly abort = new AbortController();
  private readonly dialog: HTMLDialogElement;
  private readonly shell: HTMLElement;
  private readonly stage: HTMLElement;
  private readonly track: HTMLElement;
  private readonly progress: HTMLElement;
  private readonly status: HTMLElement;
  private readonly position: HTMLElement;
  private readonly cardTitle: HTMLElement;
  private readonly prev: HTMLButtonElement;
  private readonly next: HTMLButtonElement;
  private readonly modeLabel: HTMLElement;
  private readonly indexOverlay: HTMLElement;
  private readonly indexList: HTMLOListElement;
  private readonly sourceOverlay: HTMLElement;
  private readonly sourceContent: HTMLElement;
  private readonly imageOverlay: HTMLElement;
  private readonly image: HTMLImageElement;
  private readonly scrollShadow: HTMLElement;
  private readonly swipeHint: HTMLElement;
  private readonly finish: HTMLElement;
  private readonly finishTitle: HTMLElement;
  private readonly finishCopy: HTMLElement;
  private readonly finishPrimary: HTMLButtonElement;
  private readonly finishPrimaryLabel: HTMLElement;
  private readonly feedCache = new Map<FeedKind, DeckFeedModel>();
  private readonly positions = new Map<FeedKind, number>();
  private readonly haptics = new WebHaptics({ debug: false, showSwitch: false });
  private readonly reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  private readonly mobileCompletion = window.matchMedia('(max-width: 720px)');
  private feed: FeedKind = 'slides';
  private current = 0;
  private finished = false;
  private offsets: number[] = [];
  private returnFocus: HTMLElement | null = null;
  private overlayReturnFocus: HTMLElement | null = null;
  private wheelLockedUntil = 0;
  private resizeFrame = 0;
  private scrollCard: HTMLElement | null = null;
  private readonly storageKey: string;
  private readonly onCardScroll = () => this.updateScrollShadow();

  constructor(dialog: HTMLDialogElement) {
    this.dialog = dialog;

    const required = {
      shell: dialog.querySelector<HTMLElement>('.reading-deck-shell'),
      stage: dialog.querySelector<HTMLElement>('[data-deck-stage]'),
      track: dialog.querySelector<HTMLElement>('[data-deck-track]'),
      progress: dialog.querySelector<HTMLElement>('[data-deck-progress]'),
      status: dialog.querySelector<HTMLElement>('[data-deck-status]'),
      position: dialog.querySelector<HTMLElement>('[data-deck-position]'),
      cardTitle: dialog.querySelector<HTMLElement>('[data-deck-card-title]'),
      prev: dialog.querySelector<HTMLButtonElement>('[data-deck-prev]'),
      next: dialog.querySelector<HTMLButtonElement>('[data-deck-next]'),
      modeLabel: dialog.querySelector<HTMLElement>('[data-deck-mode-label]'),
      indexOverlay: dialog.querySelector<HTMLElement>('[data-deck-index]'),
      indexList: dialog.querySelector<HTMLOListElement>('[data-deck-index-list]'),
      sourceOverlay: dialog.querySelector<HTMLElement>('[data-deck-source-panel]'),
      sourceContent: dialog.querySelector<HTMLElement>('[data-deck-source-content]'),
      imageOverlay: dialog.querySelector<HTMLElement>('[data-deck-image-panel]'),
      image: dialog.querySelector<HTMLImageElement>('[data-deck-image]'),
      scrollShadow: dialog.querySelector<HTMLElement>('[data-deck-scroll-shadow]'),
      swipeHint: dialog.querySelector<HTMLElement>('[data-deck-swipe-hint]'),
      finish: dialog.querySelector<HTMLElement>('[data-deck-finish]'),
      finishTitle: dialog.querySelector<HTMLElement>('[data-deck-finish-title]'),
      finishCopy: dialog.querySelector<HTMLElement>('[data-deck-finish-copy]'),
      finishPrimary: dialog.querySelector<HTMLButtonElement>('[data-deck-finish-primary]'),
      finishPrimaryLabel: dialog.querySelector<HTMLElement>('[data-deck-finish-primary-label]'),
    };

    if (Object.values(required).some((value) => !value)) {
      throw new Error('Reading deck is missing required elements');
    }

    this.shell = required.shell!;
    this.stage = required.stage!;
    this.track = required.track!;
    this.progress = required.progress!;
    this.status = required.status!;
    this.position = required.position!;
    this.cardTitle = required.cardTitle!;
    this.prev = required.prev!;
    this.next = required.next!;
    this.modeLabel = required.modeLabel!;
    this.indexOverlay = required.indexOverlay!;
    this.indexList = required.indexList!;
    this.sourceOverlay = required.sourceOverlay!;
    this.sourceContent = required.sourceContent!;
    this.imageOverlay = required.imageOverlay!;
    this.image = required.image!;
    this.scrollShadow = required.scrollShadow!;
    this.swipeHint = required.swipeHint!;
    this.finish = required.finish!;
    this.finishTitle = required.finishTitle!;
    this.finishCopy = required.finishCopy!;
    this.finishPrimary = required.finishPrimary!;
    this.finishPrimaryLabel = required.finishPrimaryLabel!;
    this.storageKey = `reading-deck:${dialog.dataset.postId || location.pathname}`;

    const saved = this.readSavedState();
    if (saved.positions?.slides != null) this.positions.set('slides', saved.positions.slides);
    if (saved.positions?.tldr != null) this.positions.set('tldr', saved.positions.tldr);

    this.bind();
    const requested = this.locationFromHash();
    if (requested && this.supports(requested.feed)) {
      queueMicrotask(() => this.open(requested.feed, 'none', requested.index));
    }
  }

  destroy(): void {
    this.abort.abort();
    cancelAnimationFrame(this.resizeFrame);
    try { this.haptics.destroy(); } catch { /* non-fatal */ }
    if (this.dialog.open) this.dialog.close();
    document.body.classList.remove('reading-deck-open');
  }

  private bind(): void {
    const { signal } = this.abort;

    document.querySelectorAll<HTMLButtonElement>('[data-deck-open]').forEach((button) => {
      button.addEventListener('click', () => {
        const feed = button.dataset.deckOpen as FeedKind;
        if (!this.supports(feed)) return;
        this.returnFocus = button;
        this.open(feed, 'push');
      }, { signal });
    });

    this.dialog.querySelectorAll<HTMLButtonElement>('[data-deck-close]').forEach((button) => {
      button.addEventListener('click', () => this.requestClose(), { signal });
    });

    this.dialog.querySelectorAll<HTMLButtonElement>('[data-deck-feed]').forEach((button) => {
      button.addEventListener('click', () => {
        const feed = button.dataset.deckFeed as FeedKind;
        if (feed !== this.feed && this.supports(feed)) this.switchFeed(feed);
      }, { signal });
    });

    this.prev.addEventListener('click', () => this.go(-1), { signal });
    this.next.addEventListener('click', () => this.go(1), { signal });

    this.dialog.querySelector<HTMLButtonElement>('[data-deck-search]')
      ?.addEventListener('click', () => window.searchPalette?.open(), { signal });
    this.dialog.querySelector<HTMLButtonElement>('[data-deck-menu]')
      ?.addEventListener('click', () => window.__setNavDrawer?.(true), { signal });

    this.progress.addEventListener('click', (event) => {
      const button = (event.target as Element).closest<HTMLButtonElement>('[data-deck-progress-index]');
      if (button) this.show(Number(button.dataset.deckProgressIndex), true, true);
    }, { signal });

    this.dialog.querySelectorAll<HTMLButtonElement>('[data-deck-index-open]').forEach((button) => {
      button.addEventListener('click', () => this.openIndex(button), { signal });
    });
    this.dialog.querySelector<HTMLButtonElement>('[data-deck-index-close]')
      ?.addEventListener('click', () => this.closeOverlay(this.indexOverlay), { signal });
    this.dialog.querySelector<HTMLButtonElement>('[data-deck-source-close]')
      ?.addEventListener('click', () => this.closeOverlay(this.sourceOverlay), { signal });
    this.dialog.querySelector<HTMLButtonElement>('[data-deck-image-close]')
      ?.addEventListener('click', () => this.closeOverlay(this.imageOverlay), { signal });

    this.indexList.addEventListener('click', (event) => {
      const button = (event.target as Element).closest<HTMLButtonElement>('[data-card-index]');
      if (!button) return;
      this.closeOverlay(this.indexOverlay, false);
      this.show(Number(button.dataset.cardIndex), true);
      this.currentCard()?.focus({ preventScroll: true });
    }, { signal });

    [this.indexOverlay, this.sourceOverlay, this.imageOverlay].forEach((overlay) => {
      overlay.addEventListener('click', (event) => {
        if (event.target === overlay) this.closeOverlay(overlay);
      }, { signal });
    });

    this.track.addEventListener('click', (event) => this.handleDeckAction(event), { signal });
    this.finish.addEventListener('click', (event) => {
      event.stopPropagation();
      this.handleDeckAction(event);
    }, { signal });
    this.dialog.querySelectorAll<HTMLButtonElement>('[data-deck-neighbor]').forEach((button) => {
      button.addEventListener('click', () => this.go(Number(button.dataset.deckNeighbor)), { signal });
    });
    this.dialog.addEventListener('cancel', (event) => {
      event.preventDefault();
      this.requestClose();
    }, { signal });
    this.dialog.addEventListener('keydown', (event) => this.onKeydown(event), { signal });
    this.bindPointerGestures(signal);
    this.bindTrackpad(signal);

    window.addEventListener('resize', () => this.scheduleMeasure(), { signal });
    this.mobileCompletion.addEventListener('change', () => this.scheduleMeasure(), { signal });
    window.addEventListener('popstate', () => this.syncFromLocation(), { signal });
    window.addEventListener('hashchange', () => this.syncFromLocation(), { signal });
  }

  private supports(feed: FeedKind): boolean {
    return this.dialog.dataset[feed === 'slides' ? 'hasSlides' : 'hasTldr'] === 'true';
  }

  private locationFromHash(): DeckLocation | null {
    const match = window.location.hash.match(DECK_HASH);
    if (!match) return null;
    return {
      feed: match[1] as FeedKind,
      index: match[2] == null ? null : Number(match[2]),
    };
  }

  private open(feed: FeedKind, historyMode: 'push' | 'replace' | 'none', requestedIndex: number | null = null): void {
    if (!this.supports(feed)) return;
    if (!this.dialog.open) {
      this.dialog.show();
      document.body.classList.add('reading-deck-open');
    }

    this.renderFeed(feed, requestedIndex);

    if (historyMode !== 'none') {
      const state = { ...(history.state || {}), readingDeck: true, readingDeckKind: feed };
      const url = `${location.pathname}${location.search}${this.hashFor(feed, this.current)}`;
      historyMode === 'push'
        ? history.pushState(state, '', url)
        : history.replaceState(state, '', url);
    }

    requestAnimationFrame(() => {
      this.measure();
      this.place(false);
      this.maybeShowSwipeHint();
      this.dialog.querySelector<HTMLButtonElement>('[data-deck-close]')?.focus({ preventScroll: true });
    });
  }

  private requestClose(): void {
    if ((history.state as Record<string, unknown> | null)?.readingDeck && DECK_HASH.test(location.hash)) {
      history.back();
      return;
    }

    if (DECK_HASH.test(location.hash)) {
      history.replaceState({ ...(history.state || {}), readingDeck: false }, '', `${location.pathname}${location.search}`);
    }
    this.close();
  }

  private close(): void {
    this.closeOverlay(this.indexOverlay, false);
    this.closeOverlay(this.sourceOverlay, false);
    this.closeOverlay(this.imageOverlay, false);
    if (this.dialog.open) this.dialog.close();
    document.body.classList.remove('reading-deck-open');
    this.returnFocus?.focus({ preventScroll: true });
    this.returnFocus = null;
  }

  private syncFromLocation(): void {
    const requested = this.locationFromHash();
    if (requested && this.supports(requested.feed)) {
      this.open(requested.feed, 'none', requested.index);
    } else if (this.dialog.open) {
      this.close();
    }
  }

  private switchFeed(feed: FeedKind): void {
    this.positions.set(this.feed, this.current);
    this.renderFeed(feed);
    const state = { ...(history.state || {}), readingDeckKind: feed };
    history.replaceState(state, '', `${location.pathname}${location.search}${this.hashFor(feed, this.current)}`);
    this.saveState();
    this.tick();
  }

  private renderFeed(feed: FeedKind, requestedIndex: number | null = null): void {
    this.hideFinish(false);
    this.feed = feed;
    const model = this.feedCache.get(feed) || this.buildFeed(feed);
    this.feedCache.set(feed, model);
    this.updateFinishContent(model);
    this.track.replaceChildren(...model.cards.map((card) => card.element));
    this.syncFinishPlacement();
    const preferred = requestedIndex ?? this.positions.get(feed) ?? 0;
    this.current = Math.min(Math.max(0, preferred), Math.max(0, model.cards.length - 1));
    this.offsets = [];
    this.modeLabel.textContent = feed === 'tldr' ? 'Quick read' : 'Deep read';
    this.dialog.dataset.activeFeed = feed;
    this.dialog.querySelectorAll<HTMLButtonElement>('[data-deck-feed]').forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.deckFeed === feed));
    });
    this.buildProgress(model);
    this.buildIndex(model);
    this.show(this.current, false);
    queueMicrotask(() => {
      window.initializeWikilinks?.();
      window.initializeAnnotations?.({ animate: false });
      window.initializeMermaid?.();
    });
  }

  private buildFeed(feed: FeedKind): DeckFeedModel {
    const source = this.sourceFor(feed);
    const sources = new Map<string, HTMLElement>();
    const minutes = Math.max(1, Math.ceil(textWords(source.textContent || '') / (feed === 'tldr' ? 240 : 210)));

    source.querySelectorAll('script, style, .post-colophon, [data-pagefind-ignore]').forEach((node) => node.remove());

    const sourceSections = Array.from(source.querySelectorAll<HTMLElement>('section[data-footnotes], .deck-citation-registry'));
    const citationTemplate = document.querySelector<HTMLTemplateElement>('template[data-deck-citation-template]');
    if (citationTemplate) {
      const citationSection = citationTemplate.content.firstElementChild?.cloneNode(true) as HTMLElement | undefined;
      if (citationSection) sourceSections.push(citationSection);
    }

    sourceSections.forEach((section) => {
      if (section.isConnected || source.contains(section)) section.remove();
      if (section.id) sources.set(section.id, section);
      section.querySelectorAll<HTMLElement>('[id]').forEach((element) => sources.set(element.id, element));
    });

    const groups = this.groupSourceNodes(source);
    const cards: DeckCardModel[] = [this.createCoverCard(feed, minutes)];
    groups.forEach((group) => {
      this.chunkGroup(group.nodes).forEach((chunk, chunkIndex) => {
        const card = document.createElement('section');
        card.className = 'reading-deck-card prose dark:prose-dark max-w-none';
        card.tabIndex = -1;
        card.setAttribute('role', 'group');
        card.setAttribute('aria-roledescription', 'slide');
        chunk.forEach((node) => card.appendChild(node));
        const title = cleanHeading(card.querySelector('h2, h3'), chunkIndex ? `${group.title}, continued` : group.title);
        cards.push({ element: card, title });
      });
    });

    if (sourceSections.length) {
      const sourceCard = document.createElement('section');
      sourceCard.className = 'reading-deck-card prose dark:prose-dark max-w-none reading-deck-sources-card';
      sourceCard.tabIndex = -1;
      sourceCard.setAttribute('role', 'group');
      sourceCard.setAttribute('aria-roledescription', 'slide');
      const heading = document.createElement('h2');
      heading.textContent = 'Sources';
      sourceCard.appendChild(heading);
      sourceSections.forEach((section) => {
        section.querySelectorAll('[data-footnote-backref]').forEach((backref) => backref.remove());
        const nestedHeading = section.querySelector(':scope > h2');
        if (nestedHeading && cleanHeading(nestedHeading, '').match(SOURCE_HEADING)) nestedHeading.remove();
        sourceCard.appendChild(section);
      });
      cards.push({ element: sourceCard, title: 'Sources' });
    }

    if (cards.length === 1) {
      const fallback = document.createElement('section');
      fallback.className = 'reading-deck-card prose dark:prose-dark max-w-none';
      fallback.tabIndex = -1;
      const heading = document.createElement('h2');
      heading.textContent = 'Overview';
      fallback.append(heading, ...Array.from(source.childNodes));
      cards.splice(1, 0, { element: fallback, title: 'Overview' });
    }

    cards.push({ element: this.finish, title: 'Complete', isTerminal: true });

    const contentTotal = cards.filter((card) => !card.isCover && !card.isTerminal).length;
    cards.forEach((card, index) => {
      if (card.isTerminal) {
        card.element.setAttribute('aria-label', 'Reading complete');
        return;
      }
      card.element.setAttribute('aria-label', card.isCover
        ? `${feed === 'tldr' ? 'Quick read' : 'Deep read'} cover`
        : `${card.title}, card ${index} of ${contentTotal}`);
      this.namespaceCard(card.element, `${feed}-${index + 1}`, sources);
      card.element.querySelectorAll<HTMLImageElement>('img:not(.reading-deck-cover-image)').forEach((image) => {
        image.classList.add('reading-deck-zoomable');
        image.tabIndex = 0;
        image.setAttribute('role', 'button');
        image.setAttribute('aria-label', image.alt ? `Expand image: ${image.alt}` : 'Expand image');
      });
    });

    return { cards, sources, minutes };
  }

  private createCoverCard(feed: FeedKind, minutes: number): DeckCardModel {
    const card = document.createElement('section');
    card.className = 'reading-deck-card reading-deck-cover-card';
    card.tabIndex = -1;
    card.setAttribute('role', 'group');
    card.setAttribute('aria-roledescription', 'slide');

    const cover = this.dialog.dataset.coverImage;
    if (cover) {
      const image = document.createElement('img');
      image.className = 'reading-deck-cover-image';
      image.src = cover;
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
    mode.textContent = feed === 'tldr' ? 'Quick read' : 'Deep read';
    const title = document.createElement('h2');
    title.textContent = this.dialog.dataset.postTitle || 'Article';
    const description = document.createElement('p');
    description.textContent = this.dialog.dataset.postDescription || 'Read the argument one card at a time.';
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

  private sourceFor(feed: FeedKind): HTMLElement {
    if (feed === 'slides') {
      const article = document.querySelector<HTMLElement>('#post-content');
      if (!article) return document.createElement('div');
      return article.cloneNode(true) as HTMLElement;
    }

    const template = document.querySelector<HTMLTemplateElement>('template[data-deck-source-template="tldr"]');
    const fragment = template?.content.cloneNode(true) as DocumentFragment | undefined;
    return fragment?.querySelector<HTMLElement>('[data-deck-source-root]') || document.createElement('div');
  }

  private groupSourceNodes(source: HTMLElement): Array<{ title: string; nodes: ChildNode[] }> {
    const groups: Array<{ title: string; nodes: ChildNode[] }> = [];
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

  private chunkGroup(nodes: ChildNode[]): ChildNode[][] {
    const total = textWords(nodes.map((node) => node.textContent || '').join(' '));
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
      const nodeWords = textWords(node.textContent || '');
      const h3Boundary = element?.tagName === 'H3' && words >= 120;
      const blockBoundary = words >= 380 && index > 0;
      if (chunk.length && (h3Boundary || blockBoundary)) flush();
      chunk.push(node);
      words += nodeWords;
    });
    flush();

    return chunks.length ? chunks : [[...nodes]];
  }

  private namespaceCard(card: HTMLElement, prefix: string, sources: Map<string, HTMLElement>): void {
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
        anchor.href = '#';
      } else if (ids.has(oldId)) {
        anchor.href = `#${ids.get(oldId)}`;
      }
    });
  }

  private buildIndex(model: DeckFeedModel): void {
    this.indexList.replaceChildren(...model.cards.flatMap((card, index) => {
      if (card.isCover || card.isTerminal) return [];
      const item = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.cardIndex = String(index);
      button.textContent = card.title;
      item.appendChild(button);
      return [item];
    }));
  }

  private buildProgress(model: DeckFeedModel): void {
    this.progress.replaceChildren(...model.cards.flatMap((card, index) => {
      if (card.isCover || card.isTerminal) return [];
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.deckProgressIndex = String(index);
      button.setAttribute('aria-label', `Go to card ${index}: ${card.title}`);
      const fill = document.createElement('span');
      fill.setAttribute('aria-hidden', 'true');
      button.appendChild(fill);
      return [button];
    }));
  }

  private show(index: number, animate: boolean, haptic = false): void {
    const model = this.feedCache.get(this.feed);
    if (!model?.cards.length) return;
    this.finished = false;
    this.finish.hidden = false;
    this.finish.dataset.deckFinishActive = 'false';
    this.finish.inert = true;
    this.finish.setAttribute('aria-hidden', 'true');
    this.stage.classList.remove('is-finished');
    const lastContentIndex = this.lastContentIndex(model);
    const nextIndex = Math.max(0, Math.min(lastContentIndex, index));
    const changed = nextIndex !== this.current;
    this.current = nextIndex;
    this.positions.set(this.feed, nextIndex);
    this.saveState();

    model.cards.forEach((card, cardIndex) => {
      if (card.isTerminal) {
        card.element.dataset.deckDistance = String(Math.min(2, Math.abs(cardIndex - nextIndex)));
        return;
      }
      const active = cardIndex === nextIndex;
      card.element.dataset.deckDistance = String(Math.min(2, Math.abs(cardIndex - nextIndex)));
      card.element.toggleAttribute('inert', !active);
      card.element.setAttribute('aria-hidden', String(!active));
      card.element.style.contentVisibility = Math.abs(cardIndex - nextIndex) <= 1 ? 'visible' : '';
    });

    this.syncUI(model);
    this.place(animate);
    this.bindCurrentCardScroll();
    if (changed) this.dismissSwipeHint();
    if (this.dialog.open && this.locationFromHash()) this.updateLocationHash();
    if (changed && haptic) this.tick();
  }

  private go(delta: number): void {
    const model = this.feedCache.get(this.feed);
    if (!model) return;
    if (this.finished) {
      if (delta < 0) this.hideFinish(true);
      return;
    }
    const lastContentIndex = this.lastContentIndex(model);
    const next = Math.max(0, Math.min(lastContentIndex, this.current + delta));
    if (next === this.current) {
      if (delta > 0 && this.current === lastContentIndex) this.showFinish();
      return;
    }
    this.show(next, true, true);
  }

  private showFinish(): void {
    const model = this.feedCache.get(this.feed);
    if (!model) return;
    this.finished = true;
    const terminalIndex = model.cards.findIndex((card) => card.isTerminal);
    model.cards.forEach((card, cardIndex) => {
      const terminal = Boolean(card.isTerminal);
      card.element.dataset.deckDistance = String(Math.min(2, Math.abs(cardIndex - terminalIndex)));
      card.element.inert = !terminal;
      card.element.setAttribute('aria-hidden', String(!terminal));
    });
    this.updateFinishContent(model);
    this.finish.hidden = false;
    this.finish.dataset.deckFinishActive = 'true';
    this.stage.classList.add('is-finished');
    this.scrollShadow.hidden = true;
    this.position.textContent = 'Done';
    this.cardTitle.textContent = 'Complete';
    this.prev.disabled = false;
    this.next.disabled = true;
    this.next.querySelector('span')!.textContent = 'Next';
    this.syncNeighborControls(model);
    this.status.textContent = 'Deck complete.';
    this.progress.querySelectorAll<HTMLButtonElement>('[data-deck-progress-index]').forEach((button) => {
      button.toggleAttribute('data-complete', true);
      button.removeAttribute('aria-current');
    });
    this.place(true);
    this.tick();
    requestAnimationFrame(() => this.finishPrimary.focus({ preventScroll: true }));
  }

  private updateFinishContent(model: DeckFeedModel): void {
    this.finishTitle.textContent = this.feed === 'tldr' ? 'You have the core argument' : 'You reached the end';
    this.finishCopy.textContent = this.feed === 'tldr'
      ? `You finished the ${model.minutes}-minute quick read. Return to the article or share this view.`
      : `You finished the ${model.minutes}-minute deep read. Share this view or return to the article.`;
    this.finishPrimary.dataset.deckAction = 'article';
    this.finishPrimaryLabel.textContent = 'Back to article';
  }

  private hideFinish(restoreTrack = true): void {
    this.finished = false;
    this.finish.hidden = false;
    this.finish.dataset.deckFinishActive = 'false';
    this.finish.inert = true;
    this.finish.setAttribute('aria-hidden', 'true');
    this.stage.classList.remove('is-finished');
    if (restoreTrack) this.show(this.current, false);
  }

  private syncUI(model: DeckFeedModel): void {
    const card = model.cards[this.current];
    const contentTotal = model.cards.filter((item) => !item.isCover && !item.isTerminal).length;
    const contentIndex = model.cards.slice(0, this.current + 1).filter((item) => !item.isCover && !item.isTerminal).length;
    this.position.textContent = card.isCover ? 'Ready' : `${contentIndex} / ${contentTotal}`;
    this.cardTitle.textContent = card.isCover ? 'Swipe to begin' : card.title;
    this.prev.disabled = this.current === 0;
    this.next.disabled = false;
    this.next.querySelector('span')!.textContent = this.current === this.lastContentIndex(model) ? 'Finish' : 'Next';
    this.syncNeighborControls(model);
    this.status.textContent = card.isCover
      ? `${this.feed === 'tldr' ? 'Quick read' : 'Deep read'} cover.`
      : `${card.title}. Card ${contentIndex} of ${contentTotal}.`;
    this.indexList.querySelectorAll<HTMLButtonElement>('[data-card-index]').forEach((button) => {
      if (Number(button.dataset.cardIndex) === this.current) button.setAttribute('aria-current', 'true');
      else button.removeAttribute('aria-current');
    });
    this.progress.querySelectorAll<HTMLButtonElement>('[data-deck-progress-index]').forEach((button) => {
      const index = Number(button.dataset.deckProgressIndex);
      button.toggleAttribute('data-complete', index < this.current);
      if (index === this.current) button.setAttribute('aria-current', 'step');
      else button.removeAttribute('aria-current');
    });
  }

  private syncNeighborControls(model: DeckFeedModel): void {
    this.dialog.querySelectorAll<HTMLButtonElement>('[data-deck-neighbor]').forEach((button) => {
      const delta = Number(button.dataset.deckNeighbor);
      button.hidden = delta < 0
        ? !this.finished && this.current === 0
        : this.finished || this.current > this.lastContentIndex(model);
    });
  }

  private hashFor(feed: FeedKind, index: number): string {
    return `#${feed}-${index}`;
  }

  private updateLocationHash(): void {
    const state = { ...(history.state || {}), readingDeckKind: this.feed };
    history.replaceState(state, '', `${location.pathname}${location.search}${this.hashFor(this.feed, this.current)}`);
  }

  private readSavedState(): SavedDeckState {
    try {
      return JSON.parse(localStorage.getItem(this.storageKey) || '{}') as SavedDeckState;
    } catch {
      return {};
    }
  }

  private saveState(): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify({
        feed: this.feed,
        positions: {
          slides: this.positions.get('slides') || 0,
          tldr: this.positions.get('tldr') || 0,
        },
      } satisfies SavedDeckState));
    } catch { /* private browsing or disabled storage */ }
  }

  private bindCurrentCardScroll(): void {
    this.scrollCard?.removeEventListener('scroll', this.onCardScroll);
    this.scrollCard = this.currentCard();
    this.scrollCard?.addEventListener('scroll', this.onCardScroll, { passive: true });
    requestAnimationFrame(() => this.updateScrollShadow());
  }

  private updateScrollShadow(): void {
    const card = this.currentCard();
    if (!card) {
      this.scrollShadow.hidden = true;
      return;
    }
    const overflow = card.scrollHeight > card.clientHeight + 10;
    const moreBelow = card.scrollTop + card.clientHeight < card.scrollHeight - 10;
    this.scrollShadow.hidden = this.finished || !(overflow && moreBelow);
  }

  private maybeShowSwipeHint(): void {
    try {
      if (localStorage.getItem(SWIPE_HINT_KEY)) return;
      this.swipeHint.hidden = false;
    } catch { /* show the harmless hint when storage is unavailable */
      this.swipeHint.hidden = false;
    }
  }

  private dismissSwipeHint(): void {
    if (this.swipeHint.hidden) return;
    this.swipeHint.hidden = true;
    try { localStorage.setItem(SWIPE_HINT_KEY, '1'); } catch { /* ignore */ }
  }

  private currentCard(): HTMLElement | null {
    return this.feedCache.get(this.feed)?.cards[this.current]?.element || null;
  }

  private lastContentIndex(model: DeckFeedModel): number {
    const terminalIndex = model.cards.findIndex((card) => card.isTerminal);
    return terminalIndex > 0 ? terminalIndex - 1 : model.cards.length - 1;
  }

  private visualIndex(model: DeckFeedModel): number {
    if (this.finished && !this.mobileCompletion.matches) {
      const terminalIndex = model.cards.findIndex((card) => card.isTerminal);
      if (terminalIndex >= 0) return terminalIndex;
    }
    return this.current;
  }

  private measure(): void {
    const cards = this.feedCache.get(this.feed)?.cards || [];
    const style = getComputedStyle(this.stage);
    const contentWidth = this.stage.clientWidth
      - Number.parseFloat(style.paddingLeft || '0')
      - Number.parseFloat(style.paddingRight || '0');
    const center = contentWidth / 2;
    this.offsets = cards.map(({ element }) => center - (element.offsetLeft + element.offsetWidth / 2));
  }

  private syncFinishPlacement(): void {
    const parent = this.mobileCompletion.matches ? this.stage : this.track;
    if (this.finish.parentElement !== parent) parent.appendChild(this.finish);
  }

  private place(animate: boolean): void {
    const model = this.feedCache.get(this.feed);
    if (!model) return;
    if (this.offsets.length !== model.cards.length) this.measure();
    const offset = this.offsets[this.visualIndex(model)] || 0;
    if (!animate || this.reduceMotion.matches) {
      const transition = this.track.style.transition;
      this.track.style.transition = 'none';
      this.track.style.transform = `translate3d(${Math.round(offset)}px, 0, 0)`;
      void this.track.offsetWidth;
      this.track.style.transition = transition;
    } else {
      this.track.style.transform = `translate3d(${Math.round(offset)}px, 0, 0)`;
    }
  }

  private scheduleMeasure(): void {
    this.offsets = [];
    if (this.resizeFrame) return;
    this.resizeFrame = requestAnimationFrame(() => {
      this.resizeFrame = 0;
      if (!this.dialog.open) return;
      this.syncFinishPlacement();
      this.measure();
      this.place(false);
    });
  }

  private tick(): void {
    if (this.reduceMotion.matches) return;
    void this.haptics.trigger('selection').catch(() => {});
  }

  private openIndex(trigger: HTMLElement): void {
    this.overlayReturnFocus = trigger;
    this.shell.inert = true;
    this.indexOverlay.hidden = false;
    this.indexList.querySelector<HTMLButtonElement>('[aria-current="true"]')
      ?.focus({ preventScroll: true });
  }

  private openSource(sourceId: string, trigger: HTMLElement): void {
    const source = this.feedCache.get(this.feed)?.sources.get(sourceId);
    if (!source) return;
    this.overlayReturnFocus = trigger;
    const clone = source.cloneNode(true) as HTMLElement;
    clone.removeAttribute('id');
    clone.querySelectorAll('[id]').forEach((element) => element.removeAttribute('id'));
    clone.querySelectorAll('[data-footnote-backref]').forEach((element) => element.remove());
    this.sourceContent.replaceChildren(clone);
    this.shell.inert = true;
    this.sourceOverlay.hidden = false;
    this.sourceOverlay.querySelector<HTMLButtonElement>('[data-deck-source-close]')
      ?.focus({ preventScroll: true });
  }

  private openImage(source: HTMLImageElement): void {
    this.overlayReturnFocus = source;
    this.image.src = source.currentSrc || source.src;
    this.image.alt = source.alt || '';
    this.shell.inert = true;
    this.imageOverlay.hidden = false;
    this.imageOverlay.querySelector<HTMLButtonElement>('[data-deck-image-close]')
      ?.focus({ preventScroll: true });
  }

  private closeOverlay(overlay: HTMLElement, restoreFocus = true): void {
    if (overlay.hidden) return;
    overlay.hidden = true;
    if (overlay === this.sourceOverlay) this.sourceContent.replaceChildren();
    if (overlay === this.imageOverlay) this.image.removeAttribute('src');
    if (this.indexOverlay.hidden && this.sourceOverlay.hidden && this.imageOverlay.hidden) this.shell.inert = false;
    if (restoreFocus) this.overlayReturnFocus?.focus({ preventScroll: true });
    this.overlayReturnFocus = null;
  }

  private handleSourceLink(event: Event): void {
    const anchor = (event.target as Element).closest<HTMLAnchorElement>('a[data-deck-source-id]');
    if (!anchor?.dataset.deckSourceId) return;
    event.preventDefault();
    this.openSource(anchor.dataset.deckSourceId, anchor);
  }

  private handleDeckAction(event: Event): void {
    const target = event.target as Element;
    if (this.finished && target === this.finish) {
      this.hideFinish(true);
      return;
    }
    const source = target.closest<HTMLAnchorElement>('a[data-deck-source-id]');
    if (source) {
      this.handleSourceLink(event);
      return;
    }
    const image = target.closest<HTMLImageElement>('img.reading-deck-zoomable');
    if (image) {
      this.openImage(image);
      return;
    }
    const action = target.closest<HTMLButtonElement>('[data-deck-action]')?.dataset.deckAction;
    if (!action) return;
    if (action === 'restart') this.show(0, true, true);
    else if (action === 'start') this.show(1, true, true);
    else if (action === 'article') this.requestClose();
    else if (action === 'share') void this.shareCurrentCard();
  }

  private async shareCurrentCard(): Promise<void> {
    const url = `${location.origin}${location.pathname}${location.search}${this.hashFor(this.feed, this.current)}`;
    const data = {
      title: this.dialog.dataset.postTitle || document.title,
      text: this.currentCard()?.getAttribute('aria-label') || 'Open this reading card',
      url,
    };
    try {
      if (navigator.share) await navigator.share(data);
      else {
        await navigator.clipboard.writeText(url);
        this.status.textContent = 'Link copied to clipboard.';
      }
    } catch (error) {
      if ((error as DOMException)?.name !== 'AbortError') this.status.textContent = 'Could not share this card.';
    }
  }

  private onKeydown(event: KeyboardEvent): void {
    const overlay = !this.sourceOverlay.hidden
      ? this.sourceOverlay
      : !this.indexOverlay.hidden
        ? this.indexOverlay
        : !this.imageOverlay.hidden
          ? this.imageOverlay
        : null;

    if (overlay) {
      if (event.key === 'Escape') {
        event.preventDefault();
        this.closeOverlay(overlay);
      } else if (event.key === 'Tab') {
        const focusable = focusableWithin(overlay);
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
      return;
    }

    const target = event.target as Element;
    const zoomable = target.closest<HTMLImageElement>('img.reading-deck-zoomable');
    if (zoomable && (event.key === 'Enter' || event.code === 'Space')) {
      event.preventDefault();
      this.openImage(zoomable);
      return;
    }

    if (this.finished && event.key === 'Escape') {
      event.preventDefault();
      this.hideFinish(true);
      return;
    }

    if ((event.target as Element).matches('input, textarea, select, [contenteditable="true"]')) return;
    if (event.key === 'Tab') {
      const focusable = focusableWithin(this.shell);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      this.requestClose();
    } else if (event.key === 'ArrowRight' || (event.code === 'Space' && !event.shiftKey)) {
      event.preventDefault();
      this.go(1);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      this.go(-1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      this.show(0, true, true);
    } else if (event.key === 'End') {
      event.preventDefault();
      const last = (this.feedCache.get(this.feed)?.cards.length || 1) - 1;
      this.show(last, true, true);
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const card = this.currentCard();
      const amount = Math.max(90, Math.round((card?.clientHeight || 400) * 0.25));
      card?.scrollBy({ top: event.key === 'ArrowDown' ? amount : -amount, behavior: this.reduceMotion.matches ? 'auto' : 'smooth' });
    }
  }

  private bindPointerGestures(signal: AbortSignal): void {
    let live = false;
    let axis: '' | 'x' | 'y' = '';
    let pointerId = -1;
    let startX = 0;
    let startY = 0;
    let lastX = 0;
    let lastTime = 0;
    let velocity = 0;
    let baseOffset = 0;

    const hasSelection = () => Boolean(window.getSelection?.()?.toString());

    this.stage.addEventListener('pointerdown', (event) => {
      const target = event.target as Element;
      const mouseOnCard = event.pointerType === 'mouse' && Boolean(target.closest('.reading-deck-card'));
      if (this.finished || event.button !== 0 || mouseOnCard || !this.indexOverlay.hidden || !this.sourceOverlay.hidden || !this.imageOverlay.hidden || hasSelection()) return;
      live = true;
      axis = '';
      pointerId = event.pointerId;
      startX = lastX = event.clientX;
      startY = event.clientY;
      lastTime = event.timeStamp;
      velocity = 0;
      if (this.offsets.length === 0) this.measure();
      baseOffset = this.offsets[this.current] || 0;
    }, { signal });

    this.stage.addEventListener('pointermove', (event) => {
      if (!live) return;
      if (hasSelection()) { live = false; axis = ''; return; }
      const dx = event.clientX - startX;
      const dy = event.clientY - startY;
      if (!axis) {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        axis = Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y';
      }
      if (axis === 'x') {
        event.preventDefault();
        if (!this.stage.hasPointerCapture(pointerId)) this.stage.setPointerCapture(pointerId);
        this.dismissSwipeHint();
        const elapsed = event.timeStamp - lastTime;
        if (elapsed > 0) velocity = (event.clientX - lastX) / elapsed;
        lastX = event.clientX;
        lastTime = event.timeStamp;
        const model = this.feedCache.get(this.feed);
        const atStart = this.current === 0 && dx > 0;
        const atEnd = this.current === (model?.cards.length || 1) - 1 && dx < 0;
        const drag = (atStart || atEnd) ? dx * 0.22 : dx;
        this.stage.classList.add('is-dragging');
        this.track.style.transition = 'none';
        this.track.style.transform = `translate3d(${Math.round(baseOffset + drag)}px, 0, 0)`;
      }
    }, { signal });

    const end = (cancelled = false) => {
      if (!live) return;
      live = false;
      this.stage.classList.remove('is-dragging');
      this.track.style.transition = '';
      if (!cancelled && axis === 'x' && !hasSelection()) {
        const distance = startX - lastX;
        if (Math.abs(distance) >= 44 || Math.abs(velocity) >= 0.35) this.go(distance > 0 ? 1 : -1);
        else this.place(true);
      } else if (axis === 'x') {
        this.place(true);
      }
      axis = '';
      pointerId = -1;
    };
    this.stage.addEventListener('pointerup', () => end(false), { signal });
    this.stage.addEventListener('pointercancel', () => end(true), { signal });
  }

  private bindTrackpad(signal: AbortSignal): void {
    let accumulated = 0;
    let lastWheelAt = 0;
    this.stage.addEventListener('wheel', (event) => {
      if (Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return;
      event.preventDefault();
      const now = performance.now();
      if (now - lastWheelAt > 180) accumulated = 0;
      lastWheelAt = now;
      if (now < this.wheelLockedUntil) return;
      accumulated += event.deltaX;
      if (Math.abs(accumulated) < 24) return;
      this.wheelLockedUntil = now + 420;
      this.go(accumulated > 0 ? 1 : -1);
      accumulated = 0;
    }, { passive: false, signal });
  }
}

let activeController: ReadingDeckController | null = null;

function initializeReadingDeck(): void {
  activeController?.destroy();
  activeController = null;
  const dialog = document.querySelector<HTMLDialogElement>('dialog[data-reading-deck]');
  if (!dialog) {
    document.documentElement.classList.remove('reading-deck-ready');
    document.body.classList.remove('reading-deck-open');
    return;
  }

  try {
    activeController = new ReadingDeckController(dialog);
    document.documentElement.classList.add('reading-deck-ready');
  } catch (error) {
    document.documentElement.classList.remove('reading-deck-ready');
    if (import.meta.env.DEV) console.warn('[reading-deck]', error);
  }
}

window.initializeReadingDeck = initializeReadingDeck;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeReadingDeck, { once: true });
} else {
  initializeReadingDeck();
}

document.addEventListener('astro:page-load', initializeReadingDeck);
window.addEventListener('pageshow', (event) => {
  if (event.persisted) initializeReadingDeck();
});
