import type { Root, Text, RootContent } from 'mdast';

/**
 * Remark plugin that restores ⟪...⟫ placeholders back to {{...}} in text nodes.
 * Run this BEFORE remarkMarginalia in the plugin chain.
 *
 * The ⟪...⟫ placeholders (U+27EA / U+27EB) are inserted by the
 * mdx-escape-marginalia Vite plugin so that MDX's acorn parser does not
 * reject {{...}} as an invalid JS expression. This plugin undoes that
 * substitution at the MDAST level so remarkMarginalia can process normally.
 */
export function remarkRestoreMarginalia() {
  return (tree: Root) => {
    function visit(nodes: RootContent[]) {
      for (const node of nodes) {
        if (node.type === 'text') {
          (node as Text).value = (node as Text).value
            .replace(/⟪([\s\S]*?)⟫/g, '{{$1}}');
        }
        if ('children' in node && Array.isArray((node as any).children)) {
          visit((node as any).children);
        }
      }
    }
    visit(tree.children);
  };
}
