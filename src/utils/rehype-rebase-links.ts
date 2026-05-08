import { visit } from 'unist-util-visit';
import type { Plugin } from 'unified';
import type { Root } from 'hast';

interface Options {
  base?: string;
}

// Rewrites absolute internal href/src attributes to include the deployment base path.
// Required for GitHub Pages where base = '/kufrCleaner/'.
// Skips external URLs, protocol-relative URLs, anchors, and already-rebased paths.
const rehypeRebaseLinks: Plugin<[Options], Root> = ({ base = '/' } = {}) => {
  const prefix = base.replace(/\/$/, ''); // '/kufrCleaner'
  if (!prefix) return () => {};

  return (tree) => {
    visit(tree, 'element', (node: any) => {
      // Rewrite href on <a> and <link>
      if (node.properties?.href) {
        const href = String(node.properties.href);
        if (isInternalAbsolute(href, prefix)) {
          node.properties.href = prefix + href;
        }
      }
      // Rewrite src on <img>
      if (node.properties?.src) {
        const src = String(node.properties.src);
        if (isInternalAbsolute(src, prefix)) {
          node.properties.src = prefix + src;
        }
      }
    });
  };
};

function isInternalAbsolute(url: string, prefix: string): boolean {
  return (
    url.startsWith('/') &&
    !url.startsWith('//') &&
    !url.startsWith(prefix + '/')
  );
}

export default rehypeRebaseLinks;
