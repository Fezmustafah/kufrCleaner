import type { Root, Element } from 'hast';
import { visit } from 'unist-util-visit';

/**
 * Rehype plugin to normalize anchor link hrefs
 * Ensures anchor links like #Choose%20Your%20Workflow are converted to #choose-your-workflow
 */
export function rehypeNormalizeAnchors() {
  return (tree: Root) => {
    visit(tree, 'element', (node: Element, index: number | undefined, parent: any) => {
      if (node.tagName === 'a') {
        // Skip heading anchor links (created by rehypeAutolinkHeadings)
        // These have the 'anchor-link' class and shouldn't get wikilink styling
        const className = node.properties?.className;
        
        // Check for anchor-link class (array or string format)
        let hasAnchorLinkClass = false;
        if (Array.isArray(className)) {
          hasAnchorLinkClass = className.some((c: any) => 
            typeof c === 'string' && c.includes('anchor-link')
          );
        } else if (typeof className === 'string') {
          hasAnchorLinkClass = className.includes('anchor-link');
        }
        
        if (hasAnchorLinkClass) {
          return; // Skip this link - it's a heading anchor link
        }

        // Skip links with data-role="anchor" (rehypeAutolinkHeadings append mode)
        if (node.properties?.['data-role'] === 'anchor' || node.properties?.dataRole === 'anchor') {
          return;
        }
        
        // Also check if parent is a heading element
        if (parent && typeof parent === 'object' && 'tagName' in parent) {
          const parentTag = String(parent.tagName || '').toLowerCase();
          if (/^h[1-6]$/.test(parentTag)) {
            return; // Skip this link - it's inside a heading
          }
        }
        
        // Get href from properties - could be string or array
        const hrefValue = node.properties?.href;
        let href: string | null = null;
        
        if (typeof hrefValue === 'string') {
          href = hrefValue;
        } else if (Array.isArray(hrefValue) && hrefValue.length > 0 && typeof hrefValue[0] === 'string') {
          href = hrefValue[0];
        }
        
        if (!href) return;
        
        // Skip same-page anchor links (href starts with #)
        // remarkToc generates these with slugs that already match rehypeSlug output.
        // Normalizing them strips Arabic/Unicode chars and breaks non-Latin headings.
        if (href.startsWith('#')) {
          return;
        }
      }
    });
  };
}

