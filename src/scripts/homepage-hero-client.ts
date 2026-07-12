// Homepage hero: cycling placeholder, count-up stats, the "Latest" segmented
// toggle, and the search handoff.
// Loaded globally from BaseLayout (see the always-loaded init modules block
// there): the homepage can be reached via Swup nav from any entry page, and
// Swup never executes scripts shipped only with the fetched page. No-ops when
// #hero-q is absent.
//
// The hero input is a TRIGGER, not a search field: interacting with it opens
// the search palette (SearchPalette.astro), seeded with anything already
// typed. The form's action=/search remains the no-JS fallback.

function initHero() {
  const input = document.getElementById('hero-q') as HTMLInputElement | null;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Cycling placeholder — real claim-shaped titles
  if (input) {
    const claims = [
      'Did Islam spread by the sword?',
      'Does the Quran call Jesus God?',
      'Is there a contradiction in Quran 4:82?',
      'Was the Bible corrupted?',
      'What are the Satanic Verses?',
    ];
    let ci = 0;
    if (!reduce) {
      const id = window.setInterval(() => {
        if (document.activeElement === input || input.value) return;
        ci = (ci + 1) % claims.length;
        input.setAttribute('placeholder', claims[ci]);
      }, 2600);
      // Stop cycling when the hero leaves the DOM on Swup navigation
      document.addEventListener('swup:page:view', () => window.clearInterval(id), { once: true });
    }
  }

  // Count-up stats
  const compact = (n: number) =>
    n >= 1_000_000 ? (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M'
    : n >= 1_000 ? Math.round(n / 1_000) + 'k'
    : String(n);

  const nums = Array.from(document.querySelectorAll<HTMLElement>('.hero-stat-n'));
  nums.forEach((el) => {
    const target = Number(el.dataset.count || '0');
    const isCompact = el.dataset.format === 'compact';
    const final = isCompact ? compact(target) : target.toLocaleString();
    if (reduce || target <= 0) { el.textContent = final; return; }
    const dur = 1100, start = performance.now();
    const step = (now: number) => {
      const p = Math.min((now - start) / dur, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      const val = Math.floor(eased * target);
      el.textContent = p < 1 ? (isCompact ? compact(val) : val.toLocaleString()) : final;
      if (p < 1) requestAnimationFrame(step);
    };
    el.textContent = isCompact ? compact(0) : '0';
    requestAnimationFrame(step);
  });

  // ── Platform showcase: deferred graph mount ─────────────────────────────
  // The showcase <graph-component> ships inside a <template> so PixiJS never
  // loads with the page; mount it only when the band is scrolled near.
  const graphSlot = document.getElementById('hp-graph-slot');
  const graphTpl = document.getElementById('hp-graph-tpl') as HTMLTemplateElement | null;
  if (graphSlot && graphTpl && !graphSlot.querySelector('graph-component')) {
    const mountGraph = () => {
      graphSlot.appendChild(graphTpl.content.cloneNode(true));
      (window as any).__ensureGraphComponent?.();
    };
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) {
            io.disconnect();
            mountGraph();
          }
        },
        { rootMargin: '400px' },
      );
      io.observe(graphSlot);
    } else {
      mountGraph();
    }
  }

  // ── Platform showcase: appearance demo (palette + light/dark/auto) ──────
  const pal = document.getElementById('hp-pal-demo');
  const modeCtl = document.getElementById('hp-mode-demo');
  if (pal || modeCtl) {
    const syncAppearance = () => {
      if (pal) {
        const cur =
          document.documentElement.getAttribute('data-theme') || pal.dataset.defaultTheme;
        pal.querySelectorAll('button[data-theme]').forEach((b) => {
          b.setAttribute('aria-checked', String(b.getAttribute('data-theme') === cur));
        });
      }
      if (modeCtl) {
        const mode = localStorage.getItem('theme') ?? 'auto';
        modeCtl.querySelectorAll<HTMLElement>('button[data-mode]').forEach((b) => {
          b.setAttribute('aria-checked', String(b.dataset.mode === mode));
        });
      }
    };
    syncAppearance();
    pal?.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest('button[data-theme]');
      if (!btn) return;
      (window as any).changeTheme?.(btn.getAttribute('data-theme'));
      syncAppearance();
    });
    // Same storage contract as the drawer (Header.astro applyMode):
    // localStorage 'theme' = 'light' | 'dark'; ABSENT = follow the system.
    modeCtl?.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>('button[data-mode]');
      if (!btn?.dataset.mode) return;
      const mode = btn.dataset.mode;
      const dark =
        mode === 'dark' ||
        (mode === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      if (mode === 'auto') localStorage.removeItem('theme');
      else localStorage.setItem('theme', mode);
      document.documentElement.classList.remove('light', 'dark');
      document.documentElement.classList.add(dark ? 'dark' : 'light');
      window.dispatchEvent(
        new CustomEvent('themechange', { detail: { theme: dark ? 'dark' : 'light' } }),
      );
      syncAppearance();
    });
    // Drawer changes fire themechange too — keep the demo in sync, and swap
    // out the previous navigation's listener (initHero runs once per page view).
    const prev = (window as any).__hpSyncAppearance;
    if (prev) window.removeEventListener('themechange', prev);
    window.addEventListener('themechange', syncAppearance);
    (window as any).__hpSyncAppearance = syncAppearance;
  }

  // ── Platform showcase: search demo → the real palette, seeded ───────────
  const searchDemo = document.getElementById('hp-search-demo');
  searchDemo?.addEventListener('click', () => {
    const q = searchDemo.dataset.seed || '';
    const sp = (window as any).searchPalette;
    if (sp) sp.open(q || undefined);
    else window.location.href = `/search/?q=${encodeURIComponent(q)}`;
  });

  // ── Portal card stack — front card slides down and away, the deck rises ──
  // Depth per card via CSS vars (--sy/--ss/--so/--sv); cards beyond the top
  // three sit hidden at the back. DOM is fresh after every Swup swap, so no
  // bind-once guard is needed.
  const stack = document.getElementById('hp-portal-stack');
  if (stack) {
    const cards = Array.from(stack.querySelectorAll<HTMLElement>('.hp-scard'));
    const indexBtns = Array.from(stack.querySelectorAll<HTMLButtonElement>('.hp-stack-index button'));
    const DEPTHS = [
      { y: '12px', s: '1' },
      { y: '-16px', s: '0.95' },
      { y: '-44px', s: '0.9' },
    ];
    let head = 0;
    let busy = false;

    const place = (card: HTMLElement, depth: number) => {
      const d = DEPTHS[Math.min(depth, 2)];
      card.style.setProperty('--sy', d.y);
      card.style.setProperty('--ss', d.s);
      card.style.setProperty('--so', depth > 2 ? '0' : '1');
      card.style.zIndex = String(cards.length - depth);
      // Only the front card's links are tabbable
      card.querySelectorAll('a').forEach((a) => a.setAttribute('tabindex', depth === 0 ? '0' : '-1'));
      card.toggleAttribute('inert', depth !== 0);
    };

    const syncIndex = () =>
      indexBtns.forEach((b, i) => b.setAttribute('aria-pressed', String(i === head)));

    const layout = () => {
      cards.forEach((card, i) => place(card, (i - head + cards.length) % cards.length));
      syncIndex();
    };
    layout();

    // Bring any card to the front: the current front card exits downward
    // (same move whether "Next portal" or an index chip asked for it), the
    // deck re-stacks behind the new head.
    const goTo = (target: number) => {
      if (busy || target === head || cards.length < 2) return;
      busy = true;
      const leaving = cards[head];
      // Send the front card down past the stage's bottom edge, full size
      leaving.style.zIndex = String(cards.length + 1);
      leaving.style.setProperty('--sy', '340px');
      leaving.style.setProperty('--ss', '1');
      head = target;
      cards.forEach((card, i) => {
        if (card !== leaving) place(card, (i - head + cards.length) % cards.length);
      });
      syncIndex();
      const settle = reduce ? 0 : 700;
      window.setTimeout(() => {
        // Teleport the exited card to its new deck slot without animating
        leaving.classList.add('no-trans');
        place(leaving, (cards.indexOf(leaving) - head + cards.length) % cards.length);
        // Two frames: one to apply the teleport, one before transitions return
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            leaving.classList.remove('no-trans');
            busy = false;
          }),
        );
      }, settle);
    };

    document.getElementById('hp-stack-next')?.addEventListener('click', () => goTo((head + 1) % cards.length));
    indexBtns.forEach((b, i) => b.addEventListener('click', () => goTo(i)));
  }

  // ── Segmented "Latest" toggle (newly added / recently updated) ──────────
  const seg = document.querySelector('.hp-seg');
  if (seg) {
    seg.querySelectorAll('button').forEach((btn) => {
      btn.addEventListener('click', () => {
        seg.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', 'false'));
        btn.setAttribute('aria-pressed', 'true');
        const isNew = (btn as HTMLElement).dataset.tab === 'new';
        const nw = document.getElementById('hp-latest-new');
        const up = document.getElementById('hp-latest-upd');
        if (nw) nw.hidden = !isNew;
        if (up) up.hidden = isNew;
      });
    });
  }

  // ── Search handoff → palette ────────────────────────────────────────────
  const form = input?.closest('form') as HTMLFormElement | null;
  if (input && form) {
    const palette = () => (window as any).searchPalette;

    // Pointer: intercept before focus lands so the caret never enters the hero
    input.addEventListener('pointerdown', (e) => {
      if (!palette()) return; // no palette → behave as a plain input + form
      e.preventDefault();
      palette().open(input.value.trim() || undefined);
    });
    // Keyboard (tab focus) — same handoff
    input.addEventListener('focus', () => {
      palette()?.open(input.value.trim() || undefined);
    });
    // "Find the answer" submit — palette when available, /search otherwise
    form.addEventListener('submit', (e) => {
      if (!palette()) return;
      e.preventDefault();
      palette().open(input.value.trim() || undefined);
    });
  }
}

// Direct call for initial load (only DOMContentLoaded fires then); swup:page:view
// (fires once per navigation) re-wires the hero after each swap.
initHero();
document.addEventListener('swup:page:view', initHero);
