import { describe, expect, it } from 'vitest';
import { buildBacklinkIndex, getBacklinkIndex } from '@/utils/backlink-index';
import type { Post } from '@/types';

function post(id: string, title: string, body: string): Post {
  return { id, body, data: { title } } as unknown as Post;
}

// Fixture corpus exercising: wikilinks, standard links, folder-based /index
// links, multiple links to one target (one mention), self-links (excluded),
// and a post with no links.
const corpus = [
  post('alpha', 'Alpha Post', 'See [[beta]] and also [beta again](posts/beta.md).'),
  post('beta', 'Beta Post', 'Backlink to [[Alpha Post]] and [[alpha]].'),
  post('gamma', 'Gamma Post', 'No internal links here.'),
  post('delta', 'Delta Post', 'Folder link [b](posts/beta/index.md), self [[delta]].'),
];

describe('buildBacklinkIndex', () => {
  it('inverts outgoing links into per-target mentions in corpus order', () => {
    const index = buildBacklinkIndex(corpus);
    expect(index.mentionsOf('beta')).toEqual([
      { slug: 'alpha', title: 'Alpha Post' },
      { slug: 'delta', title: 'Delta Post' },
    ]);
  });

  it('emits one mention per source post regardless of link count', () => {
    const index = buildBacklinkIndex(corpus);
    expect(index.mentionsOf('alpha')).toEqual([{ slug: 'beta', title: 'Beta Post' }]);
  });

  it('excludes self-links and returns [] for unlinked or unknown slugs', () => {
    const index = buildBacklinkIndex(corpus);
    expect(index.mentionsOf('delta')).toEqual([]);
    expect(index.mentionsOf('gamma')).toEqual([]);
    expect(index.mentionsOf('does-not-exist')).toEqual([]);
  });

  it('skips posts without a body', () => {
    const index = buildBacklinkIndex([
      post('a', 'A', undefined as unknown as string),
      post('b', 'B', 'links [[a]]'),
    ]);
    expect(index.mentionsOf('a')).toEqual([{ slug: 'b', title: 'B' }]);
  });
});

describe('getBacklinkIndex memoization', () => {
  it('returns the same index instance for an unchanged corpus (builds once per build)', () => {
    const a = getBacklinkIndex(corpus);
    const b = getBacklinkIndex(corpus);
    expect(b).toBe(a);
  });

  it('rebuilds when the corpus changes (dev reload)', () => {
    const a = getBacklinkIndex(corpus);
    const changed = [...corpus, post('epsilon', 'Epsilon', 'links [[alpha]]')];
    const b = getBacklinkIndex(changed);
    expect(b).not.toBe(a);
    expect(b.mentionsOf('alpha')).toContainEqual({ slug: 'epsilon', title: 'Epsilon' });
  });
});
