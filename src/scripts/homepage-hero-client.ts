// Homepage hero: cycling placeholder, count-up stats, and the search handoff.
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
