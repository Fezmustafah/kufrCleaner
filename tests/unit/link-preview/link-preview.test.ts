import { describe, expect, it } from 'vitest';
import { extractPreviewHTML, isPreviewablePath } from '@/utils/link-preview';

const here = { origin: 'https://openislam.wiki', pathname: '/posts/current/' };

describe('isPreviewablePath', () => {
  const at = (p: string) => new URL(p, here.origin);

  it('accepts a same-origin content page', () => {
    expect(isPreviewablePath(at('/posts/tawhid/'), here)).toBe(true);
    expect(isPreviewablePath(at('/tags/kalam'), here)).toBe(true);
  });

  it('rejects the current page regardless of trailing slash', () => {
    expect(isPreviewablePath(at('/posts/current/'), here)).toBe(false);
    expect(isPreviewablePath(at('/posts/current'), here)).toBe(false);
  });

  it('rejects other origins', () => {
    expect(isPreviewablePath(new URL('https://example.com/posts/x/'), here)).toBe(false);
  });

  it('rejects asset URLs (last segment has an extension)', () => {
    expect(isPreviewablePath(at('/posts/tawhid/cover.png'), here)).toBe(false);
    expect(isPreviewablePath(at('/favicon.ico'), here)).toBe(false);
  });
});

function docFrom(body: string): Document {
  return new DOMParser().parseFromString(`<!doctype html><html><body>${body}</body></html>`, 'text/html');
}

describe('extractPreviewHTML', () => {
  it('returns null when there is no #post-content', () => {
    expect(extractPreviewHTML(docFrom('<main><p>hi</p></main>'))).toBeNull();
  });

  it('returns null when #post-content is effectively empty', () => {
    expect(extractPreviewHTML(docFrom('<div id="post-content">   </div>'))).toBeNull();
  });

  it('extracts inner HTML and strips footnotes + scripts', () => {
    const html = extractPreviewHTML(
      docFrom(`
        <div id="post-content">
          <p>Body text.</p>
          <script>evil()</script>
          <section class="footnotes"><li>note</li></section>
        </div>`)
    );
    expect(html).toContain('Body text.');
    expect(html).not.toContain('evil()');
    expect(html).not.toContain('footnotes');
  });

  it('neutralizes ids so the preview cannot collide with the live page', () => {
    const html = extractPreviewHTML(
      docFrom('<div id="post-content"><h2 id="intro">Intro</h2><p>x</p></div>')
    );
    expect(html).toContain('Intro');
    expect(html).not.toContain('id="intro"');
  });

  it('makes images lazy', () => {
    const html = extractPreviewHTML(
      docFrom('<div id="post-content"><img src="/a.png" alt="a"><p>x</p></div>')
    );
    expect(html).toContain('loading="lazy"');
  });
});
