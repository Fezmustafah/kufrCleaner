import type { DeckState } from './state';
import type { CompiledReadingFeed, FeedKind } from './types';
import type { DeckViewportSnapshot } from './viewport';

export interface ReadingDeckViewEvents {
  open(feed: FeedKind, trigger: HTMLElement): void;
  close(): void;
  switchFeed(feed: FeedKind): void;
  move(delta: -1 | 1): void;
  search(): void;
  menu(): void;
  select(index: number, origin: 'progress' | 'contents'): void;
  openContents(trigger: HTMLElement): void;
  action(event: Event): void;
  cancel(): void;
  keydown(event: KeyboardEvent): void;
}

type RequiredDeckElements = {
  shell: HTMLElement;
  stage: HTMLElement;
  track: HTMLElement;
  progress: HTMLElement;
  status: HTMLElement;
  position: HTMLElement;
  cardTitle: HTMLElement;
  prev: HTMLButtonElement;
  next: HTMLButtonElement;
  modeLabel: HTMLElement;
  indexOverlay: HTMLElement;
  indexList: HTMLOListElement;
  sourceOverlay: HTMLElement;
  sourceContent: HTMLElement;
  imageOverlay: HTMLElement;
  image: HTMLImageElement;
  scrollShadow: HTMLElement;
  swipeHint: HTMLElement;
  finish: HTMLElement;
  finishTitle: HTMLElement;
  finishCopy: HTMLElement;
  finishPrimary: HTMLButtonElement;
  finishPrimaryLabel: HTMLElement;
};

function required<T extends Element>(dialog: HTMLDialogElement, selector: string): T | null {
  return dialog.querySelector<T>(selector);
}

export class ReadingDeckView {
  static from(dialog: HTMLDialogElement): ReadingDeckView {
    const elements = {
      shell: required<HTMLElement>(dialog, '.reading-deck-shell'),
      stage: required<HTMLElement>(dialog, '[data-deck-stage]'),
      track: required<HTMLElement>(dialog, '[data-deck-track]'),
      progress: required<HTMLElement>(dialog, '[data-deck-progress]'),
      status: required<HTMLElement>(dialog, '[data-deck-status]'),
      position: required<HTMLElement>(dialog, '[data-deck-position]'),
      cardTitle: required<HTMLElement>(dialog, '[data-deck-card-title]'),
      prev: required<HTMLButtonElement>(dialog, '[data-deck-prev]'),
      next: required<HTMLButtonElement>(dialog, '[data-deck-next]'),
      modeLabel: required<HTMLElement>(dialog, '[data-deck-mode-label]'),
      indexOverlay: required<HTMLElement>(dialog, '[data-deck-index]'),
      indexList: required<HTMLOListElement>(dialog, '[data-deck-index-list]'),
      sourceOverlay: required<HTMLElement>(dialog, '[data-deck-source-panel]'),
      sourceContent: required<HTMLElement>(dialog, '[data-deck-source-content]'),
      imageOverlay: required<HTMLElement>(dialog, '[data-deck-image-panel]'),
      image: required<HTMLImageElement>(dialog, '[data-deck-image]'),
      scrollShadow: required<HTMLElement>(dialog, '[data-deck-scroll-shadow]'),
      swipeHint: required<HTMLElement>(dialog, '[data-deck-swipe-hint]'),
      finish: required<HTMLElement>(dialog, '[data-deck-finish]'),
      finishTitle: required<HTMLElement>(dialog, '[data-deck-finish-title]'),
      finishCopy: required<HTMLElement>(dialog, '[data-deck-finish-copy]'),
      finishPrimary: required<HTMLButtonElement>(dialog, '[data-deck-finish-primary]'),
      finishPrimaryLabel: required<HTMLElement>(dialog, '[data-deck-finish-primary-label]'),
    };
    if (Object.values(elements).some((element) => !element)) {
      throw new Error('Reading deck is missing required elements');
    }
    return new ReadingDeckView(dialog, elements as RequiredDeckElements);
  }

  declare private readonly shell: HTMLElement;
  declare readonly stage: HTMLElement;
  declare readonly track: HTMLElement;
  declare private readonly progress: HTMLElement;
  declare private readonly status: HTMLElement;
  declare private readonly position: HTMLElement;
  declare private readonly cardTitle: HTMLElement;
  declare private readonly prev: HTMLButtonElement;
  declare private readonly next: HTMLButtonElement;
  declare private readonly modeLabel: HTMLElement;
  declare private readonly indexOverlay: HTMLElement;
  declare private readonly indexList: HTMLOListElement;
  declare private readonly sourceOverlay: HTMLElement;
  declare private readonly sourceContent: HTMLElement;
  declare private readonly imageOverlay: HTMLElement;
  declare private readonly image: HTMLImageElement;
  declare private readonly scrollShadow: HTMLElement;
  declare private readonly swipeHint: HTMLElement;
  declare readonly finish: HTMLElement;
  declare private readonly finishTitle: HTMLElement;
  declare private readonly finishCopy: HTMLElement;
  declare private readonly finishPrimary: HTMLButtonElement;
  declare private readonly finishPrimaryLabel: HTMLElement;

  private overlayReturnFocus: HTMLElement | null = null;
  private scrollCard: HTMLElement | null = null;
  private readonly onCardScroll = () => {
    // The note popover is fixed at open-time coordinates; dismiss it on scroll
    // so it can't float over text that has scrolled away underneath it.
    if (!this.sourceOverlay.hidden) this.closeSource();
    this.updateOverflow();
  };
  private readonly frames = new Set<number>();
  private destroyed = false;

  private constructor(
    readonly dialog: HTMLDialogElement,
    elements: RequiredDeckElements,
  ) {
    Object.assign(this, elements);
  }

  open(): void {
    if (!this.dialog.open) this.dialog.show();
    this.dialog.ownerDocument.body.classList.add('reading-deck-open');
  }

  close(): void {
    this.closeAllSurfaces(false);
    if (this.dialog.open) this.dialog.close();
    this.dialog.ownerDocument.body.classList.remove('reading-deck-open');
  }

  bind(events: ReadingDeckViewEvents, signal: AbortSignal): void {
    this.dialog.ownerDocument.querySelectorAll<HTMLButtonElement>('[data-deck-open]').forEach((button) => {
      button.addEventListener('click', () => events.open(button.dataset.deckOpen as FeedKind, button), { signal });
    });
    this.dialog.querySelectorAll<HTMLButtonElement>('[data-deck-close]').forEach((button) => {
      button.addEventListener('click', events.close, { signal });
    });
    this.dialog.querySelectorAll<HTMLButtonElement>('[data-deck-feed]').forEach((button) => {
      button.addEventListener('click', () => events.switchFeed(button.dataset.deckFeed as FeedKind), { signal });
    });
    // Deep read has no footer contents button — the article title opens the
    // contents index instead (see renderFeed for the a11y attributes).
    const titleEl = this.dialog.querySelector<HTMLElement>('#reading-deck-title');
    titleEl?.addEventListener('click', () => {
      if (this.dialog.dataset.activeFeed === 'slides') events.openContents(titleEl);
    }, { signal });
    titleEl?.addEventListener('keydown', (event) => {
      if (this.dialog.dataset.activeFeed === 'slides' && (event.key === 'Enter' || event.key === ' ')) {
        event.preventDefault();
        events.openContents(titleEl);
      }
    }, { signal });
    this.prev.addEventListener('click', () => events.move(-1), { signal });
    this.next.addEventListener('click', () => events.move(1), { signal });
    this.dialog.querySelector<HTMLButtonElement>('[data-deck-search]')?.addEventListener('click', events.search, { signal });
    this.dialog.querySelector<HTMLButtonElement>('[data-deck-menu]')?.addEventListener('click', events.menu, { signal });
    this.progress.addEventListener('click', (event) => {
      const button = (event.target as Element).closest<HTMLButtonElement>('[data-deck-progress-index]');
      if (button) events.select(Number(button.dataset.deckProgressIndex), 'progress');
    }, { signal });
    this.dialog.querySelectorAll<HTMLButtonElement>('[data-deck-index-open]').forEach((button) => {
      button.addEventListener('click', () => events.openContents(button), { signal });
    });
    this.dialog.querySelector<HTMLButtonElement>('[data-deck-index-close]')
      ?.addEventListener('click', () => this.closeSurface(this.indexOverlay), { signal });
    this.dialog.querySelector<HTMLButtonElement>('[data-deck-source-close]')
      ?.addEventListener('click', () => this.closeSurface(this.sourceOverlay), { signal });
    this.dialog.querySelector<HTMLButtonElement>('[data-deck-image-close]')
      ?.addEventListener('click', () => this.closeSurface(this.imageOverlay), { signal });
    this.indexList.addEventListener('click', (event) => {
      const button = (event.target as Element).closest<HTMLButtonElement>('[data-card-index]');
      if (!button) return;
      this.closeSurface(this.indexOverlay, false);
      events.select(Number(button.dataset.cardIndex), 'contents');
    }, { signal });
    [this.indexOverlay, this.imageOverlay].forEach((overlay) => {
      overlay.addEventListener('click', (event) => {
        if (event.target === overlay) this.closeSurface(overlay);
      }, { signal });
    });
    this.dialog.addEventListener('pointerdown', (event) => {
      if (this.sourceOverlay.hidden) return;
      const target = event.target as Element;
      const activatesNote = Boolean(target.closest('a[data-deck-source-id], .footnote-number'));
      if (!this.sourceOverlay.contains(target) && !activatesNote) this.closeSurface(this.sourceOverlay, false);
    }, { signal });
    this.track.addEventListener('click', events.action, { signal });
    this.finish.addEventListener('click', (event) => {
      event.stopPropagation();
      events.action(event);
    }, { signal });
    this.dialog.querySelectorAll<HTMLButtonElement>('[data-deck-neighbor]').forEach((button) => {
      button.addEventListener('click', () => events.move(Number(button.dataset.deckNeighbor) < 0 ? -1 : 1), { signal });
    });
    this.dialog.addEventListener('cancel', (event) => {
      event.preventDefault();
      events.cancel();
    }, { signal });
    this.dialog.addEventListener('keydown', events.keydown, { signal });
  }

  renderFeed(feed: CompiledReadingFeed, kind: FeedKind): void {
    this.track.replaceChildren(...feed.cards.map((card) => card.element));
    this.track.appendChild(this.finish);
    this.modeLabel.textContent = kind === 'tldr' ? 'TLDR view' : 'Deep read';
    this.dialog.dataset.activeFeed = kind;
    const titleEl = this.dialog.querySelector<HTMLElement>('#reading-deck-title');
    if (titleEl) {
      const label = titleEl.textContent?.trim() ?? '';
      if (kind === 'slides') {
        titleEl.setAttribute('role', 'button');
        titleEl.setAttribute('tabindex', '0');
        titleEl.setAttribute('aria-haspopup', 'dialog');
        titleEl.setAttribute('aria-expanded', 'false');
        titleEl.setAttribute('aria-label', `Contents — ${label}`);
        titleEl.setAttribute('title', 'Open contents');
      } else {
        titleEl.removeAttribute('role');
        titleEl.removeAttribute('tabindex');
        titleEl.removeAttribute('aria-haspopup');
        titleEl.removeAttribute('aria-expanded');
        titleEl.removeAttribute('aria-label');
        titleEl.setAttribute('title', label);
      }
    }
    this.dialog.querySelectorAll<HTMLButtonElement>('[data-deck-feed]').forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.deckFeed === kind));
    });
    this.renderProgress(feed);
    this.renderContents(feed);
  }

  selectCard(index: number): void {
    // Deep read shows every pane at once — reading across headings means all
    // panes stay interactive (no inert/aria-hidden), unlike the one-at-a-time
    // TLDR deck.
    const panes = this.track.dataset.deckLayout === 'panes';
    const cards = Array.from(this.track.querySelectorAll<HTMLElement>('.reading-deck-card'));
    cards.forEach((card, cardIndex) => {
      const active = cardIndex === index;
      card.dataset.deckDistance = String(Math.min(2, Math.abs(cardIndex - index)));
      card.toggleAttribute('inert', panes ? false : !active);
      card.setAttribute('aria-hidden', String(panes ? false : !active));
      card.style.contentVisibility = panes || Math.abs(cardIndex - index) <= 1 ? 'visible' : '';
    });
  }

  renderNavigation(state: DeckState, feed: CompiledReadingFeed): void {
    const card = feed.cards[state.current];
    if (!card) return;
    const contentTotal = feed.cards.filter((item) => !item.isCover).length;
    const contentIndex = feed.cards.slice(0, state.current + 1).filter((item) => !item.isCover).length;
    this.position.textContent = card.isCover ? 'Ready' : `${contentIndex} / ${contentTotal}`;
    this.cardTitle.textContent = card.isCover ? 'Swipe to begin' : card.title;
    this.prev.disabled = state.current === 0;
    this.next.disabled = state.finished;
    const nextLabel = this.next.querySelector('span') || this.next;
    nextLabel.textContent = state.current === feed.cards.length - 1 ? 'Finish' : 'Next';
    this.status.textContent = card.isCover
      ? `${state.feed === 'tldr' ? 'TLDR view' : 'Deep read'} cover.`
      : `${card.title}. Card ${contentIndex} of ${contentTotal}.`;
    this.indexList.querySelectorAll<HTMLButtonElement>('[data-card-index]').forEach((button) => {
      button.toggleAttribute('aria-current', Number(button.dataset.cardIndex) === state.current);
    });
    this.progress.querySelectorAll<HTMLButtonElement>('[data-deck-progress-index]').forEach((button) => {
      const index = Number(button.dataset.deckProgressIndex);
      button.toggleAttribute('data-complete', index < state.current || state.finished);
      if (index === state.current && !state.finished) button.setAttribute('aria-current', 'step');
      else button.removeAttribute('aria-current');
    });
  }

  renderCompletion(visible: boolean, feed: CompiledReadingFeed, kind: FeedKind): void {
    this.finish.hidden = false;
    this.finish.dataset.deckFinishActive = String(visible);
    this.finish.inert = !visible;
    this.finish.setAttribute('aria-hidden', String(!visible));
    this.stage.classList.toggle('is-finished', visible);
    if (!visible) return;

    this.selectCard(-1);
    this.finish.setAttribute('aria-label', 'Reading complete');
    this.finishTitle.textContent = kind === 'tldr' ? 'You have the core argument' : 'You reached the end';
    this.finishCopy.textContent = kind === 'tldr'
      ? `You finished the ${feed.minutes}-minute TLDR view. Return to the article or share this view.`
      : `You finished the ${feed.minutes}-minute deep read. Share this view or return to the article.`;
    this.finishPrimary.dataset.deckAction = 'article';
    this.finishPrimaryLabel.textContent = 'Back to article';
    this.scrollShadow.hidden = true;
    this.position.textContent = 'Done';
    this.cardTitle.textContent = 'Complete';
    this.prev.disabled = false;
    this.next.disabled = true;
    this.status.textContent = 'Deck complete.';
  }

  openContents(trigger: HTMLElement): void {
    this.overlayReturnFocus = trigger;
    this.shell.inert = true;
    this.indexOverlay.hidden = false;
    if (this.dialog.dataset.activeFeed === 'slides') {
      this.dialog.querySelector('#reading-deck-title')?.setAttribute('aria-expanded', 'true');
    }
    const target = this.indexList.querySelector<HTMLButtonElement>('[aria-current="true"]')
      || this.indexList.querySelector<HTMLButtonElement>('[data-card-index]')
      || this.indexOverlay.querySelector<HTMLButtonElement>('[data-deck-index-close]');
    target?.focus({ preventScroll: true });
  }

  openSource(content: HTMLElement, trigger: HTMLElement): void {
    this.overlayReturnFocus = trigger;
    this.sourceContent.replaceChildren(content);
    this.sourceOverlay.hidden = false;
    this.sourceOverlay.classList.add('is-visible');
  }

  openImage(source: HTMLImageElement): void {
    this.overlayReturnFocus = source;
    this.image.src = source.currentSrc || source.src;
    this.image.alt = source.alt || '';
    this.shell.inert = true;
    this.imageOverlay.hidden = false;
    this.imageOverlay.querySelector<HTMLButtonElement>('[data-deck-image-close]')?.focus({ preventScroll: true });
  }

  private closeSurface(surface: HTMLElement, restoreFocus = true): void {
    if (surface.hidden) return;
    surface.hidden = true;
    if (surface === this.indexOverlay) {
      this.dialog.querySelector('#reading-deck-title')?.setAttribute('aria-expanded', 'false');
    }
    if (surface === this.sourceOverlay) {
      this.sourceOverlay.classList.remove('is-visible');
      this.sourceContent.replaceChildren();
    }
    if (surface === this.imageOverlay) this.image.removeAttribute('src');
    if (this.indexOverlay.hidden && this.sourceOverlay.hidden && this.imageOverlay.hidden) this.shell.inert = false;
    if (restoreFocus) this.overlayReturnFocus?.focus({ preventScroll: true });
    this.overlayReturnFocus = null;
  }

  closeTopSurface(restoreFocus = true): boolean {
    const surface = !this.sourceOverlay.hidden
      ? this.sourceOverlay
      : !this.indexOverlay.hidden
        ? this.indexOverlay
        : !this.imageOverlay.hidden
          ? this.imageOverlay
          : null;
    if (!surface) return false;
    this.closeSurface(surface, restoreFocus);
    return true;
  }

  hasOpenSurface(): boolean {
    return !this.indexOverlay.hidden || !this.sourceOverlay.hidden || !this.imageOverlay.hidden;
  }

  hasBlockingSurface(): boolean {
    return !this.indexOverlay.hidden || !this.imageOverlay.hidden;
  }

  isSourceOpen(): boolean {
    return !this.sourceOverlay.hidden;
  }

  closeSource(): void {
    this.closeSurface(this.sourceOverlay);
  }

  closeBlockingSurface(): void {
    const surface = this.activeBlockingSurface();
    if (surface) this.closeSurface(surface);
  }

  private activeBlockingSurface(): HTMLElement | null {
    return !this.indexOverlay.hidden
      ? this.indexOverlay
      : !this.imageOverlay.hidden
        ? this.imageOverlay
        : null;
  }

  trapFocus(event: KeyboardEvent): boolean {
    if (event.key !== 'Tab') return false;
    const root = this.activeBlockingSurface() || this.shell;
    const focusable = Array.from(root.querySelectorAll<HTMLElement>(
      'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
    )).filter((element) => !element.hidden && element.getAttribute('aria-hidden') !== 'true');
    if (!focusable.length) return false;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && this.dialog.ownerDocument.activeElement === first) {
      event.preventDefault();
      last.focus();
      return true;
    }
    if (!event.shiftKey && this.dialog.ownerDocument.activeElement === last) {
      event.preventDefault();
      first.focus();
      return true;
    }
    return false;
  }

  hideOverflow(): void {
    this.scrollShadow.hidden = true;
  }

  showSwipeHint(): void {
    this.swipeHint.hidden = false;
  }

  hideSwipeHint(): boolean {
    if (this.swipeHint.hidden) return false;
    this.swipeHint.hidden = true;
    return true;
  }

  setStatus(message: string): void {
    this.status.textContent = message;
  }

  focusCloseButton(): void {
    this.dialog.querySelector<HTMLButtonElement>('[data-deck-close]')?.focus({ preventScroll: true });
  }

  focusCompletion(): void {
    this.finishPrimary.focus({ preventScroll: true });
  }

  renderNeighborControls(state: DeckState, lastIndex: number): void {
    this.dialog.querySelectorAll<HTMLButtonElement>('[data-deck-neighbor]').forEach((button) => {
      const delta = Number(button.dataset.deckNeighbor);
      button.hidden = delta < 0
        ? !state.finished && state.current === 0
        : state.finished || state.current > lastIndex;
    });
  }

  positionSourcePopover(trigger: HTMLElement, viewport: DeckViewportSnapshot): void {
    this.scheduleFrame(() => {
      const anchor = trigger.getBoundingClientRect();
      const gap = 8;
      const edge = 8;
      const width = this.sourceOverlay.offsetWidth;
      const height = this.sourceOverlay.offsetHeight;
      const left = Math.max(viewport.left + edge, Math.min(
        anchor.left,
        viewport.left + viewport.width - width - edge,
      ));
      const above = anchor.top - height - gap;
      const top = above >= viewport.top + edge
        ? above
        : Math.min(anchor.bottom + gap, viewport.top + viewport.height - height - edge);
      this.sourceOverlay.style.left = `${left}px`;
      this.sourceOverlay.style.top = `${Math.max(viewport.top + edge, top)}px`;
    });
  }

  restoreHeading(targetId: string): void {
    this.scheduleFrame(() => {
      const target = this.dialog.ownerDocument.getElementById(targetId);
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
      this.updateOverflow();
    });
  }

  bindCurrentCardOverflow(card: HTMLElement | null, finished = false): void {
    this.scrollCard?.removeEventListener('scroll', this.onCardScroll);
    this.scrollCard = card;
    this.scrollShadow.hidden = true;
    card?.prepend(this.scrollShadow);
    card?.addEventListener('scroll', this.onCardScroll, { passive: true });
    this.scheduleFrame(() => this.updateOverflow(finished));
  }

  updateOverflow(finished = false): void {
    const card = this.scrollCard;
    if (!card) {
      this.scrollShadow.hidden = true;
      return;
    }
    const overflow = card.scrollHeight > card.clientHeight + 10;
    const moreBelow = card.scrollTop + card.clientHeight < card.scrollHeight - 10;
    this.scrollShadow.hidden = finished || !(overflow && moreBelow);
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    const browser = this.dialog.ownerDocument.defaultView || window;
    this.frames.forEach((frame) => browser.cancelAnimationFrame(frame));
    this.frames.clear();
    this.scrollCard?.removeEventListener('scroll', this.onCardScroll);
    this.scrollCard = null;
    this.close();
  }

  private renderContents(feed: CompiledReadingFeed): void {
    this.indexList.replaceChildren(...feed.cards.flatMap((card, index) => {
      if (card.isCover) return [];
      const item = this.dialog.ownerDocument.createElement('li');
      const button = this.dialog.ownerDocument.createElement('button');
      button.type = 'button';
      button.dataset.cardIndex = String(index);
      button.textContent = card.title;
      item.appendChild(button);
      return [item];
    }));
  }

  private renderProgress(feed: CompiledReadingFeed): void {
    this.progress.replaceChildren(...feed.cards.flatMap((card, index) => {
      if (card.isCover) return [];
      const button = this.dialog.ownerDocument.createElement('button');
      button.type = 'button';
      button.dataset.deckProgressIndex = String(index);
      button.setAttribute('aria-label', `Go to card ${index}: ${card.title}`);
      const fill = this.dialog.ownerDocument.createElement('span');
      fill.setAttribute('aria-hidden', 'true');
      button.appendChild(fill);
      return [button];
    }));
  }

  private closeAllSurfaces(restoreFocus: boolean): void {
    this.closeSurface(this.indexOverlay, restoreFocus);
    this.closeSurface(this.sourceOverlay, restoreFocus);
    this.closeSurface(this.imageOverlay, restoreFocus);
  }

  private scheduleFrame(callback: () => void): void {
    const browser = this.dialog.ownerDocument.defaultView || window;
    const frame = browser.requestAnimationFrame(() => {
      this.frames.delete(frame);
      if (!this.destroyed) callback();
    });
    this.frames.add(frame);
  }
}
