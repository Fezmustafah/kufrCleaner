import { visit } from 'unist-util-visit';
import type { Plugin } from 'unified';
import type { Root, Blockquote, Paragraph, Text } from 'mdast';
import { resolveCalloutType, getCalloutMeta, getCalloutGroup } from './callout-registry';

/**
 * Recursively extract all text content from a node and its children
 * Handles text nodes, strong, emphasis, links, and other inline elements
 */
function extractTextFromNode(node: any): string {
  if (!node) return '';
  
  if (node.type === 'text') {
    return node.value || '';
  }
  
  if (node.children && Array.isArray(node.children)) {
    return node.children.map((child: any) => extractTextFromNode(child)).join('');
  }
  
  return '';
}

// Lucide SVG paths — covers all Obsidian built-in callout icons + common custom ones
const iconPaths: Record<string, string> = {
  // ── Informational ──
  'info':            '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="m12 8 .01 0"/>',
  'lightbulb':       '<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/>',
  'pencil':          '<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/>',
  'file-text':       '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>',
  'clipboard-list':  '<rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/>',
  'book-open':       '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 0 3-3h7z"/>',
  'list':            '<line x1="8" x2="21" y1="6" y2="6"/><line x1="8" x2="21" y1="12" y2="12"/><line x1="8" x2="21" y1="18" y2="18"/><line x1="3" x2="3.01" y1="6" y2="6"/><line x1="3" x2="3.01" y1="12" y2="12"/><line x1="3" x2="3.01" y1="18" y2="18"/>',
  'message-circle':  '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>',
  'quote':           '<path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"/><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z"/>',
  // ── Status / outcome ──
  'circle-check':    '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
  'check-circle-2':  '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
  'check':           '<path d="M20 6 9 17l-5-5"/>',
  'circle-x':        '<circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/>',
  'x':               '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  'circle-alert':    '<circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="m12 16 .01 0"/>',
  'triangle-alert':  '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="m12 17 .01 0"/>',
  'alert-triangle':  '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="m12 17 .01 0"/>',
  'circle-help':     '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
  'help-circle':     '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
  'bug':             '<path d="m8 2 1.88 1.88"/><path d="M14.12 3.88 16 2"/><path d="M9 7.13v-1a3.003 3.003 0 1 1 6 0v1"/><path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6"/><path d="M12 20v-9"/><path d="M6.53 9C4.6 8.8 3 7.1 3 5"/><path d="M6 13H2"/><path d="M3 21c0-2.1 1.7-3.9 3.8-4"/><path d="M20.97 5c0 2.1-1.6 3.8-3.5 4"/><path d="M22 13h-4"/><path d="M17.2 17c2.1.1 3.8 1.9 3.8 4"/>',
  // ── Emphasis / priority ──
  'star':            '<polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/>',
  'flame':           '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 3z"/>',
  'zap':             '<path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/>',
  'bookmark':        '<path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/>',
  'flag':            '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" x2="4" y1="22" y2="15"/>',
  'heart':           '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
  'target':          '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
  'trophy':          '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>',
  // ── Time / reference ──
  'clock':           '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  'calendar':        '<rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/>',
  'link':            '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  // ── Security / access ──
  'lock':            '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  'key':             '<circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6"/><path d="m15.5 7.5 3 3L22 7l-3-3"/>',
  'shield':          '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
  // ── Media / UI ──
  'eye':             '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
  'code':            '<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>',
  'plus':            '<path d="M5 12h14"/><path d="M12 5v14"/>',
  'wrench':          '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
  'edit-3':          '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  // ── Extended for custom callouts ──
  'search':          '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  'type':            '<polyline points="4 7 4 4 20 4 20 7"/><line x1="9" x2="15" y1="20" y2="20"/><line x1="12" x2="12" y1="4" y2="20"/>',
  'landmark':        '<line x1="3" x2="21" y1="22" y2="22"/><line x1="6" x2="6" y1="18" y2="22"/><line x1="10" x2="10" y1="18" y2="22"/><line x1="14" x2="14" y1="18" y2="22"/><line x1="18" x2="18" y1="18" y2="22"/><path d="M3 18h18"/><path d="M3 14h18"/><path d="m2 14 10-10 10 10"/>',
  'graduation-cap':  '<path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z"/><path d="M22 10v6"/><path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5"/>',
  'message-square':  '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  'scroll':          '<path d="M8 21h12a2 2 0 0 0 2-2v-2H10v2a2 2 0 0-2 2z"/><path d="M19 7V5a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v2"/><path d="M19 11H5a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h14"/>',
  'book':            '<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20"/>',
  'scale':           '<path d="m16 2-2.3 2.3"/><path d="M3 22h18"/><path d="M9 22V6"/><path d="M15 22V6"/><path d="m8 2 2.3 2.3"/><path d="m6 7 3 3"/><path d="m15 7 3-3"/><path d="m18 10-3 3"/>',
  'swords':          '<polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5"/><line x1="13" x2="19" y1="19" y2="13"/><line x1="16" x2="20" y1="16" y2="20"/><line x1="19" x2="21" y1="21" y2="19"/>',
  // ── Callout Manager custom icons ──
  'scroll-text':     '<path d="M15 12h-5"/><path d="M15 8h-5"/><path d="M19 17V5a2 2 0 0 0-2-2H4"/><path d="M8 21h12a2 2 0 0 0 2-2v-1H10v1a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v2h4"/>',
  'book-plus':       '<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/><path d="M9 10h6"/><path d="M12 7v6"/>',
  'book-heart':      '<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/><path d="M16 8.5c0-.83-.67-1.5-1.5-1.5-.28 0-.54.08-.76.22A1.5 1.5 0 0 0 11 8.5c0 1.2 1.5 2.5 2.25 3.09a.5.5 0 0 0 .57 0C14.5 11 16 9.7 16 8.5"/>',
};

// Resolved callout types that quote/cite a source. Only these split a
// single-line `> [!type] attribution "quoted text"` into title + body.
const SPLIT_TYPES = new Set([
  'scholar', 'cite', 'research', 'consensus', 'manuscript', 'science',
  'admission', 'source', 'quran', 'bible', 'hadith', 'quote',
]);

// Length (in flattened text) contributed by an inline node, for offset math
// against `paragraphText` (built the same way via extractTextFromNode).
function inlineTextLength(node: any): number {
  if (node.type === 'text') return (node.value as string).length;
  if (Array.isArray(node.children)) return node.children.reduce((n: number, c: any) => n + inlineTextLength(c), 0);
  return 0; // atomic inline counts 0 for offset purposes
}

// Returns the inline nodes representing text from `offset` to the end of
// `children`, splitting a text node or descending into a container when the
// offset lands inside it. Preserves mdast structure (emphasis, citations, ...).
function sliceInlineChildrenFrom(children: any[], offset: number): any[] {
  const out: any[] = [];
  let pos = 0;
  for (const child of children) {
    const len = inlineTextLength(child);
    if (pos + len <= offset) { pos += len; continue; }
    if (pos >= offset) { out.push(child); pos += len; continue; }
    const cut = offset - pos;
    if (child.type === 'text') {
      out.push({ type: 'text', value: (child.value as string).slice(cut) });
    } else if (Array.isArray(child.children)) {
      out.push({ ...child, children: sliceInlineChildrenFrom(child.children, cut) });
    } else {
      out.push(child);
    }
    pos += len;
  }
  return out;
}

// Strips a leading/trailing literal quote character (allowing an adjacent
// `_` from emphasis markers) from the actual first/last text node in the
// tree — mutates in place so the change survives inside nested containers.
function stripWrappingQuotes(inline: any[]): any[] {
  const nodes = inline.map(n => ({ ...n, children: n.children ? [...n.children] : n.children }));
  const first = findEdgeTextNode(nodes, true);
  if (first) first.value = (first.value as string).replace(/^\s*[_"“]+/, '');
  const last = findEdgeTextNode(nodes, false);
  if (last) last.value = (last.value as string).replace(/[_"”]+\s*$/, '');
  return nodes;
}

// Returns the actual first/last text node (mutable reference) by walking
// children in order (or reverse order) via indices — NOT reversed copies —
// so mutating the returned node mutates the tree we return.
function findEdgeTextNode(nodes: any[], first: boolean): any | null {
  const order = first ? [...nodes.keys()] : [...nodes.keys()].reverse();
  for (const i of order) {
    const n = nodes[i];
    if (n && n.type === 'text') return n;
    if (n && Array.isArray(n.children)) { const r = findEdgeTextNode(n.children, first); if (r) return r; }
  }
  return null;
}

// Trims a split-off title label and strips trailing separator punctuation
// (verse/citation dashes, colons, underscores from emphasis) left dangling
// right before the quote mark, e.g. "Ibn Kathir —" -> "Ibn Kathir".
function cleanSplitTitle(raw: string): string {
  return raw.trim().replace(/[\s_—–:-]+$/, '').trim();
}

function getIconSVG(iconName: string, iconType: 'lucide' | 'emoji' = 'lucide'): string {
  if (iconType === 'emoji') {
    return `<span class="callout-icon callout-icon-emoji" aria-hidden="true">${iconName}</span>`;
  }
  const path = iconPaths[iconName] || iconPaths['info'];
  return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="callout-icon">${path}</svg>`;
}

const remarkCallouts: Plugin<[], Root> = () => {
  return (tree) => {
    visit(tree, 'blockquote', (node: Blockquote, index, parent) => {
      // Check if this blockquote contains a callout pattern
      const firstChild = node.children[0];
      if (!firstChild || firstChild.type !== 'paragraph') return;
      
      // Extract all text from the first paragraph to find the callout pattern
      const firstParagraph = firstChild as Paragraph;
      const paragraphText = extractTextFromNode(firstParagraph);
      
      // Match callout pattern at the start of the paragraph text
      // The custom title capture should stop at newline (title is on same line as callout)
      const calloutMatch = paragraphText.match(/^\[!([\w-]+)\]([+\-]?)(?:[ \t]+([^\n]+))?/);
      
      if (!calloutMatch) return;
      
      const [fullMatch, calloutType, collapseState, customTitle] = calloutMatch;
      const calloutKey = resolveCalloutType(calloutType);
      const mapping = getCalloutMeta(calloutKey);
      
      // Get remaining text after the callout syntax
      const remainingText = paragraphText.slice(fullMatch.length).trim();
      const hasMultipleParagraphs = node.children.length > 1;
      
      // CRITICAL: Check if the FIRST text node starts with callout syntax followed by newline
      // This indicates the callout is on its own line, even if content follows in the same paragraph
      const firstTextNode = firstParagraph.children.find((child: any) => child.type === 'text') as Text | undefined;
      const firstTextValue = firstTextNode?.value || '';
      
      // Check if first text node starts with callout syntax followed by newline
      // Pattern: "[!example]\n" or "[!example] \n" (with optional space before newline)
      const calloutStartsOnOwnLine = firstTextValue.match(/^\[![\w-]+\][+\-]?\s*\n/);
      
      // The callout is on its own line if:
      // 1. Multiple paragraphs exist, OR
      // 2. First text node starts with callout syntax + newline (callout on own line, content follows), OR
      // 3. No remaining text (callout only)
      const isCalloutOnOwnLine = hasMultipleParagraphs || 
                                calloutStartsOnOwnLine !== null || 
                                remainingText.length === 0;
      
      // Single-line source-family split: `> [!type] attribution "quoted text"`.
      // Splits at the first straight double-quote in the marker-line text so
      // the attribution becomes the title and the quotation becomes real
      // body content instead of one giant small-caps title.
      //
      // NOTE: this deliberately checks `hasMultipleParagraphs` /
      // `calloutStartsOnOwnLine` directly rather than the composite
      // `isCalloutOnOwnLine`. That composite also flips true whenever
      // `remainingText` is empty — which is exactly the normal shape of a
      // genuine single-line quote callout (the whole marker line, including
      // the quote, is consumed into `customTitle`, leaving nothing after
      // it). Gating on `!isCalloutOnOwnLine` would make `doSplit` false for
      // the very case this feature targets, so the quote must live inside
      // `customTitle` itself (the marker-line text) rather than relying on
      // `remainingText`.
      const quoteOffset = paragraphText.indexOf('"');
      const doSplit = SPLIT_TYPES.has(calloutKey) && !!customTitle && customTitle.indexOf('"') >= 0 &&
        !hasMultipleParagraphs && !calloutStartsOnOwnLine;

      // Custom title on the [!type] line always wins; fall back to mapped title
      let calloutTitle = customTitle || mapping.title;
      if (doSplit) {
        const label = cleanSplitTitle(customTitle.slice(0, customTitle.indexOf('"')));
        calloutTitle = label || mapping.title;
      }

      // Determine if callout should be collapsible and its initial state
      const isCollapsible = collapseState === '+' || collapseState === '-';
      const isCollapsed = collapseState === '-';

      // Process the remaining content
      let contentChildren = [...node.children];

      // Handle content based on structure:
      // - Single-line source-family split: quoted part becomes the first body paragraph
      // - Multiple paragraphs: Remove first paragraph (callout line separate from content)
      // - Single paragraph, callout on own line (newline detected): Keep paragraph, remove callout syntax
      // - Single paragraph, callout only: Remove paragraph (no content)
      // - Single paragraph, callout with title on same line: Keep paragraph, remove callout syntax
      if (doSplit) {
        let bodyInline = sliceInlineChildrenFrom(firstParagraph.children, quoteOffset);
        if (calloutKey === 'quote') {
          bodyInline = stripWrappingQuotes(bodyInline);
        }
        contentChildren = [{ type: 'paragraph', children: bodyInline }, ...node.children.slice(1)];
      } else if (hasMultipleParagraphs) {
        // Multiple paragraphs - callout line is separate, remove first paragraph
        contentChildren = contentChildren.slice(1);
      } else if (calloutStartsOnOwnLine) {
        // Single paragraph but callout starts on its own line (has newline after callout)
        // Keep the paragraph but remove the callout syntax from the first text node
        if (firstTextNode) {
          // Remove callout syntax and newline from start of first text node
          const newlinePattern = /^\[![\w-]+\][+\-]?\s*\n\s*/;
          firstTextNode.value = firstTextNode.value.replace(newlinePattern, '');
        }
        // Keep the paragraph (contentChildren already has it)
      } else if (remainingText.length === 0) {
        // Single paragraph with only callout syntax - remove it
        contentChildren = contentChildren.slice(1);
      } else if (remainingText) {
        // Single paragraph with text after callout - remove callout syntax, keep the text
        const updateTextNode = (node: any): boolean => {
          if (node.type === 'text' && node.value) {
            const textValue = node.value as string;
            if (textValue.includes(fullMatch)) {
              const index = textValue.indexOf(fullMatch);
              const before = textValue.slice(0, index);
              const after = textValue.slice(index + fullMatch.length).trim();
              node.value = (before + (after ? ' ' + after : '')).trim();
              return true;
            }
          }
          if (node.children && Array.isArray(node.children)) {
            for (const child of node.children) {
              if (updateTextNode(child)) return true;
            }
          }
          return false;
        };
        updateTextNode(firstParagraph);
      }
      
      // Fold icon for collapsible callouts (matches aarnphm fold-callout-icon)
      const foldIcon = isCollapsible
        ? `<div class="fold-callout-icon" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg></div>`
        : '';

      // Transform the blockquote into a callout HTML structure
      const calloutHtml: any = {
        type: 'html',
        value: `<div class="callout${isCollapsible ? ' is-collapsible' : ''}${isCollapsed ? ' is-collapsed' : ''}" data-callout="${calloutKey}" data-callout-group="${getCalloutGroup(calloutKey)}">
          <div class="callout-title">
            ${getIconSVG(mapping.icon, mapping.iconType ?? 'lucide')}
            <div class="callout-title-inner"><span>${calloutTitle}</span></div>
            ${foldIcon}
          </div>
          <div class="callout-content"><div>`
      };

      const closeHtml: any = {
        type: 'html',
        value: '</div></div></div>'
      };
      
      // Replace the blockquote with the callout structure
      if (parent && typeof index === 'number') {
        parent.children.splice(index, 1, calloutHtml, ...contentChildren, closeHtml);
      }
    });
  };
};


export default remarkCallouts;