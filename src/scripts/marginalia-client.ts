// Extracted from PostLayout.astro so the script always loads via BaseLayout
// (Astro hoists per-component scripts; with Swup reloadScripts:false a script
// that wasn't on the initial page never runs after Swup nav. Loading this
// from BaseLayout guarantees it's present on every page; init no-ops when
// no .footnote-container is in the DOM.)

declare global {
  interface Window {
    openLightbox?: (src: string, alt: string) => void;
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

// Positions each .footnote absolutely to the right of the article,
// aligned with its label and pushed down only when needed to avoid overlap.
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
    notes.forEach(n => { n.style.top = ''; n.style.left = ''; });
    article.style.minHeight = '';
    return;
  }

  const NOTE_GAP = 8;
  const SIDE_GAP = 12;

  article.style.minHeight = '';

  const articleRect = article.getBoundingClientRect();
  let lastBottom = 0;

  notes.forEach(note => {
    const container = note.closest<HTMLElement>('.footnote-container');
    const label     = container?.querySelector<HTMLElement>('.footnote-number');
    if (!container || !label) return;

    const opParent = note.offsetParent as HTMLElement | null;
    const opRect   = opParent ? opParent.getBoundingClientRect() : articleRect;

    note.style.left = `${articleRect.right - opRect.left + SIDE_GAP}px`;

    const labelRect  = label.getBoundingClientRect();
    const desiredTop = labelRect.top - opRect.top;
    const topVal     = Math.max(desiredTop, lastBottom);
    note.style.top   = `${topVal}px`;

    lastBottom = topVal + note.offsetHeight + NOTE_GAP;
  });

  const notesBottom = lastBottom - NOTE_GAP;
  if (notesBottom > article.offsetHeight) {
    const cs = getComputedStyle(article);
    const extraBottom = parseFloat(cs.paddingBottom) + parseFloat(cs.borderBottomWidth);
    article.style.minHeight = `${notesBottom + extraBottom}px`;
  }
}

function initMarginalia() {
  const containers = document.querySelectorAll<HTMLElement>('.footnote-container');
  if (!containers.length) return;

  const floatsVisible = () => window.innerWidth >= 1100;

  layoutMarginaliaFloats();

  // Abort stale listeners from previous page navigation
  const prevAC = (window as any)._marginaliaAC as AbortController | undefined;
  if (prevAC) prevAC.abort();
  const ac = new AbortController();
  (window as any)._marginaliaAC = ac;
  const sig = ac.signal;

  // Recreate popover fresh
  const oldPop = document.getElementById('marginalia-popover');
  if (oldPop) oldPop.remove();
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

    const allLabels = Array.from(document.querySelectorAll<HTMLElement>('.footnote-number'));
    const idx = allLabels.indexOf(labelEl) + 1;

    pop.innerHTML = `<span class="marginalia-popover-num">${idx}.</span><span class="marginalia-popover-text">${noteEl.innerHTML}</span>`;
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

    labelEl.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();

      if (floatsVisible()) {
        if (!noteEl) return;
        noteEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        container.classList.add('is-highlighted');
        setTimeout(() => container.classList.remove('is-highlighted'), 1500);
      } else {
        showPopoverFor(labelEl, container);
      }
    }, { signal: sig });

    container.addEventListener('mouseenter', () => {
      if (!floatsVisible()) showPopoverFor(labelEl, container);
    }, { signal: sig });
    container.addEventListener('mouseleave', () => {
      if (!floatsVisible()) scheduleHide();
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
