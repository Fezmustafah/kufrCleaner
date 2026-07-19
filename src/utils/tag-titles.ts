// Curated tag display titles — maps a raw frontmatter tag slug to the title
// of its entry in the tags collection ("scientific-miracles" → "Scientific
// Miracles"). Links keep using the raw tag; this is presentation only.

import { getCollection } from 'astro:content';
import { topicSlug } from '@/utils/topics';

// ponytail: module-level cache — tags don't change mid-build; dev needs a
// server restart to pick up a renamed tag title.
let cache: Map<string, string> | null = null;

export async function getTagTitleMap(): Promise<Map<string, string>> {
  if (!cache) {
    const entries = await getCollection('tags').catch(() => []);
    cache = new Map(
      entries.filter((e) => e.data.title).map((e) => [e.id, e.data.title as string]),
    );
  }
  return cache;
}

/** Display title for a raw frontmatter tag; falls back to the raw value. */
export const tagTitle = (map: Map<string, string>, raw: string): string =>
  map.get(topicSlug(raw)) ?? raw;
