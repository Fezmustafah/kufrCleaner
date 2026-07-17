// Pure helpers for the wikilink hover-preview feature. Kept free of module-level
// side effects (no listeners, no DOM mutation on import) so they're unit-testable
// under happy-dom. The stateful client that fetches pages, positions the card,
// and wires listeners lives in src/scripts/link-preview-client.ts.

/** Trailing slash is insignificant for page identity (`/a` === `/a/`). */
function normalizePath(pathname: string): string {
  return pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
}

/**
 * Is `url` a same-origin content page worth previewing, relative to where we are?
 * Excludes off-origin links, the current page (TOC/self anchors), and assets
 * (any last path segment containing a dot, e.g. `foo.png`). Scoping to wikilinks
 * is done by the caller via the `data-wikilink` attribute — this only vets the
 * destination.
 */
export function isPreviewablePath(
  url: URL,
  current: { origin: string; pathname: string }
): boolean {
  if (url.origin !== current.origin) return false;
  if (normalizePath(url.pathname) === normalizePath(current.pathname)) return false;
  const leaf = url.pathname.split('/').filter(Boolean).pop() ?? '';
  if (leaf.includes('.')) return false;
  return true;
}

// Regions inside #post-content that shouldn't appear in a peek: footnote
// apparatus, injected script/style, and anything explicitly opted out.
const CHROME_SELECTORS = [
  'script',
  'style',
  '.footnotes',
  '[data-footnotes]',
  '#footnote-label',
  '[data-skip-preview]',
].join(', ');

/**
 * Given a parsed target document, return the cleaned inner HTML of its
 * `#post-content`, or null if there's nothing to show. Operates on a clone so
 * the source document is untouched; strips chrome and neutralizes every `id`
 * (the preview lives on the same page as the article, so duplicate ids would
 * break in-page anchors and `getElementById`). Images are made lazy.
 */
export function extractPreviewHTML(doc: Document): string | null {
  const source = doc.querySelector('#post-content');
  if (!source) return null;

  const clone = source.cloneNode(true) as HTMLElement;
  clone.querySelectorAll(CHROME_SELECTORS).forEach((el) => el.remove());
  clone.querySelectorAll('[id]').forEach((el) => el.removeAttribute('id'));
  clone.querySelectorAll('img').forEach((img) => img.setAttribute('loading', 'lazy'));

  const html = clone.innerHTML.trim();
  return html || null;
}
