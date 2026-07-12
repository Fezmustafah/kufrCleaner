// Shared tag-cloud item builder — extracted from /posts/tag/index.astro so the
// homepage Concepts section renders the SAME cloud (same titles, counts, URLs).

import { getCollection } from 'astro:content';
import { shouldShowPost, sortPostsByDate, extractTags } from '@/utils/markdown';
import { topicSlug } from '@/utils/topics';

export interface TagCloudItem {
  raw: string;
  count: number;
  title: string;
  url: string;
}

// Drop noise tags (empties + the "tag"/"untitled"/"test" placeholders)
const TAG_NOISE = new Set(['tag', 'untitled', 'test']);

// Display cleanup only: drop leading/trailing emoji, symbols and decorative
// brackets so e.g. "📜《in-bible》" shows as "in-bible". The link still uses the
// raw tag value, so counts and routing are unaffected.
const cleanTitle = (s: string) =>
  s.replace(/^[^\p{L}\p{N}]+/u, '').replace(/[^\p{L}\p{N}]+$/u, '').trim() || s.trim();

// Slug-shaped tags rendered at display size expose the taxonomy's seams
// (misspellings, joined words). These are presentation-only repairs — the
// real fix is renaming the tags in post frontmatter (content submodule).
const TITLE_FIXES: Record<string, string> = {
  quran: 'Quran',
  'quran-criticism': 'Quran criticism',
  scienctificfact: 'scientific fact',
  plagarismquran: 'Quran plagiarism',
  corruptionofbible: 'Bible corruption',
  distortedverses: 'distorted verses',
  'in-bible': 'in the Bible',
};

// "TextualCriticism" → "Textual Criticism", "Published_for_the_First_Time" →
// "Published for the First Time". Word-shaped tags pass through untouched.
const humanize = (s: string) =>
  TITLE_FIXES[s.toLowerCase()] ??
  s.replace(/[_-]+/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/\s+/g, ' ').trim();

export async function getTagCloudItems(isDev: boolean, baseUrl: string): Promise<TagCloudItem[]> {
  const allPosts = await getCollection('posts');
  const visiblePosts = sortPostsByDate(allPosts.filter((post) => shouldShowPost(post, isDev)));
  const allTags = extractTags(visiblePosts).filter((t) => {
    const s = t.trim();
    return s.length > 0 && !TAG_NOISE.has(s.toLowerCase());
  });

  // Optional title override from a tag entry (keyed by slug id)
  const tagEntries = await getCollection('tags').catch(() => []);
  const titleBySlug = new Map(tagEntries.map((e) => [e.id, e.data.title]));

  const items = allTags.map((tag) => {
    const count = visiblePosts.filter((post: any) => {
      const t = post.data.tags;
      if (!t) return false;
      return (Array.isArray(t) ? t : [t]).some(
        (x: any) => x && typeof x === 'string' && x.trim() === tag.trim(),
      );
    }).length;
    const curated = titleBySlug.get(topicSlug(tag));
    return {
      raw: tag,
      count,
      // Curated titles (tags collection) are used verbatim; raw tags get the
      // presentational repair pass.
      title: curated ? cleanTitle(curated) : humanize(cleanTitle(tag)),
      url: `${baseUrl}posts/tag/${encodeURIComponent(tag)}/`,
    };
  });

  // Merge case-variants ("Quran" + "quran") into one word: summed count,
  // linked to the more frequent variant. Until the tags are unified in
  // frontmatter that page only lists its own variant's posts — the lesser evil
  // vs. showing the same concept twice.
  const byKey = new Map<string, TagCloudItem>();
  for (const item of items) {
    const key = item.title.toLowerCase();
    const seen = byKey.get(key);
    if (!seen) byKey.set(key, item);
    else {
      const winner = item.count > seen.count ? item : seen;
      byKey.set(key, { ...winner, count: seen.count + item.count });
    }
  }
  return [...byKey.values()];
}
