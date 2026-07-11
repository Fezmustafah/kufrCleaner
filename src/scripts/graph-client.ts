// Registers the <graph-component> custom element on any page that contains one.
//
// The definition used to ship as a per-page script inside Graph.astro — with
// Swup's reloadScripts:false that script never executes when a graph page is
// reached via SPA navigation (home → /graph-view/), leaving the component an
// unupgraded skeleton forever. Loading from BaseLayout's always-loaded block
// guarantees registration on every path; the PixiJS-heavy module itself is
// only fetched (dynamic import) when a <graph-component> is actually present.

async function ensureGraphComponent() {
  if (customElements.get('graph-component')) return;
  if (!document.querySelector('graph-component')) return;
  const { GraphComponent } = await import('@/graph/components/graph/graph-component');
  // Re-check: two navigations could race the import
  if (!customElements.get('graph-component')) {
    customElements.define('graph-component', GraphComponent);
  }
}

ensureGraphComponent();
document.addEventListener('swup:page:view', ensureGraphComponent);
