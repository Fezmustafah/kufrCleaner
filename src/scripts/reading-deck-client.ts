import { WebHaptics } from 'web-haptics';
import { compileReadingFeed } from './reading-deck/feed';
import {
  createBrowserDeckHistory,
  formatDeckHash,
} from './reading-deck/history';
import { attachReadingDeck, type ReadingDeckHandle } from './reading-deck';
import type {
  CompiledReadingFeed as DeckFeedModel,
  FeedKind,
} from './reading-deck/types';
import {
  applyViewportCss,
  createBrowserDeckViewport,
} from './reading-deck/viewport';

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

const SWIPE_HINT_KEY = 'reading-deck-swipe-hint-seen';

function focusableWithin(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(
    'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'
  )).filter((element) => !element.hidden && element.getAttribute('aria-hidden') !== 'true');
}

export class ReadingDeckController implements ReadingDeckHandle {
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
  private readonly haptics = new WebHaptics({ debug: false, showSwitch: true });
  private readonly deckHistory = createBrowserDeckHistory(window);
  private readonly viewport = createBrowserDeckViewport(window);
  private viewportState = this.viewport.snapshot();
  private unsubscribeHistory: () => void = () => {};
  private unsubscribeViewport: () => void = () => {};
  private feed: FeedKind = 'slides';
  private current = 0;
  private finished = false;
  private offsets: number[] = [];
  private finishOffset = 0;
  private returnFocus: HTMLElement | null = null;
  private overlayReturnFocus: HTMLElement | null = null;
  private wheelLockedUntil = 0;
  private resizeFrame = 0;
  private mobileScrollTimer = 0;
  private mobileTouchActive = false;
  private pendingMobileHapticIndex: number | null = null;
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
    const requested = this.deckHistory.read();
    if (requested && this.supports(requested.feed)) {
      queueMicrotask(() => this.open(requested.feed, 'none', requested.index, requested.targetId));
    }
  }

  destroy(): void {
    this.abort.abort();
    this.unsubscribeHistory();
    this.unsubscribeViewport();
    cancelAnimationFrame(this.resizeFrame);
    window.clearTimeout(this.mobileScrollTimer);
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
      if (!button) return;
      const index = Number(button.dataset.deckProgressIndex);
      if (index === this.current) this.tick();
      this.show(index, true, true);
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
      const index = Number(button.dataset.cardIndex);
      if (index === this.current) this.tick();
      this.show(index, true, true);
      this.currentCard()?.focus({ preventScroll: true });
    }, { signal });

    [this.indexOverlay, this.imageOverlay].forEach((overlay) => {
      overlay.addEventListener('click', (event) => {
        if (event.target === overlay) this.closeOverlay(overlay);
      }, { signal });
    });

    this.dialog.addEventListener('pointerdown', (event) => {
      if (this.sourceOverlay.hidden) return;
      const target = event.target as Element;
      const activatesNote = Boolean(target.closest('a[data-deck-source-id], .footnote-number'));
      if (!this.sourceOverlay.contains(target) && !activatesNote) this.closeOverlay(this.sourceOverlay, false);
    }, { signal });

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
    this.bindMobileCarousel(signal);
    this.bindPointerGestures(signal);
    this.bindTrackpad(signal);

    this.unsubscribeViewport = this.viewport.subscribe((snapshot) => {
      const mobileChanged = snapshot.mobile !== this.viewportState.mobile;
      this.viewportState = snapshot;
      applyViewportCss(this.dialog, snapshot);
      if (mobileChanged) {
        window.clearTimeout(this.mobileScrollTimer);
        this.mobileTouchActive = false;
        this.track.scrollLeft = 0;
        this.offsets = [];
      }
      this.scheduleMeasure();
    });
    this.unsubscribeHistory = this.deckHistory.subscribe(() => this.syncFromLocation());
  }

  private supports(feed: FeedKind): boolean {
    return this.dialog.dataset[feed === 'slides' ? 'hasSlides' : 'hasTldr'] === 'true';
  }

  private open(
    feed: FeedKind,
    historyMode: 'push' | 'replace' | 'none',
    requestedIndex: number | null = null,
    targetId: string | null = null,
  ): void {
    if (!this.supports(feed)) return;
    if (!this.dialog.open) {
      this.dialog.show();
      document.body.classList.add('reading-deck-open');
    }

    this.viewportState = this.viewport.snapshot();
    applyViewportCss(this.dialog, this.viewportState);
    this.renderFeed(feed, requestedIndex, targetId);

    if (historyMode !== 'none') {
      if (historyMode === 'push') this.deckHistory.push(feed, this.current);
      else this.deckHistory.replace(feed, this.current);
    }

    requestAnimationFrame(() => {
      this.measure();
      this.place(false);
      if (targetId) this.restoreHeading(targetId);
      this.maybeShowSwipeHint();
      this.dialog.querySelector<HTMLButtonElement>('[data-deck-close]')?.focus({ preventScroll: true });
    });
  }

  private requestClose(): void {
    if (this.deckHistory.close() === 'replace') this.close();
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
    const requested = this.deckHistory.read();
    if (requested && this.supports(requested.feed)) {
      this.open(requested.feed, 'none', requested.index, requested.targetId);
    } else if (this.dialog.open) {
      this.close();
    }
  }

  private switchFeed(feed: FeedKind): void {
    this.positions.set(this.feed, this.current);
    this.renderFeed(feed);
    this.deckHistory.replace(feed, this.current);
    this.saveState();
    this.tick();
  }

  private renderFeed(feed: FeedKind, requestedIndex: number | null = null, targetId: string | null = null): void {
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
    this.finishOffset = 0;
    this.modeLabel.textContent = feed === 'tldr' ? 'Quick read' : 'Deep read';
    this.dialog.dataset.activeFeed = feed;
    this.dialog.querySelectorAll<HTMLButtonElement>('[data-deck-feed]').forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.deckFeed === feed));
    });
    this.buildProgress(model);
    this.buildIndex(model);
    this.show(this.current, false, false, true, !targetId);
    queueMicrotask(() => {
      window.initializeWikilinks?.();
      window.initializeAnnotations?.({ animate: false });
      window.initializeMermaid?.();
    });
  }

  private buildFeed(feed: FeedKind): DeckFeedModel {
    return compileReadingFeed(this.sourceFor(feed), {
      kind: feed,
      title: this.dialog.dataset.postTitle || document.title,
      description: this.dialog.dataset.postDescription || '',
      coverImage: this.dialog.dataset.coverImage || null,
      citationTemplate: document.querySelector<HTMLTemplateElement>('template[data-deck-citation-template]'),
      cardHash: (kind, index) => this.hashFor(kind, index),
    });
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

  private buildIndex(model: DeckFeedModel): void {
    this.indexList.replaceChildren(...model.cards.flatMap((card, index) => {
      if (card.isCover) return [];
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
      if (card.isCover) return [];
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

  private show(
    index: number,
    animate: boolean,
    haptic = false,
    shouldPlace = true,
    updateHash = true,
  ): void {
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
      const active = cardIndex === nextIndex;
      card.element.dataset.deckDistance = String(Math.min(2, Math.abs(cardIndex - nextIndex)));
      card.element.toggleAttribute('inert', !active);
      card.element.setAttribute('aria-hidden', String(!active));
      card.element.style.contentVisibility = Math.abs(cardIndex - nextIndex) <= 1 ? 'visible' : '';
    });

    this.syncUI(model);
    if (shouldPlace) this.place(animate);
    this.bindCurrentCardScroll();
    if (changed) this.dismissSwipeHint();
    if (updateHash && this.dialog.open && this.deckHistory.read()) this.updateLocationHash();
    if (changed && haptic) {
      if (this.viewportState.mobile && shouldPlace) this.pendingMobileHapticIndex = nextIndex;
      else this.tick();
    }
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
    model.cards.forEach((card, cardIndex) => {
      card.element.dataset.deckDistance = String(Math.min(2, model.cards.length - cardIndex));
      card.element.inert = true;
      card.element.setAttribute('aria-hidden', 'true');
    });
    this.updateFinishContent(model);
    this.finish.hidden = false;
    this.finish.dataset.deckFinishActive = 'true';
    this.finish.inert = false;
    this.finish.setAttribute('aria-hidden', 'false');
    this.finish.setAttribute('aria-label', 'Reading complete');
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
    const contentTotal = model.cards.filter((item) => !item.isCover).length;
    const contentIndex = model.cards.slice(0, this.current + 1).filter((item) => !item.isCover).length;
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
    return formatDeckHash(feed, index);
  }

  private updateLocationHash(): void {
    this.deckHistory.replace(this.feed, this.current);
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
    this.scrollShadow.hidden = true;
    this.scrollCard?.prepend(this.scrollShadow);
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
    return model.cards.length - 1;
  }

  private measure(): void {
    if (this.viewportState.mobile) {
      this.offsets = [];
      return;
    }
    const cards = this.feedCache.get(this.feed)?.cards || [];
    const style = getComputedStyle(this.stage);
    const contentWidth = this.stage.clientWidth
      - Number.parseFloat(style.paddingLeft || '0')
      - Number.parseFloat(style.paddingRight || '0');
    const center = contentWidth / 2;
    this.offsets = cards.map(({ element }) => center - (element.offsetLeft + element.offsetWidth / 2));
    this.finishOffset = this.finish.parentElement === this.track
      ? center - (this.finish.offsetLeft + this.finish.offsetWidth / 2)
      : 0;
  }

  private syncFinishPlacement(): void {
    const parent = this.viewportState.mobile ? this.stage : this.track;
    if (this.finish.parentElement !== parent) parent.appendChild(this.finish);
  }

  private place(animate: boolean): void {
    const model = this.feedCache.get(this.feed);
    if (!model) return;
    if (this.viewportState.mobile) {
      const card = model.cards[this.current]?.element;
      if (!card || card.parentElement !== this.track) return;
      const left = card.offsetLeft - Math.max(0, (this.track.clientWidth - card.offsetWidth) / 2);
      this.track.scrollTo({
        left: Math.max(0, left),
        behavior: animate && !this.viewportState.reducedMotion ? 'smooth' : 'auto',
      });
      this.scheduleMobileSettle();
      return;
    }
    if (this.offsets.length !== model.cards.length) this.measure();
    const offset = this.finished ? this.finishOffset : this.offsets[this.current] || 0;
    if (!animate || this.viewportState.reducedMotion) {
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
      if (this.viewportState.mobile && this.mobileTouchActive) return;
      this.measure();
      this.place(false);
    });
  }

  private bindMobileCarousel(signal: AbortSignal): void {
    this.track.addEventListener('touchstart', () => {
      if (!this.viewportState.mobile) return;
      this.mobileTouchActive = true;
      this.pendingMobileHapticIndex = null;
      this.scrollShadow.hidden = true;
      this.dismissSwipeHint();
    }, { passive: true, signal });

    const finishTouch = () => {
      if (!this.viewportState.mobile) return;
      this.mobileTouchActive = false;
      this.scheduleMobileSettle();
    };
    this.track.addEventListener('touchend', finishTouch, { passive: true, signal });
    this.track.addEventListener('touchcancel', finishTouch, { passive: true, signal });

    this.track.addEventListener('scroll', () => {
      if (!this.viewportState.mobile) return;
      this.scrollShadow.hidden = true;
      this.scheduleMobileSettle();
    }, { passive: true, signal });
  }

  private scheduleMobileSettle(): void {
    if (!this.viewportState.mobile) return;
    window.clearTimeout(this.mobileScrollTimer);
    this.mobileScrollTimer = window.setTimeout(() => this.settleMobileCarousel(), 120);
  }

  private settleMobileCarousel(): void {
    if (!this.viewportState.mobile || this.mobileTouchActive) return;

    const model = this.feedCache.get(this.feed);
    if (!model) return;
    const center = this.track.scrollLeft + this.track.clientWidth / 2;
    let nearestIndex = this.current;
    let nearestDistance = Number.POSITIVE_INFINITY;

    model.cards.forEach((card, index) => {
      if (card.element.parentElement !== this.track) return;
      const cardCenter = card.element.offsetLeft + card.element.offsetWidth / 2;
      const distance = Math.abs(cardCenter - center);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = index;
      }
    });

    const changed = nearestIndex !== this.current;
    if (changed) this.show(nearestIndex, false, false, false);
    else this.bindCurrentCardScroll();

    if (changed || this.pendingMobileHapticIndex === nearestIndex) this.tick();
    this.pendingMobileHapticIndex = null;
  }

  private restoreHeading(targetId: string): void {
    requestAnimationFrame(() => {
      const target = document.getElementById(targetId);
      if (!target || !this.dialog.contains(target)) return;
      const card = target.closest<HTMLElement>('.reading-deck-card');
      if (!card) return;

      let top = 0;
      let node: HTMLElement | null = target;
      while (node && node !== card) {
        top += node.offsetTop;
        node = node.offsetParent as HTMLElement | null;
      }
      const paddingTop = Number.parseFloat(getComputedStyle(card).paddingTop || '0');
      card.scrollTo({ top: Math.max(0, top - paddingTop), behavior: 'auto' });
      this.updateScrollShadow();
    });
  }

  private tick(): void {
    void this.haptics.trigger('selection').catch(() => {});
  }

  private openIndex(trigger: HTMLElement): void {
    this.overlayReturnFocus = trigger;
    this.shell.inert = true;
    this.indexOverlay.hidden = false;
    this.tick();
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
    this.openNotePopover(clone, trigger);
  }

  private openMarginalia(trigger: HTMLElement): void {
    const container = trigger.closest<HTMLElement>('.footnote-container');
    const note = container?.querySelector<HTMLElement>('.footnote');
    if (!note) return;
    const clone = note.cloneNode(true) as HTMLElement;
    clone.removeAttribute('id');
    clone.style.removeProperty('top');
    clone.style.removeProperty('left');
    clone.style.removeProperty('width');
    this.openNotePopover(clone, trigger);
  }

  private openNotePopover(content: HTMLElement, trigger: HTMLElement): void {
    this.overlayReturnFocus = trigger;
    this.sourceContent.replaceChildren(content);
    this.sourceOverlay.hidden = false;
    this.sourceOverlay.classList.add('is-visible');
    this.tick();

    requestAnimationFrame(() => {
      const anchor = trigger.getBoundingClientRect();
      const popover = this.sourceOverlay;
      const gap = 8;
      const edge = 8;
      const viewportWidth = this.viewportState.width;
      const viewportHeight = this.viewportState.height;
      const viewportLeft = this.viewportState.left;
      const viewportTop = this.viewportState.top;
      const width = popover.offsetWidth;
      const height = popover.offsetHeight;
      const left = Math.max(viewportLeft + edge, Math.min(anchor.left, viewportLeft + viewportWidth - width - edge));
      const above = anchor.top - height - gap;
      const top = above >= viewportTop + edge ? above : Math.min(anchor.bottom + gap, viewportTop + viewportHeight - height - edge);
      popover.style.left = `${left}px`;
      popover.style.top = `${Math.max(viewportTop + edge, top)}px`;
    });
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
    if (overlay === this.sourceOverlay) {
      this.sourceOverlay.classList.remove('is-visible');
      this.sourceContent.replaceChildren();
    }
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
    const headingLink = target.closest<HTMLAnchorElement>('a[href^="#deck-"]');
    if (headingLink) {
      event.preventDefault();
      const href = headingLink.getAttribute('href');
      if (!href) return;
      this.deckHistory.replace(this.feed, this.current, href);
      this.syncFromLocation();
      this.tick();
      return;
    }
    const source = target.closest<HTMLAnchorElement>('a[data-deck-source-id]');
    if (source) {
      this.handleSourceLink(event);
      return;
    }
    const marginalia = target.closest<HTMLElement>('.footnote-number');
    if (marginalia) {
      event.preventDefault();
      event.stopPropagation();
      this.openMarginalia(marginalia);
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
    const url = this.deckHistory.shareUrl(this.feed, this.current);
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
    if (!this.sourceOverlay.hidden && event.key === 'Escape') {
      event.preventDefault();
      this.closeOverlay(this.sourceOverlay);
      return;
    }

    const overlay = !this.indexOverlay.hidden
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
    const marginalia = target.closest<HTMLElement>('.footnote-number');
    if (marginalia && (event.key === 'Enter' || event.code === 'Space')) {
      event.preventDefault();
      this.openMarginalia(marginalia);
      return;
    }
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
      card?.scrollBy({ top: event.key === 'ArrowDown' ? amount : -amount, behavior: this.viewportState.reducedMotion ? 'auto' : 'smooth' });
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
      if (this.viewportState.mobile) return;
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

export function createReadingDeckController(dialog: HTMLDialogElement): ReadingDeckHandle {
  return new ReadingDeckController(dialog);
}

let activeDeck: ReadingDeckHandle | null = null;

export function initializeReadingDeck(): void {
  activeDeck?.destroy();
  activeDeck = attachReadingDeck(document, createReadingDeckController);
  document.documentElement.classList.toggle('reading-deck-ready', activeDeck !== null);
  if (!activeDeck) document.body.classList.remove('reading-deck-open');
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
