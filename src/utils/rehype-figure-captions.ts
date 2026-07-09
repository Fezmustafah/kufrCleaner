import type { Root, Element, ElementContent } from 'hast';
import { visit } from 'unist-util-visit';

function parseInlineMarkdown(text: string): ElementContent[] {
  const nodes: ElementContent[] = [];
  let remaining = text;

  const patterns: Array<{ regex: RegExp; tag: string }> = [
    { regex: /\*\*(.+?)\*\*/s, tag: 'strong' },
    { regex: /\*(.+?)\*/s,     tag: 'em' },
    { regex: /`(.+?)`/,        tag: 'code' },
    { regex: /\[(.+?)\]\((.+?)\)/, tag: 'a' },
  ];

  while (remaining.length > 0) {
    let earliest: RegExpMatchArray | null = null;
    let earliestIndex = Infinity;
    let matchedPattern: (typeof patterns)[0] | null = null;

    for (const p of patterns) {
      const m = remaining.match(p.regex);
      if (m && m.index !== undefined && m.index < earliestIndex) {
        earliest = m;
        earliestIndex = m.index;
        matchedPattern = p;
      }
    }

    if (!earliest || !matchedPattern) {
      nodes.push({ type: 'text', value: remaining });
      break;
    }

    if (earliestIndex > 0) {
      nodes.push({ type: 'text', value: remaining.slice(0, earliestIndex) });
    }

    if (matchedPattern.tag === 'a') {
      nodes.push({
        type: 'element',
        tagName: 'a',
        properties: { href: earliest[2] },
        children: [{ type: 'text', value: earliest[1] }],
      } as Element);
    } else {
      nodes.push({
        type: 'element',
        tagName: matchedPattern.tag,
        properties: {},
        children: [{ type: 'text', value: earliest[1] }],
      } as Element);
    }

    remaining = remaining.slice(earliestIndex + earliest[0].length);
  }

  return nodes;
}

export function rehypeFigureCaptions() {
  return (tree: Root) => {
    visit(tree, 'element', (node: Element, index: number | undefined, parent: any) => {
      if (node.tagName !== 'img') return;
      if (index === null || index === undefined) return;
      if (!parent || parent.type !== 'element') return;
      if (parent.tagName === 'a' || parent.tagName === 'figure') return;

      const alt = (node.properties?.alt as string) || '';
      if (!alt.trim()) return;

      const classes = (node.properties?.className as string[]) || [];
      if (classes.includes('obsidian-sized')) return;

      const figure: Element = {
        type: 'element',
        tagName: 'figure',
        properties: { 'data-img-w-caption': true },
        children: [
          node,
          {
            type: 'element',
            tagName: 'figcaption',
            properties: {},
            children: [
              {
                type: 'element',
                tagName: 'span',
                properties: { className: ['figure-caption'] },
                children: parseInlineMarkdown(alt),
              },
            ],
          },
        ],
      };

      parent.children.splice(index, 1, figure);
    });
  };
}

export default rehypeFigureCaptions;
