export const PILOT_POST_ID =
  'does-the-prophet-speak-only-by-revelation-refuting-the-alleged-contradiction-in-an-najm-53-34';

export function requiredDeckMarkup(): string {
  return `
    <button data-deck-open="tldr">Quick read</button>
    <button data-deck-open="slides">Deep read</button>
    <article id="post-content">
      <p id="introduction">Introduction copy.</p>
      <h2 id="first-heading">First heading</h2>
      <p>First section body.</p>
      <section data-footnotes id="footnotes">
        <h2 id="sources">Sources</h2>
        <ol><li id="source-1">A source.</li></ol>
      </section>
    </article>
    <template data-deck-source-template="tldr">
      <article data-deck-source-root>
        <h2 id="quick-heading">Quick heading</h2><p>Quick body.</p>
      </article>
    </template>
    <dialog data-reading-deck data-post-id="${PILOT_POST_ID}" data-post-title="Pilot"
      data-has-slides="true" data-has-tldr="true">
      <div class="reading-deck-shell">
        <button data-deck-close>Article</button>
        <button data-deck-feed="tldr">Quick read</button>
        <button data-deck-feed="slides">Deep read</button>
        <button data-deck-search>Search</button>
        <button data-deck-menu>Menu</button>
        <div data-deck-progress></div>
        <span data-deck-status></span>
        <span data-deck-position></span>
        <span data-deck-card-title></span>
        <span data-deck-mode-label></span>
        <button data-deck-prev>Previous</button>
        <button data-deck-index-open>Contents</button>
        <button data-deck-next><span>Next</span></button>
        <div data-deck-stage><div data-deck-track></div></div>
        <div data-deck-index hidden>
          <button data-deck-index-close>Close</button>
          <ol data-deck-index-list></ol>
        </div>
        <div data-deck-source-panel hidden>
          <button data-deck-source-close>Close</button>
          <div data-deck-source-content></div>
        </div>
        <div data-deck-image-panel hidden>
          <button data-deck-image-close>Close</button>
          <img data-deck-image alt="" />
        </div>
        <div data-deck-scroll-shadow hidden></div>
        <div data-deck-swipe-hint hidden></div>
        <section data-deck-finish hidden>
          <h2 data-deck-finish-title></h2>
          <p data-deck-finish-copy></p>
          <button data-deck-finish-primary>
            <span data-deck-finish-primary-label></span>
          </button>
        </section>
      </div>
    </dialog>`;
}

function installDialogMethods(): void {
  const prototype = HTMLDialogElement.prototype as HTMLDialogElement & {
    show?: () => void;
    showModal?: () => void;
    close?: () => void;
  };

  prototype.show ??= function show(this: HTMLDialogElement): void {
    this.setAttribute('open', '');
  };
  prototype.showModal ??= function showModal(this: HTMLDialogElement): void {
    this.setAttribute('open', '');
  };
  prototype.close ??= function close(this: HTMLDialogElement): void {
    this.removeAttribute('open');
  };
}

export function installReadingDeckFixture(): HTMLDialogElement {
  installDialogMethods();
  document.body.innerHTML = requiredDeckMarkup();
  return document.querySelector<HTMLDialogElement>('dialog[data-reading-deck]')!;
}

export function resetReadingDeckFixture(): void {
  document.documentElement.classList.remove('reading-deck-ready');
  document.body.className = '';
  document.body.replaceChildren();
  window.localStorage?.clear();
  window.history.replaceState(null, '', '/');
}
