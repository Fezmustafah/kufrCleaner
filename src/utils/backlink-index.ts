import type { Post } from '@/types';
import { extractStandardLinks, extractWikilinks } from '@/utils/internallinks';

export interface LinkedMention {
  slug: string;
  title: string;
  excerpt?: string; // reserved — excerpts are not rendered anywhere today
}

export interface BacklinkIndex {
  mentionsOf(slug: string): LinkedMention[];
}

// Built ONCE per build: inverts every post's outgoing wikilinks + standard
// links into a target-slug -> [mentions] map. O(N) over the corpus, replacing
// the per-page full-corpus rescan in findLinkedMentions (O(N²)).
export function buildBacklinkIndex(posts: Post[]): BacklinkIndex {
  const map = new Map<string, LinkedMention[]>();
  for (const post of posts) {
    if (!post.body) continue;
    const links = [...extractWikilinks(post.body), ...extractStandardLinks(post.body)];
    const targets = new Set(links.map((link) => link.slug));
    for (const target of targets) {
      if (target === post.id) continue; // legacy behavior: self-links never count
      let mentions = map.get(target);
      if (!mentions) map.set(target, (mentions = []));
      mentions.push({ slug: post.id, title: post.data.title });
    }
  }
  return {
    mentionsOf(slug) {
      return map.get(slug) ?? [];
    },
  };
}

let cached: { key: string; index: BacklinkIndex } | null = null;

// Memoized accessor: Astro renders every page in one process, so the first
// page render builds the index and the rest reuse it. Keyed on a cheap corpus
// fingerprint so a dev-mode content change rebuilds it.
// ponytail: length fingerprint — a same-length body edit in dev serves stale
// backlinks until any other edit; hash the bodies if that ever matters.
export function getBacklinkIndex(posts: Post[]): BacklinkIndex {
  let bodyChars = 0;
  for (const post of posts) bodyChars += post.body?.length ?? 0;
  const key = `${posts.length}:${bodyChars}`;
  if (cached?.key !== key) {
    cached = { key, index: buildBacklinkIndex(posts) };
  }
  return cached.index;
}
