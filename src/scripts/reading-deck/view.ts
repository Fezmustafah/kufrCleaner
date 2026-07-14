import type { DeckState } from './state';
import type { CompiledReadingFeed, FeedKind } from './types';

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

  declare readonly shell: HTMLElement;
  declare readonly stage: HTMLElement;
  declare readonly track: HTMLElement;
  declare readonly progress: HTMLElement;
  declare readonly status: HTMLElement;
  declare readonly position: HTMLElement;
  declare readonly cardTitle: HTMLElement;
  declare readonly prev: HTMLButtonElement;
  declare readonly next: HTMLButtonElement;
  declare readonly modeLabel: HTMLElement;
  declare readonly indexOverlay: HTMLElement;
  declare readonly indexList: HTMLOListElement;
  declare readonly sourceOverlay: HTMLElement;
  declare readonly sourceContent: HTMLElement;
  declare readonly imageOverlay: HTMLElement;
  declare readonly image: HTMLImageElement;
  declare readonly scrollShadow: HTMLElement;
  declare readonly swipeHint: HTMLElement;
  declare readonly finish: HTMLElement;
  declare readonly finishTitle: HTMLElement;
  declare readonly finishCopy: HTMLElement;
  declare readonly finishPrimary: HTMLButtonElement;
  declare readonly finishPrimaryLabel: HTMLElement;

  private overlayReturnFocus: HTMLElement | null = null;
  private scrollCard: HTMLElement | null = null;
  private readonly onCardScroll = () => this.updateOverflow();

  private constructor(
    readonly dialog: HTMLDialogElement,
    elements: RequiredDeckElements,
  ) {
    Object.assign(this, elements);
  }

  open(): void {
    if (!this.dialog.open) this.dialog.show();
    document.body.classList.add('reading-deck-open');
  }

  close(): void {
    this.closeAllSurfaces(false);
    if (this.dialog.open) this.dialog.close();
    document.body.classList.remove('reading-deck-open');
  }

  renderFeed(feed: CompiledReadingFeed, kind: FeedKind): void {
    this.track.replaceChildren(...feed.cards.map((card) => card.element));
    this.track.appendChild(this.finish);
    this.modeLabel.textContent = kind === 'tldr' ? 'Quick read' : 'Deep read';
    this.dialog.dataset.activeFeed = kind;
    this.dialog.querySelectorAll<HTMLButtonElement>('[data-deck-feed]').forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.deckFeed === kind));
    });
    this.renderProgress(feed);
    this.renderContents(feed);
  }

  selectCard(index: number): void {
    const cards = Array.from(this.track.querySelectorAll<HTMLElement>('.reading-deck-card'));
    cards.forEach((card, cardIndex) => {
      const active = cardIndex === index;
      card.dataset.deckDistance = String(Math.min(2, Math.abs(cardIndex - index)));
      card.toggleAttribute('inert', !active);
      card.setAttribute('aria-hidden', String(!active));
      card.style.contentVisibility = Math.abs(cardIndex - index) <= 1 ? 'visible' : '';
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
      ? `${state.feed === 'tldr' ? 'Quick read' : 'Deep read'} cover.`
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
      ? `You finished the ${feed.minutes}-minute quick read. Return to the article or share this view.`
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
    this.indexList.querySelector<HTMLButtonElement>('[aria-current="true"]')?.focus({ preventScroll: true });
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

  closeSurface(surface: HTMLElement, restoreFocus = true): void {
    if (surface.hidden) return;
    surface.hidden = true;
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

  restoreHeading(targetId: string): void {
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
      this.updateOverflow();
    });
  }

  bindCurrentCardOverflow(card: HTMLElement | null, finished = false): void {
    this.scrollCard?.removeEventListener('scroll', this.onCardScroll);
    this.scrollCard = card;
    this.scrollShadow.hidden = true;
    card?.prepend(this.scrollShadow);
    card?.addEventListener('scroll', this.onCardScroll, { passive: true });
    requestAnimationFrame(() => this.updateOverflow(finished));
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
    this.scrollCard?.removeEventListener('scroll', this.onCardScroll);
    this.scrollCard = null;
    this.close();
  }

  private renderContents(feed: CompiledReadingFeed): void {
    this.indexList.replaceChildren(...feed.cards.flatMap((card, index) => {
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

  private renderProgress(feed: CompiledReadingFeed): void {
    this.progress.replaceChildren(...feed.cards.flatMap((card, index) => {
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

  private closeAllSurfaces(restoreFocus: boolean): void {
    this.closeSurface(this.indexOverlay, restoreFocus);
    this.closeSurface(this.sourceOverlay, restoreFocus);
    this.closeSurface(this.imageOverlay, restoreFocus);
  }
}
