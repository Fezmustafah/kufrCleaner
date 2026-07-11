// Share / Open in AI dropdowns (PageActions.astro). Loaded globally from
// BaseLayout (see the always-loaded init modules block there): post pages can
// be reached via Swup nav from any entry page, and Swup never executes scripts
// shipped only with the fetched page. No-ops when no .pa-dropdown is present.
function initializePageActions() {
  // ── Colophon placement ───────────────────────────────────────
  // The colophon belongs right after the reading content, ABOVE the GFM
  // footnote section — but footnotes render inside #post-content, so the
  // static HTML can't interleave them. Relocate per page view (idempotent;
  // no-JS readers see the colophon just below the footnotes instead).
  const fns = document.querySelector('#post-content section.footnotes');
  const colophon = document.querySelector('.post-colophon');
  if (fns && colophon) fns.parentNode?.insertBefore(colophon, fns);

  // ── Dropdowns ────────────────────────────────────────────────
  document.querySelectorAll<HTMLElement>('.pa-dropdown').forEach((dropdown) => {
    const id = dropdown.dataset.dropdownId!;
    const toggle = dropdown.querySelector<HTMLButtonElement>(`#pa-toggle-${id}`);
    const menu = dropdown.querySelector<HTMLElement>(`#pa-menu-${id}`);
    if (!toggle || !menu) return;

    const freshToggle = toggle.cloneNode(true) as HTMLButtonElement;
    toggle.parentNode?.replaceChild(freshToggle, toggle);

    freshToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      const opening = !menu.classList.contains('is-open');
      // close all
      document.querySelectorAll('.pa-menu').forEach(m => m.classList.remove('is-open'));
      document.querySelectorAll('.pa-dropdown-toggle').forEach(t =>
        (t as HTMLButtonElement).setAttribute('aria-expanded', 'false'));
      if (opening) {
        menu.classList.add('is-open');
        freshToggle.setAttribute('aria-expanded', 'true');
      }
    });
  });

  // outside click — deduplicated
  if ((window as any)._paOutsideClick) {
    document.removeEventListener('click', (window as any)._paOutsideClick);
  }
  const outsideClick = () => {
    document.querySelectorAll('.pa-menu').forEach(m => m.classList.remove('is-open'));
    document.querySelectorAll('.pa-dropdown-toggle').forEach(t =>
      (t as HTMLButtonElement).setAttribute('aria-expanded', 'false'));
  };
  (window as any)._paOutsideClick = outsideClick;
  document.addEventListener('click', outsideClick);
}

(window as any).initializePageActions = initializePageActions;
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializePageActions);
} else {
  initializePageActions();
}
document.addEventListener('astro:page-load', initializePageActions);
