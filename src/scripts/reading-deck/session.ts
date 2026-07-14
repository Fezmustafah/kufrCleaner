import { compileReadingFeed } from './feed';
import { formatDeckHash, type DeckHistory } from './history';
import {
  createDeckState,
  transition,
  type DeckIntent,
  type DeckState,
  type FeedLengths,
} from './state';
import { createDesktopTransformTransport } from './transports/desktop-transform';
import { createMobileScrollSnapTransport } from './transports/mobile-scroll-snap';
import type {
  DeckTransport,
  DeckTransportContext,
} from './transports/transport';
import type {
  CompiledReadingFeed as DeckFeedModel,
  FeedKind,
} from './types';
import { ReadingDeckView } from './view';
import { applyViewportCss, type DeckViewport, type DeckViewportSnapshot } from './viewport';

export interface ReadingDeckEffects {
  haptic(): void;
  initializeArticleEnhancements(): void;
  openSearch(): void;
  openMenu(): void;
  share(data: ShareData): Promise<'shared' | 'copied' | 'failed'>;
  destroy?(): void;
}

export interface ReadingDeckSessionDependencies {
  history: DeckHistory;
  viewport: DeckViewport;
  effects: ReadingDeckEffects;
}

interface SavedDeckState {
  feed?: FeedKind;
  positions?: Partial<Record<FeedKind, number>>;
}

const SWIPE_HINT_KEY = 'reading-deck-swipe-hint-seen';

export class ReadingDeckSession {
  static attach(
    dialog: HTMLDialogElement,
    dependencies: ReadingDeckSessionDependencies,
  ): ReadingDeckSession {
    return new ReadingDeckSession(dialog, dependencies);
  }

  private readonly abort = new AbortController();
  private readonly view: ReadingDeckView;
  private readonly feedCache = new Map<FeedKind, DeckFeedModel>();
  private readonly deckHistory: DeckHistory;
  private readonly viewport: DeckViewport;
  private readonly effects: ReadingDeckEffects;
  private viewportState: DeckViewportSnapshot;
  private unsubscribeHistory: () => void = () => {};
  private unsubscribeViewport: () => void = () => {};
  private state: DeckState;
  private transport: DeckTransport | null = null;
  private returnFocus: HTMLElement | null = null;
  private readonly storageKey: string;
  private readonly frames = new Set<number>();
  private destroyed = false;

  private constructor(
    dialog: HTMLDialogElement,
    dependencies: ReadingDeckSessionDependencies,
  ) {
    this.deckHistory = dependencies.history;
    this.viewport = dependencies.viewport;
    this.effects = dependencies.effects;
    this.viewportState = this.viewport.snapshot();
    this.view = ReadingDeckView.from(dialog);
    this.storageKey = `reading-deck:${dialog.dataset.postId || 'current-post'}`;

    const saved = this.readSavedState();
    const savedFeed = saved.feed && this.supports(saved.feed) ? saved.feed : 'slides';
    this.state = createDeckState(savedFeed, saved.positions);

    this.bind();
    const requested = this.deckHistory.read();
    if (requested && this.supports(requested.feed)) {
      queueMicrotask(() => this.open(requested.feed, 'none', requested.index, requested.targetId));
    }
  }

  private get feed(): FeedKind { return this.state.feed; }
  private get current(): number { return this.state.current; }
  private get finished(): boolean { return this.state.finished; }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.abort.abort();
    this.unsubscribeHistory();
    this.unsubscribeViewport();
    this.transport?.destroy();
    this.transport = null;
    this.frames.forEach((frame) => cancelAnimationFrame(frame));
    this.frames.clear();
    try { this.effects.destroy?.(); } catch { /* non-fatal */ }
    this.view.destroy();
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

    this.view.dialog.querySelectorAll<HTMLButtonElement>('[data-deck-close]').forEach((button) => {
      button.addEventListener('click', () => this.requestClose(), { signal });
    });

    this.view.dialog.querySelectorAll<HTMLButtonElement>('[data-deck-feed]').forEach((button) => {
      button.addEventListener('click', () => {
        const feed = button.dataset.deckFeed as FeedKind;
        if (feed !== this.feed && this.supports(feed)) this.switchFeed(feed);
      }, { signal });
    });

    this.view.prev.addEventListener('click', () => this.go(-1), { signal });
    this.view.next.addEventListener('click', () => this.go(1), { signal });

    this.view.dialog.querySelector<HTMLButtonElement>('[data-deck-search]')
      ?.addEventListener('click', () => this.effects.openSearch(), { signal });
    this.view.dialog.querySelector<HTMLButtonElement>('[data-deck-menu]')
      ?.addEventListener('click', () => this.effects.openMenu(), { signal });

    this.view.progress.addEventListener('click', (event) => {
      const button = (event.target as Element).closest<HTMLButtonElement>('[data-deck-progress-index]');
      if (!button) return;
      const index = Number(button.dataset.deckProgressIndex);
      if (index === this.current) this.tick();
      this.show(index, true, true);
    }, { signal });

    this.view.dialog.querySelectorAll<HTMLButtonElement>('[data-deck-index-open]').forEach((button) => {
      button.addEventListener('click', () => this.openIndex(button), { signal });
    });
    this.view.dialog.querySelector<HTMLButtonElement>('[data-deck-index-close]')
      ?.addEventListener('click', () => this.closeOverlay(this.view.indexOverlay), { signal });
    this.view.dialog.querySelector<HTMLButtonElement>('[data-deck-source-close]')
      ?.addEventListener('click', () => this.closeOverlay(this.view.sourceOverlay), { signal });
    this.view.dialog.querySelector<HTMLButtonElement>('[data-deck-image-close]')
      ?.addEventListener('click', () => this.closeOverlay(this.view.imageOverlay), { signal });

    this.view.indexList.addEventListener('click', (event) => {
      const button = (event.target as Element).closest<HTMLButtonElement>('[data-card-index]');
      if (!button) return;
      this.closeOverlay(this.view.indexOverlay, false);
      const index = Number(button.dataset.cardIndex);
      if (index === this.current) this.tick();
      this.show(index, true, true);
      this.currentCard()?.focus({ preventScroll: true });
    }, { signal });

    [this.view.indexOverlay, this.view.imageOverlay].forEach((overlay) => {
      overlay.addEventListener('click', (event) => {
        if (event.target === overlay) this.closeOverlay(overlay);
      }, { signal });
    });

    this.view.dialog.addEventListener('pointerdown', (event) => {
      if (this.view.sourceOverlay.hidden) return;
      const target = event.target as Element;
      const activatesNote = Boolean(target.closest('a[data-deck-source-id], .footnote-number'));
      if (!this.view.sourceOverlay.contains(target) && !activatesNote) this.closeOverlay(this.view.sourceOverlay, false);
    }, { signal });

    this.view.track.addEventListener('click', (event) => this.handleDeckAction(event), { signal });
    this.view.finish.addEventListener('click', (event) => {
      event.stopPropagation();
      this.handleDeckAction(event);
    }, { signal });
    this.view.dialog.querySelectorAll<HTMLButtonElement>('[data-deck-neighbor]').forEach((button) => {
      button.addEventListener('click', () => this.go(Number(button.dataset.deckNeighbor)), { signal });
    });
    this.view.dialog.addEventListener('cancel', (event) => {
      event.preventDefault();
      this.requestClose();
    }, { signal });
    this.view.dialog.addEventListener('keydown', (event) => this.onKeydown(event), { signal });
    this.unsubscribeViewport = this.viewport.subscribe((snapshot) => {
      const mobileChanged = snapshot.mobile !== this.viewportState.mobile;
      this.viewportState = snapshot;
      applyViewportCss(this.view.dialog, snapshot);
      if (mobileChanged) {
        this.view.track.scrollLeft = 0;
        this.syncFinishPlacement();
        this.replaceTransport(snapshot.mobile);
      } else {
        this.transport?.reflow();
      }
    });
    this.unsubscribeHistory = this.deckHistory.subscribe(() => this.syncFromLocation());
  }

  private supports(feed: FeedKind): boolean {
    return this.view.dialog.dataset[feed === 'slides' ? 'hasSlides' : 'hasTldr'] === 'true';
  }

  private open(
    feed: FeedKind,
    historyMode: 'push' | 'replace' | 'none',
    requestedIndex: number | null = null,
    targetId: string | null = null,
  ): void {
    if (!this.supports(feed)) return;
    this.view.open();

    this.viewportState = this.viewport.snapshot();
    applyViewportCss(this.view.dialog, this.viewportState);
    this.renderFeed(feed, requestedIndex, targetId);

    if (historyMode !== 'none') {
      if (historyMode === 'push') this.deckHistory.push(feed, this.current);
      else this.deckHistory.replace(feed, this.current);
    }

    this.scheduleFrame(() => {
      this.place(false);
      if (targetId) this.restoreHeading(targetId);
      this.maybeShowSwipeHint();
      this.view.focusCloseButton();
    });
  }

  private requestClose(): void {
    if (this.deckHistory.close() === 'replace') this.close();
  }

  private close(): void {
    this.commit({ type: 'CLOSE' });
    this.view.close();
    this.returnFocus?.focus({ preventScroll: true });
    this.returnFocus = null;
  }

  private syncFromLocation(): void {
    const requested = this.deckHistory.read();
    if (requested && this.supports(requested.feed)) {
      this.open(requested.feed, 'none', requested.index, requested.targetId);
    } else if (this.view.dialog.open) {
      this.close();
    }
  }

  private switchFeed(feed: FeedKind): void {
    this.renderFeed(feed);
    this.deckHistory.replace(feed, this.current);
    this.saveState();
    this.tick();
  }

  private renderFeed(feed: FeedKind, requestedIndex: number | null = null, targetId: string | null = null): void {
    const model = this.feedCache.get(feed) || this.buildFeed(feed);
    this.feedCache.set(feed, model);
    this.commit({ type: 'OPEN', feed, index: requestedIndex });
    this.view.renderFeed(model, feed);
    this.view.renderCompletion(false, model, feed);
    this.syncFinishPlacement();
    this.replaceTransport(this.viewportState.mobile);
    this.show(this.current, false, false, true, !targetId);
    queueMicrotask(() => this.effects.initializeArticleEnhancements());
  }

  private buildFeed(feed: FeedKind): DeckFeedModel {
    return compileReadingFeed(this.sourceFor(feed), {
      kind: feed,
      title: this.view.dialog.dataset.postTitle || document.title,
      description: this.view.dialog.dataset.postDescription || '',
      coverImage: this.view.dialog.dataset.coverImage || null,
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

  private show(
    index: number,
    animate: boolean,
    haptic = false,
    shouldPlace = true,
    updateHash = true,
  ): void {
    const model = this.feedCache.get(this.feed);
    if (!model?.cards.length) return;
    const result = this.commit({ type: 'SELECT_CARD', index });
    this.view.renderCompletion(false, model, this.feed);
    this.saveState();

    this.view.selectCard(this.current);

    this.syncUI(model);
    if (shouldPlace) this.place(animate);
    this.bindCurrentCardScroll();
    if (result.effects.cardChanged) this.dismissSwipeHint();
    if (updateHash && this.view.dialog.open && this.deckHistory.read()) this.updateLocationHash();
    if (result.effects.cardChanged && haptic) this.tick();
  }

  private go(delta: number): void {
    const model = this.feedCache.get(this.feed);
    if (!model) return;
    const result = this.commit({ type: 'MOVE', delta: delta < 0 ? -1 : 1 });
    if (result.effects.completionChanged) {
      if (this.finished) this.showFinish();
      else this.renderCurrentCard(model, true, true);
    } else if (result.effects.cardChanged) {
      this.renderCurrentCard(model, true, true);
    }
  }

  private showFinish(): void {
    const model = this.feedCache.get(this.feed);
    if (!model) return;
    this.view.renderNavigation(this.deckState(), model);
    this.view.renderCompletion(true, model, this.feed);
    this.syncNeighborControls(model);
    this.place(true);
    this.tick();
    this.scheduleFrame(() => this.view.focusCompletion());
  }

  private hideFinish(restoreTrack = true): void {
    this.commit({ type: 'DISMISS_COMPLETION' });
    const model = this.feedCache.get(this.feed);
    if (model) this.view.renderCompletion(false, model, this.feed);
    if (restoreTrack && model) this.renderCurrentCard(model, false, false);
  }

  private renderCurrentCard(model: DeckFeedModel, animate: boolean, haptic: boolean): void {
    this.view.renderCompletion(false, model, this.feed);
    this.view.selectCard(this.current);
    this.syncUI(model);
    this.place(animate);
    this.bindCurrentCardScroll();
    this.dismissSwipeHint();
    this.saveState();
    if (this.view.dialog.open && this.deckHistory.read()) this.updateLocationHash();
    if (haptic) this.tick();
  }

  private syncUI(model: DeckFeedModel): void {
    this.view.renderNavigation(this.deckState(), model);
    this.syncNeighborControls(model);
  }

  private deckState(): DeckState {
    return this.state;
  }

  private commit(intent: DeckIntent) {
    const result = transition(this.state, intent, this.feedLengths());
    this.state = result.state;
    return result;
  }

  private feedLengths(): FeedLengths {
    return {
      slides: this.feedCache.get('slides')?.cards.length,
      tldr: this.feedCache.get('tldr')?.cards.length,
    };
  }

  private syncNeighborControls(model: DeckFeedModel): void {
    this.view.dialog.querySelectorAll<HTMLButtonElement>('[data-deck-neighbor]').forEach((button) => {
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
        positions: this.state.positions,
      } satisfies SavedDeckState));
    } catch { /* private browsing or disabled storage */ }
  }

  private bindCurrentCardScroll(): void {
    this.view.bindCurrentCardOverflow(this.currentCard(), this.finished);
  }

  private maybeShowSwipeHint(): void {
    try {
      if (localStorage.getItem(SWIPE_HINT_KEY)) return;
      this.view.swipeHint.hidden = false;
    } catch { /* show the harmless hint when storage is unavailable */
      this.view.swipeHint.hidden = false;
    }
  }

  private dismissSwipeHint(): void {
    if (this.view.swipeHint.hidden) return;
    this.view.swipeHint.hidden = true;
    try { localStorage.setItem(SWIPE_HINT_KEY, '1'); } catch { /* ignore */ }
  }

  private currentCard(): HTMLElement | null {
    return this.feedCache.get(this.feed)?.cards[this.current]?.element || null;
  }

  private lastContentIndex(model: DeckFeedModel): number {
    return model.cards.length - 1;
  }

  private syncFinishPlacement(): void {
    const parent = this.viewportState.mobile ? this.view.stage : this.view.track;
    if (this.view.finish.parentElement !== parent) parent.appendChild(this.view.finish);
  }

  private place(animate: boolean): void {
    const model = this.feedCache.get(this.feed);
    if (!model) return;
    const selected = this.finished && !this.viewportState.mobile ? model.cards.length : this.current;
    this.transport?.present(selected, animate ? 'animate' : 'none');
  }

  private replaceTransport(mobile: boolean): void {
    const model = this.feedCache.get(this.feed);
    if (!model) return;
    this.transport?.destroy();
    this.transport = mobile
      ? createMobileScrollSnapTransport({ onSettledHaptic: () => this.tick() })
      : createDesktopTransformTransport();
    this.transport.connect(this.transportContext(model, mobile));
    this.place(false);
  }

  private transportContext(model: DeckFeedModel, mobile: boolean): DeckTransportContext {
    const cards = model.cards.map((card) => card.element);
    if (!mobile && this.view.finish.parentElement === this.view.track) cards.push(this.view.finish);
    return {
      stage: this.view.stage,
      track: this.view.track,
      cards,
      selectedIndex: () => this.finished && !mobile ? model.cards.length : this.current,
      reducedMotion: () => this.viewportState.reducedMotion,
      interactionEnabled: () => !this.finished && !this.view.hasOpenSurface(),
      requestMove: (delta) => this.go(delta),
      reportSettled: (index) => {
        if (index !== this.current) this.show(index, false, false, false);
        else this.bindCurrentCardScroll();
      },
      dismissHint: () => {
        this.view.hideOverflow();
        this.dismissSwipeHint();
      },
    };
  }

  private restoreHeading(targetId: string): void {
    this.view.restoreHeading(targetId);
  }

  private tick(): void {
    try { this.effects.haptic(); } catch { /* best effort */ }
  }

  private openIndex(trigger: HTMLElement): void {
    this.view.openContents(trigger);
    this.tick();
  }

  private openSource(sourceId: string, trigger: HTMLElement): void {
    const source = this.feedCache.get(this.feed)?.sources.get(sourceId);
    if (!source) return;
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
    this.view.openSource(content, trigger);
    this.tick();

    this.scheduleFrame(() => {
      const anchor = trigger.getBoundingClientRect();
      const popover = this.view.sourceOverlay;
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
    this.view.openImage(source);
  }

  private closeOverlay(overlay: HTMLElement, restoreFocus = true): void {
    this.view.closeSurface(overlay, restoreFocus);
  }

  private handleSourceLink(event: Event): void {
    const anchor = (event.target as Element).closest<HTMLAnchorElement>('a[data-deck-source-id]');
    if (!anchor?.dataset.deckSourceId) return;
    event.preventDefault();
    this.openSource(anchor.dataset.deckSourceId, anchor);
  }

  private handleDeckAction(event: Event): void {
    const target = event.target as Element;
    if (this.finished && target === this.view.finish) {
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
      title: this.view.dialog.dataset.postTitle || document.title,
      text: this.currentCard()?.getAttribute('aria-label') || 'Open this reading card',
      url,
    };
    const result = await this.effects.share(data);
    if (result === 'copied') this.view.setStatus('Link copied to clipboard.');
    else if (result === 'failed') this.view.setStatus('Could not share this card.');
  }

  private onKeydown(event: KeyboardEvent): void {
    if (!this.view.sourceOverlay.hidden && event.key === 'Escape') {
      event.preventDefault();
      this.closeOverlay(this.view.sourceOverlay);
      return;
    }

    const overlay = this.view.activeBlockingSurface();

    if (overlay) {
      if (event.key === 'Escape') {
        event.preventDefault();
        this.closeOverlay(overlay);
      } else this.view.trapFocus(event);
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
      this.view.trapFocus(event);
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

  private scheduleFrame(callback: () => void): void {
    const frame = requestAnimationFrame(() => {
      this.frames.delete(frame);
      if (!this.destroyed) callback();
    });
    this.frames.add(frame);
  }

}
