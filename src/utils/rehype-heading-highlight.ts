import type { Root, Element } from 'hast';
import { visit } from 'unist-util-visit';

/**
 * Wraps heading text content in <span class="highlight-span"> so rough-notation
 * can annotate just the text portion when the heading is navigated to from the TOC.
 */
export function rehypeHeadingHighlight() {
  return (tree: Root) => {
    visit(tree, 'element', (node: Element) => {
      if (/^h[1-6]$/.test(node.tagName)) {
        node.children = [
          {
            type: 'element',
            tagName: 'span',
            properties: { className: ['highlight-span'] },
            children: node.children,
          },
        ];
      }
    });
  };
}
