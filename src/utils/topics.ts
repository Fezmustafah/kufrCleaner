/**
 * Topic helpers shared by the category and tag listing pages.
 *
 * Category/tag values live on post frontmatter as free text, while the matching
 * description/image entries live in the `categories`/`tags` collections, whose ids
 * are slugified by Astro's glob loader (github-slugger). So a post's raw value must
 * be slugified the same way before looking up its entry.
 */

// Deterministic slug matching Astro glob-loader ids
// (lowercase, runs of non-alphanumerics → single hyphen, trimmed).
export function topicSlug(name: string): string {
  return (name || '')
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
}

// Some raw category values need a friendlier display name than their bare
// frontmatter value — the author files Prophet Muhammad posts under just the
// honorific ligature "ﷺ". A categories-collection entry's `title` still wins.
const CATEGORY_DISPLAY: Record<string, string> = {
  'ﷺ': 'Prophet Muhammad ﷺ',
};

export function categoryDisplayName(name: string): string {
  return CATEGORY_DISPLAY[(name || '').trim()] || name;
}
