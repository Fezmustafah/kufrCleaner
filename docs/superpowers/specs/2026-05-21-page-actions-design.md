# Design: Page Actions Bar

**Date:** 2026-05-21  
**Source plugin:** [starlight-page-actions](https://github.com/dlcastillop/starlight-page-actions)  
**Approach:** Option A — direct port as native component (no Starlight dependency)

---

## What it does

Adds a compact row of action buttons below the meta line in every post:

```
[Open in AI ▾]  [Share ▾]  [📋 Copy Markdown]
```

- **Open in AI** — dropdown linking to ChatGPT, Claude, Perplexity. Each passes the post URL in a prompt: `"Read {postUrl} and answer my questions about it."`
- **Share** — dropdown with X/Twitter, WhatsApp, Telegram, LinkedIn, Reddit, Facebook, Bluesky, Email, HackerNews
- **Copy Markdown** — button that fetches `/posts/{id}.md` and writes raw markdown to clipboard. Icon swaps copy → checkmark on success, resets after 2s

---

## Files

### New files

| File | Purpose |
|---|---|
| `src/components/PageActions.astro` | Main actions bar component |
| `src/components/PageActionsDropdown.astro` | Reusable dropdown (used by both Open + Share) |
| `src/pages/posts/[...id].md.ts` | Static route serving raw markdown at `/posts/{id}.md` |

### Modified files

| File | Change |
|---|---|
| `src/layouts/PostLayout.astro` | Add `<PageActions>` below meta line, inside `<header>` |
| `src/styles/global.css` | No change needed — styles scoped inside components |

---

## Component: `PageActions.astro`

### Props
```ts
interface Props {
  postId:    string   // post.id — used for /posts/{id}.md URL
  postTitle: string   // post.data.title — URL-encoded for share links
  postUrl:   string   // Astro.url.href — canonical URL
}
```

### Template structure
```html
<div class="page-actions" data-pagefind-ignore>
  <PageActionsDropdown id="open"  label="Open in AI" items={openItems} />
  <PageActionsDropdown id="share" label="Share"      items={shareItems} />
  <button class="pa-copy-btn" data-md-path="/posts/{postId}.md" aria-label="Copy Markdown">
    <!-- copy icon (default) / check icon (success) -->
    Copy Markdown
  </button>
</div>
```

### Open in AI items (built at render time)
```ts
const prompt = encodeURIComponent(`Read ${postUrl} and answer my questions about it.`);
const openItems = [
  { label: 'Open in ChatGPT',  href: `https://chatgpt.com/?q=${prompt}` },
  { label: 'Open in Claude',   href: `https://claude.ai/new?q=${prompt}` },
  { label: 'Open in Perplexity', href: `https://perplexity.ai/?q=${prompt}` },
]
```

### Share items (built at render time)
```ts
const url   = encodeURIComponent(postUrl);
const title = encodeURIComponent(postTitle);
const shareItems = [
  { label: 'Share on X',          href: `https://x.com/intent/tweet?url=${url}&text=${title}` },
  { label: 'Share on WhatsApp',   href: `https://wa.me/?text=${title}%20${url}` },
  { label: 'Share on Telegram',   href: `https://t.me/share/url?url=${url}&text=${title}` },
  { label: 'Share on LinkedIn',   href: `https://www.linkedin.com/sharing/share-offsite/?url=${url}` },
  { label: 'Share on Reddit',     href: `https://reddit.com/submit?url=${url}&title=${title}` },
  { label: 'Share on Facebook',   href: `https://www.facebook.com/sharer/sharer.php?u=${url}` },
  { label: 'Share on Bluesky',    href: `https://bsky.app/intent/compose?text=${title}%20${url}` },
  { label: 'Share via Email',     href: `mailto:?subject=${title}&body=${url}` },
  { label: 'Share on Hacker News',href: `https://news.ycombinator.com/submitlink?u=${url}&t=${title}` },
]
```

### Copy Markdown script
```ts
// Registered as window.initializePageActions for Swup re-init
function initializePageActions() {
  const btn = document.querySelector('.pa-copy-btn');
  if (!btn) return;
  const fresh = btn.cloneNode(true) as HTMLButtonElement;
  btn.parentNode?.replaceChild(fresh, btn);
  
  fresh.addEventListener('click', async () => {
    const mdPath = fresh.dataset.mdPath;
    try {
      const res = await fetch(mdPath);
      if (!res.ok) throw new Error('fetch failed');
      const text = await res.text();
      await navigator.clipboard.writeText(text);
      // swap to success icon, reset after 2s
      fresh.classList.add('pa-copy-success');
      setTimeout(() => fresh.classList.remove('pa-copy-success'), 2000);
    } catch {
      // silently fail — clipboard API may be unavailable
    }
  });
}
window.initializePageActions = initializePageActions;
document.addEventListener('DOMContentLoaded', initializePageActions);
```

---

## Component: `PageActionsDropdown.astro`

### Props
```ts
interface Props {
  id:    string                            // "open" | "share" — unique per page
  label: string
  items: { label: string; href: string }[]
  align?: 'left' | 'right'               // default 'left'; Share uses 'right'
}
```

### Template structure
```html
<div class="pa-dropdown" id="pa-dropdown-{id}">
  <button class="pa-btn pa-dropdown-toggle">
    {label} <Icon name="chevron-down" />
  </button>
  <div class="pa-dropdown-menu pa-dropdown-menu--{align}">
    {items.map(item => (
      <a href={item.href} target="_blank" rel="noopener noreferrer" class="pa-dropdown-item">
        {item.label}
        <Icon name="external-link" />
      </a>
    ))}
  </div>
</div>
```

### Dropdown JS (inline `<script>`)
Handles toggle open/close on button click. Closes all dropdowns on outside click. IDs used for isolation so both dropdowns can coexist on the same page without interfering. Registered as `window.initializePageActionDropdowns` for Swup re-init.

---

## API Route: `/posts/[...id].md.ts`

```ts
// src/pages/posts/[...id].md.ts
import type { APIRoute, GetStaticPaths } from 'astro';
import { getCollection } from 'astro:content';

export const getStaticPaths: GetStaticPaths = async () => {
  const posts = await getCollection('posts');
  return posts.map(post => ({
    params: { id: post.id },
    props: { body: post.body ?? '' },
  }));
};

export const GET: APIRoute = ({ props }) => {
  return new Response(props.body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
```

> `post.body` is the raw markdown string from Astro's content layer. It includes frontmatter — the Copy Markdown button copies the full file including frontmatter.

---

## PostLayout integration

Add inside `<header class="mb-8">`, after the closing `</div>` of the meta line:

```astro
<!-- Page actions bar -->
<PageActions
  postId={post.id}
  postTitle={post.data.title}
  postUrl={Astro.url.href}
/>
```

Add `data-pagefind-ignore` to the actions container so Pagefind doesn't index button labels.

---

## Styling

All colours use CSS custom properties — no hardcoded values.

### Button (`.pa-btn`)
```css
background-color: rgb(var(--color-primary-100) / 1);
color:            rgb(var(--color-primary-700) / 1);
border:           1px solid rgb(var(--color-primary-200) / 1);
/* dark */
.dark .pa-btn { bg: primary-800; color: primary-200; border: primary-700 }

hover: bg → primary-200 / dark: primary-700
height: 2rem; font-size: 0.8125rem; border-radius: 0.375rem;
padding: 0.375rem 0.75rem; gap: 0.375rem;
```

### Copy success state (`.pa-copy-success`)
```css
color: rgb(var(--color-highlight-500) / 1);
border-color: rgb(var(--color-highlight-300) / 1);
```

### Dropdown menu (`.pa-dropdown-menu`)
```css
background: rgb(var(--color-primary-50) / 1);   /* dark: primary-900 */
border: 1px solid rgb(var(--color-primary-200)); /* dark: primary-700 */
box-shadow: 0 4px 6px -1px rgba(0,0,0,0.15);
min-width: 200px;
```

Alignment: `--left` variant anchors to left edge of toggle button; `--right` variant anchors to right edge (used for Share to prevent right-viewport overflow).

---

## Swup re-initialization

Both the dropdown toggles and copy button need re-init on navigation.

In `BaseLayout.astro`, add to the `page:view` hook:
```js
window.initializePageActions?.();
window.initializePageActionDropdowns?.();
```

These functions are defined in `<script>` blocks inside the respective components and attached to `window`.

---

## Spec Self-Review

1. **Placeholders**: None. All URL patterns, class names, prop names are explicit. ✅
2. **Consistency**: `pageActions` init function names match between component scripts and BaseLayout hook. `data-md-path` attribute matches what the API route serves. ✅
3. **Scope**: One clear feature, 3 new files + 1 layout edit. No scope creep. ✅
4. **Ambiguity**: `post.body` in Astro v6 content layer returns the raw markdown string including frontmatter — this is correct for the Copy Markdown feature. The `[...id].md.ts` route uses spread params to handle nested IDs (e.g. `folder/post` → `/posts/folder/post.md`). ✅
