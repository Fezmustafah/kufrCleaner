/**
 * Strips Markdown and Obsidian syntax, returning plain text for search indexing.
 * Used server-side in posts.json.ts and client-side in search.astro (via Vite bundle).
 */
export function cleanContent(raw: string): string {
  return raw
    .replace(/^---[\s\S]*?---\n?/, '')
    .replace(/!\[\[[^\]]*\]\]/g, '')
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)(.*?)\1/g, '$2')
    .replace(/^>\s?\[!\w+\][^\n]*/gm, '')
    .replace(/^>\s?/gm, '')
    .replace(/^[-*+]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * HTML-escapes a string. Safe for use with innerHTML.
 */
export function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * HTML-escapes text and wraps each query token in <mark> tags.
 * Handles multi-word queries and #tag prefix. Safe for innerHTML.
 */
export function highlight(text: string, query: string): string {
  if (!text) return '';
  const escaped = escapeHtml(text);
  if (!query) return escaped;
  const q = query.startsWith('#') ? query.slice(1) : query;
  if (!q.trim()) return escaped;
  const tokens = q.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return escaped;
  const pattern = tokens
    .map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|');
  return escaped.replace(
    new RegExp(`(${pattern})`, 'gi'),
    '<mark class="bg-highlight-300/40 dark:bg-highlight-500/30 rounded px-0.5 not-italic font-semibold">$1</mark>'
  );
}

/**
 * Returns the highest query-token-density window from pre-cleaned content.
 * content must already be plain text (run through cleanContent if from raw markdown).
 */
export function excerptAround(
  content: string,
  query: string,
  radius = 160
): { text: string; truncated: boolean } {
  if (!content) return { text: '', truncated: false };

  const windowSize = radius * 2;
  const q = query.startsWith('#') ? query.slice(1) : query;
  const tokens = q.trim().split(/\s+/).filter(t => t.length > 0).map(t => t.toLowerCase());

  if (tokens.length === 0 || content.length <= windowSize) {
    return { text: content.slice(0, windowSize), truncated: content.length > windowSize };
  }

  const lower = content.toLowerCase();
  let bestStart = 0;
  let bestScore = 0;
  const step = 20;

  for (let i = 0; i <= lower.length - windowSize; i += step) {
    const window = lower.slice(i, i + windowSize);
    const score = tokens.reduce((n, t) => n + (window.includes(t) ? 1 : 0), 0);
    if (score > bestScore) {
      bestScore = score;
      bestStart = i;
    }
  }

  if (bestScore === 0) {
    return { text: content.slice(0, windowSize), truncated: true };
  }

  const end = Math.min(content.length, bestStart + windowSize);
  return {
    text: (bestStart > 0 ? '…' : '') + content.slice(bestStart, end) + (end < content.length ? '…' : ''),
    truncated: content.length > windowSize,
  };
}
