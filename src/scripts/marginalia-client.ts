// Extracted from PostLayout.astro so the script always loads via BaseLayout
// (Astro hoists per-component scripts; with Swup reloadScripts:false a script
// that wasn't on the initial page never runs after Swup nav. Loading this
// from BaseLayout guarantees it's present on every page; init no-ops when
// no .footnote-container is in the DOM.)

declare global {
  interface Window {
    openLightbox: (src: string, alt: string) => void;
    initializeMarginalia?: () => void;
    layoutMarginaliaFloats?: () => void;
    _marginaliaAC?: AbortController;
    _margRun?: () => void;
  }
}

function wireImgLightbox(img: HTMLImageElement, beforeOpen?: (e: MouseEvent) => void) {
  if ((img as any)._lightboxWired) return;
  (img as any)._lightboxWired = true;
  img.style.cursor = 'pointer';
  img.addEventListener('click', (e) => {
    beforeOpen?.(e);
    if (typeof window.openLightbox === 'function') {
      window.openLightbox(img.src, img.alt || '');
    }
  });
}

// Positions each .footnote absolutely beside the article — aarnphm-purist:
// a note sits EXACTLY level with its anchor or not at all (no downward
// drift). Both margins are used (vaultpress-style): right first, then the
// free strip left of the TOC rail on wide viewports; when neither side is
// clear at the anchor's height the note demotes to a hover/click popover
// (`.marginalia-overflow` on its container).
function layoutMarginaliaFloats() {
  const article = document.querySelector<HTMLElement>('.post-layout-article');
  if (!article) return;

  if (getComputedStyle(article).position === 'static') {
    article.style.position = 'relative';
  }

  const notes = Array.from(document.querySelectorAll<HTMLElement>('.footnote'));
  if (!notes.length) return;

  const isWide = window.innerWidth >= 1100;

  if (!isWide) {
    notes.forEach(n => {
      n.style.top = ''; n.style.left = ''; n.style.width = '';
      n.closest('.footnote-container')?.classList.remove('marginalia-overflow');
    });
    article.style.minHeight = '';
    return;
  }

  const NOTE_GAP = 8;
  const SIDE_GAP = 12;
  const EDGE_PAD = 12; // breathing room against the viewport edge
  // Mirrors the .footnote width breakpoints in marginalia.css — left notes
  // are identical to right notes (same width, same CSS), just mirrored.
  const NOTE_W = window.innerWidth >= 1300 ? 260 : 175;

  article.style.minHeight = '';

  const articleRect = article.getBoundingClientRect();

  // Right margin: the infobox + local graph column occupies the top of the
  // gutter — the right side is only clear below it. offsetParent is null
  // when the column is display:none (<1100px).
  let lastBottomRight = 0;
  const rightCol = document.querySelector<HTMLElement>('.post-layout-right-col');
  if (rightCol && rightCol.offsetParent !== null) {
    const rcRect = rightCol.getBoundingClientRect();
    lastBottomRight = Math.max(0, rcRect.bottom - articleRect.top + NOTE_GAP);
  }

  // Left margin: the strip between the TOC rail and the content text.
  // PostLayout snugs every post's content block toward the infobox, pooling
  // the column's slack here so laptop viewports get a usable left strip.
  // Width adapts to the strip (capped at the
  // right-side width); below MIN_LEFT_W the left side is unused.
  let lastBottomLeft = 0;
  const MIN_LEFT_W = 170;
  // The rail's hover zone is mostly invisible padding — only the ~1rem bars
  // need clearance, so notes may run under the rest of the zone.
  const rail = document.querySelector<HTMLElement>('nav#toc-vertical');
  const railBarsRight = rail && rail.offsetParent !== null
    ? rail.getBoundingClientRect().left + 28
    : EDGE_PAD;
  const contentRect = (document.getElementById('post-content') ?? article).getBoundingClientRect();
  // Right notes sit at articleRect.right + SIDE_GAP; mirror their actual
  // text-to-note distance on the left so both sides read symmetrically.
  const bodyGap = Math.max(SIDE_GAP, articleRect.right + SIDE_GAP - contentRect.right);
  const leftEdge = contentRect.left - bodyGap; // right edge of left notes
  const leftW = Math.min(NOTE_W, leftEdge - railBarsRight);
  const leftUsable = leftW >= MIN_LEFT_W;

  notes.forEach(note => {
    const container = note.closest<HTMLElement>('.footnote-container');
    const label     = container?.querySelector<HTMLElement>('.footnote-number');
    if (!container || !label) return;

    const opParent = note.offsetParent as HTMLElement | null;
    const opRect   = opParent ? opParent.getBoundingClientRect() : articleRect;

    const labelRect  = label.getBoundingClientRect();
    const desiredTop = labelRect.top - opRect.top;

    // Zero drift: a side fits only if it's clear at the anchor's exact height
    // (lastBottom* already includes NOTE_GAP). Right is the home side; left
    // takes the overflow; otherwise the note demotes to a popover.
    const fitsRight = desiredTop >= lastBottomRight;
    const fitsLeft  = leftUsable && desiredTop >= lastBottomLeft;

    if (!fitsRight && !fitsLeft) {
      container.classList.add('marginalia-overflow');
      note.style.top = ''; note.style.left = ''; note.style.width = '';
      return; // doesn't occupy a margin slot
    }
    container.classList.remove('marginalia-overflow');

    note.style.top = `${desiredTop}px`;
    if (fitsRight) {
      note.style.width = ''; // CSS breakpoint width applies on the right
      note.style.left  = `${articleRect.right - opRect.left + SIDE_GAP}px`;
      lastBottomRight  = desiredTop + note.offsetHeight + NOTE_GAP;
    } else {
      note.style.width = `${leftW}px`;
      note.style.left  = `${leftEdge - leftW - opRect.left}px`;
      lastBottomLeft   = desiredTop + note.offsetHeight + NOTE_GAP;
    }
  });

  const notesBottom = Math.max(lastBottomLeft, lastBottomRight) - NOTE_GAP;
  if (notesBottom > article.offsetHeight) {
    const cs = getComputedStyle(article);
    const extraBottom = parseFloat(cs.paddingBottom) + parseFloat(cs.borderBottomWidth);
    article.style.minHeight = `${notesBottom + extraBottom}px`;
  }
}

function initMarginalia() {
  // Teardown FIRST, before any early return — the popover lives on <body>,
  // outside the Swup container, so a page without marginalia must still
  // remove a popover left visible by the previous page.
  const prevAC = (window as any)._marginaliaAC as AbortController | undefined;
  if (prevAC) prevAC.abort();
  document.getElementById('marginalia-popover')?.remove();

  const containers = document.querySelectorAll<HTMLElement>('.footnote-container');
  // GFM footnote refs get a hover peek of their definition (aarnphm-style):
  // body refs + links inside margin notes; the hidden echo refs excluded.
  const fnRefs = Array.from(document.querySelectorAll<HTMLAnchorElement>(
    // .pl-read-page: the homepage reading-experience demo gets the same peek
    '#post-content sup:not(.fn-echo) > a[data-footnote-ref], #post-content sup.note-fn-ref > a, .pl-read-page sup:not(.fn-echo) > a[data-footnote-ref]'
  ));
  if (!containers.length && !fnRefs.length) return;

  const floatsVisible = () => window.innerWidth >= 1100;
  // A note lives in the margin unless we're narrow OR the drift cap demoted
  // it to popover mode (see layoutMarginaliaFloats).
  const noteInMargin = (container: HTMLElement) =>
    floatsVisible() && !container.classList.contains('marginalia-overflow');

  layoutMarginaliaFloats();

  const ac = new AbortController();
  (window as any)._marginaliaAC = ac;
  const sig = ac.signal;

  const pop = document.createElement('div');
  pop.id = 'marginalia-popover';
  pop.className = 'marginalia-popover';
  pop.setAttribute('role', 'tooltip');
  document.body.appendChild(pop);

  let hideTimer: ReturnType<typeof setTimeout> | null = null;
  const scheduleHide = () => { hideTimer = setTimeout(() => pop.classList.remove('is-visible'), 200); };
  const cancelHide   = () => { if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; } };

  const reposition = (anchor: HTMLElement) => {
    const rect = anchor.getBoundingClientRect();
    const pw = 260;
    const ph = pop.offsetHeight || 0;
    const gap = 8;
    const top = (rect.top - ph - gap > 16) ? rect.top - ph - gap : rect.bottom + gap;
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - pw - 8));
    pop.style.top  = `${top}px`;
    pop.style.left = `${left}px`;
  };

  const showPopoverFor = (anchor: HTMLElement, container: HTMLElement) => {
    cancelHide();
    const noteEl  = container.querySelector<HTMLElement>('.footnote');
    const labelEl = container.querySelector<HTMLElement>('.footnote-number');
    if (!noteEl || !labelEl) return;

    pop.innerHTML = `<span class="marginalia-popover-text">${noteEl.innerHTML}</span>`;
    pop.querySelectorAll<HTMLImageElement>('img').forEach(img => {
      wireImgLightbox(img, (e) => { e.stopPropagation(); });
    });
    const imgs = pop.querySelectorAll<HTMLImageElement>('img');
    if (imgs.length) pop.style.minHeight = '160px';

    requestAnimationFrame(() => {
      reposition(anchor);
      pop.classList.add('is-visible');
      imgs.forEach(img => {
        if (img.complete) {
          pop.style.minHeight = '';
        } else {
          img.addEventListener('load',  () => { pop.style.minHeight = ''; reposition(anchor); }, { once: true });
          img.addEventListener('error', () => { pop.style.minHeight = ''; }, { once: true });
        }
      });
    });
  };

  pop.addEventListener('mouseenter', cancelHide, { signal: sig });
  pop.addEventListener('mouseleave', scheduleHide, { signal: sig });

  // While the page scrolls, elements sweep under the stationary cursor and
  // fire bogus mouseenters (Chrome updates hover state on scroll) — dismiss
  // and suppress hover popovers until scrolling settles.
  let scrolling = false;
  let scrollSettle: ReturnType<typeof setTimeout> | null = null;
  window.addEventListener('scroll', () => {
    scrolling = true;
    pop.classList.remove('is-visible');
    if (scrollSettle) clearTimeout(scrollSettle);
    scrollSettle = setTimeout(() => { scrolling = false; }, 150);
  }, { signal: sig, passive: true });
  // A real mousemove means the hover is deliberate — lift the suppression
  // (the bogus enters we're guarding against come without any movement)
  document.addEventListener('mousemove', () => { scrolling = false; }, { signal: sig, passive: true });

  // Footnote peek: hovering a ref shows the definition (backref stripped) in
  // the shared popover; clicking still navigates to the bottom section.
  fnRefs.forEach(ref => {
    const targetId = decodeURIComponent((ref.getAttribute('href') || '').slice(1));
    if (!targetId) return;
    ref.addEventListener('mouseenter', () => {
      if (scrolling) return;
      const def = document.getElementById(targetId);
      if (!def) return;
      cancelHide();
      const clone = def.cloneNode(true) as HTMLElement;
      clone.querySelectorAll('[data-footnote-backref]').forEach(a => a.remove());
      pop.innerHTML = `<span class="marginalia-popover-num">${ref.textContent}.</span><span class="marginalia-popover-text">${clone.innerHTML}</span>`;
      requestAnimationFrame(() => { reposition(ref); pop.classList.add('is-visible'); });
    }, { signal: sig });
    ref.addEventListener('mouseleave', scheduleHide, { signal: sig });
    // Double-rAF so the hide lands after the mouseenter's rAF-deferred show
    ref.addEventListener('click', () => {
      requestAnimationFrame(() => requestAnimationFrame(() => pop.classList.remove('is-visible')));
    }, { signal: sig });
  });

  containers.forEach(container => {
    const noteEl  = container.querySelector<HTMLElement>('.footnote');
    const labelEl = container.querySelector<HTMLElement>('.footnote-number');
    if (!labelEl) return;

    const highlight   = () => container.classList.add('is-highlighted');
    const unhighlight = (e: MouseEvent) => {
      const rt = e.relatedTarget as Node | null;
      if (rt && container.contains(rt)) return;
      container.classList.remove('is-highlighted');
    };

    container.addEventListener('mouseenter', highlight, { signal: sig });
    container.addEventListener('mouseleave', unhighlight as EventListener, { signal: sig });
    if (noteEl) {
      noteEl.addEventListener('mouseenter', highlight, { signal: sig });
      noteEl.addEventListener('mouseleave', unhighlight as EventListener, { signal: sig });
    }

    const activate = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();

      if (noteInMargin(container)) {
        if (!noteEl) return;
        noteEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        container.classList.add('is-highlighted');
        setTimeout(() => container.classList.remove('is-highlighted'), 1500);
      } else {
        showPopoverFor(labelEl, container);
      }
    };

    labelEl.addEventListener('click', activate, { signal: sig });

    // Keyboard access (ported from alkarkari): the marker is a real control.
    labelEl.tabIndex = 0;
    labelEl.setAttribute('role', 'button');
    labelEl.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') activate(e);
    }, { signal: sig });

    container.addEventListener('mouseenter', () => {
      if (scrolling) return;
      if (!noteInMargin(container)) showPopoverFor(labelEl, container);
    }, { signal: sig });
    container.addEventListener('mouseleave', () => {
      if (!noteInMargin(container)) scheduleHide();
    }, { signal: sig });
  });

  document.querySelectorAll<HTMLImageElement>('.footnote img').forEach(img => {
    wireImgLightbox(img, (e) => { e.stopPropagation(); });
  });

  document.addEventListener('click', e => {
    if (!pop.contains(e.target as Node) && !(e.target as Element).closest?.('.footnote-container')) {
      pop.classList.remove('is-visible');
    }
  }, { signal: sig });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') pop.classList.remove('is-visible'); }, { signal: sig });

  let lastWasFloats = floatsVisible();
  let resizeTimer: ReturnType<typeof setTimeout> | null = null;
  window.addEventListener('resize', () => {
    const nowFloats = floatsVisible();
    if (nowFloats !== lastWasFloats) {
      pop.classList.remove('is-visible');
      document.querySelectorAll('.footnote-container.is-highlighted').forEach(c => c.classList.remove('is-highlighted'));
      lastWasFloats = nowFloats;
    }
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => layoutMarginaliaFloats(), 100);
  }, { signal: sig, passive: true });
}

window.initializeMarginalia   = initMarginalia;
window.layoutMarginaliaFloats = layoutMarginaliaFloats;

function scheduleLayout() {
  requestAnimationFrame(() => requestAnimationFrame(() => layoutMarginaliaFloats()));
}

let _margLastPath = '';
function runMarginalia() {
  const path = window.location.pathname;
  if (path === _margLastPath) return;
  _margLastPath = path;
  initMarginalia();
  scheduleLayout();
  document.fonts.ready.then(scheduleLayout);
}

window._margRun = runMarginalia;

document.addEventListener('DOMContentLoaded', runMarginalia);
document.addEventListener('astro:page-load', runMarginalia);
if (document.readyState !== 'loading') requestAnimationFrame(runMarginalia);
window.addEventListener('pageshow', e => { if (e.persisted) { _margLastPath = ''; runMarginalia(); } });

export {};
