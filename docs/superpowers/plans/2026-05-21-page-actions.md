# Page Actions Bar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a compact row of action buttons (Open in AI, Share, Copy Markdown) below the meta line on every post page.

**Architecture:** Four self-contained changes — a raw-markdown API route, a reusable dropdown component, the main PageActions component, and wiring into PostLayout + BaseLayout's Swup hook. No external dependencies beyond what's already installed.

**Tech Stack:** Astro 6 · TypeScript · Tailwind CSS (CSS custom properties) · Astro content layer (`post.body`) · Clipboard API · Swup `page:view` re-init pattern

---

## File Map

| Status | File | Change |
|---|---|---|
| **Create** | `src/pages/posts/[...id].md.ts` | Static API route — serves raw markdown per post |
| **Create** | `src/components/PageActionsDropdown.astro` | Reusable dropdown (toggle + menu + items) |
| **Create** | `src/components/PageActions.astro` | Actions bar — Open in AI, Share, Copy Markdown |
| **Modify** | `src/layouts/PostLayout.astro` | Add `<PageActions>` between meta line and `</header>` |
| **Modify** | `src/layouts/BaseLayout.astro` | Add `initializePageActions` to `page:view` safe() block |

---

## Task 1: Raw Markdown API Route

**Files:**
- Create: `src/pages/posts/[...id].md.ts`

- [ ] **Step 1: Create the file**

```typescript
// src/pages/posts/[...id].md.ts
import type { APIRoute, GetStaticPaths } from 'astro';
import { getCollection } from 'astro:content';

export const getStaticPaths: GetStaticPaths = async () => {
  const posts = await getCollection('posts');
  return posts.map((post) => ({
    params: { id: post.id },
    props: { body: post.body ?? '' },
  }));
};

export const GET: APIRoute = ({ props }) => {
  return new Response(props.body as string, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
```

- [ ] **Step 2: Verify it builds without errors**

```bash
cd c:/Users/user1/Documents/GitHub/kufrCleaner
pnpm build 2>&1 | tail -20
```

Expected: Build completes. No TypeScript errors. Static files like `/posts/my-post.md` appear in `dist/posts/`.

- [ ] **Step 3: Spot-check a generated file**

```bash
ls dist/posts/ | head -5
# Pick any post slug from the output, e.g. "my-post"
cat "dist/posts/my-post.md"
```

Expected: Raw markdown content starting with `---` frontmatter, then the post body.

- [ ] **Step 4: Commit**

```bash
git add src/pages/posts/\[...id\].md.ts
git commit -m "feat: add raw markdown endpoint at /posts/{id}.md"
```

---

## Task 2: Dropdown Component

**Files:**
- Create: `src/components/PageActionsDropdown.astro`

- [ ] **Step 1: Create the component**

```astro
---
// src/components/PageActionsDropdown.astro
import Icon from '@/components/Icon.astro';

interface Item {
  label: string;
  href: string;
}

interface Props {
  id: string;              // unique per page: "open" | "share"
  label: string;
  items: Item[];
  align?: 'left' | 'right'; // which edge to anchor the menu to (default: 'left')
}

const { id, label, items, align = 'left' } = Astro.props;
const menuId = `pa-menu-${id}`;
const toggleId = `pa-toggle-${id}`;
---

<div class="pa-dropdown" data-dropdown-id={id}>
  <button
    id={toggleId}
    class="pa-btn pa-dropdown-toggle"
    aria-haspopup="true"
    aria-expanded="false"
    aria-controls={menuId}
    type="button"
  >
    <span>{label}</span>
    <Icon name="chevron-down" class="pa-chevron w-3 h-3" />
  </button>

  <div
    id={menuId}
    class:list={['pa-dropdown-menu', align === 'right' && 'pa-dropdown-menu--right']}
    role="menu"
  >
    {items.map((item) => (
      <a
        href={item.href}
        target="_blank"
        rel="noopener noreferrer"
        class="pa-dropdown-item"
        role="menuitem"
      >
        <span>{item.label}</span>
        <Icon name="external-link" class="w-3 h-3 opacity-50 shrink-0" />
      </a>
    ))}
  </div>
</div>

<style>
  .pa-dropdown {
    position: relative;
  }

  .pa-dropdown-menu {
    display: none;
    position: absolute;
    top: calc(100% + 0.375rem);
    left: 0;
    z-index: 50;
    min-width: 200px;
    padding: 0.25rem;
    border-radius: 0.5rem;
    background-color: rgb(var(--color-primary-50) / 1);
    border: 1px solid rgb(var(--color-primary-200) / 1);
    box-shadow: 0 4px 12px -2px rgba(0, 0, 0, 0.12), 0 2px 4px -1px rgba(0, 0, 0, 0.08);
  }

  :global(.dark) .pa-dropdown-menu {
    background-color: rgb(var(--color-primary-900) / 1);
    border-color: rgb(var(--color-primary-700) / 1);
    box-shadow: 0 4px 12px -2px rgba(0, 0, 0, 0.4), 0 2px 4px -1px rgba(0, 0, 0, 0.3);
  }

  .pa-dropdown-menu--right {
    left: auto;
    right: 0;
  }

  .pa-dropdown-menu.is-open {
    display: block;
  }

  .pa-dropdown-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.4rem 0.625rem;
    border-radius: 0.375rem;
    font-size: 0.8125rem;
    color: rgb(var(--color-primary-700) / 1);
    text-decoration: none;
    transition: background-color 0.1s ease;
    cursor: pointer;
  }

  :global(.dark) .pa-dropdown-item {
    color: rgb(var(--color-primary-200) / 1);
  }

  .pa-dropdown-item:hover {
    background-color: rgb(var(--color-primary-100) / 1);
  }

  :global(.dark) .pa-dropdown-item:hover {
    background-color: rgb(var(--color-primary-800) / 1);
  }

  .pa-dropdown-item span {
    flex: 1;
  }

  /* Rotate chevron when open */
  .pa-dropdown-toggle[aria-expanded="true"] .pa-chevron {
    transform: rotate(180deg);
  }

  .pa-chevron {
    transition: transform 0.15s ease;
  }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/PageActionsDropdown.astro
git commit -m "feat: add PageActionsDropdown reusable component"
```

---

## Task 3: PageActions Component

**Files:**
- Create: `src/components/PageActions.astro`

- [ ] **Step 1: Create the component**

```astro
---
// src/components/PageActions.astro
import Icon from '@/components/Icon.astro';
import PageActionsDropdown from '@/components/PageActionsDropdown.astro';

interface Props {
  postId: string;    // post.id — used to build /posts/{id}.md URL
  postTitle: string; // post.data.title — URL-encoded for share links
  postUrl: string;   // Astro.url.href — full canonical URL
}

const { postId, postTitle, postUrl } = Astro.props;

const prompt = encodeURIComponent(`Read ${postUrl} and answer my questions about it.`);
const encodedUrl = encodeURIComponent(postUrl);
const encodedTitle = encodeURIComponent(postTitle);

const openItems = [
  { label: 'Open in ChatGPT',   href: `https://chatgpt.com/?q=${prompt}` },
  { label: 'Open in Claude',    href: `https://claude.ai/new?q=${prompt}` },
  { label: 'Open in Perplexity',href: `https://perplexity.ai/?q=${prompt}` },
];

const shareItems = [
  { label: 'Share on X',           href: `https://x.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}` },
  { label: 'Share on WhatsApp',    href: `https://wa.me/?text=${encodedTitle}%20${encodedUrl}` },
  { label: 'Share on Telegram',    href: `https://t.me/share/url?url=${encodedUrl}&text=${encodedTitle}` },
  { label: 'Share on LinkedIn',    href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}` },
  { label: 'Share on Reddit',      href: `https://reddit.com/submit?url=${encodedUrl}&title=${encodedTitle}` },
  { label: 'Share on Facebook',    href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}` },
  { label: 'Share on Bluesky',     href: `https://bsky.app/intent/compose?text=${encodedTitle}%20${encodedUrl}` },
  { label: 'Share via Email',      href: `mailto:?subject=${encodedTitle}&body=${encodedUrl}` },
  { label: 'Share on Hacker News', href: `https://news.ycombinator.com/submitlink?u=${encodedUrl}&t=${encodedTitle}` },
];

const mdPath = `/posts/${postId}.md`;
---

<div class="page-actions" data-pagefind-ignore>
  <PageActionsDropdown id="open"  label="Open in AI" items={openItems} align="left" />
  <PageActionsDropdown id="share" label="Share"       items={shareItems} align="right" />

  <button
    class="pa-btn pa-copy-btn"
    data-md-path={mdPath}
    aria-label="Copy raw Markdown to clipboard"
    type="button"
  >
    <span class="pa-copy-icon">
      <Icon name="clipboard" class="w-3.5 h-3.5" />
    </span>
    <span class="pa-check-icon" aria-hidden="true" style="display:none">
      <Icon name="check" class="w-3.5 h-3.5" />
    </span>
    <span class="pa-copy-label">Copy Markdown</span>
  </button>
</div>

<style>
  .page-actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-end;
    gap: 0.375rem;
    margin-top: 0.75rem;
  }

  /* Shared button style — used by both the toggle buttons and the copy button */
  :global(.pa-btn) {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    height: 2rem;
    padding: 0 0.625rem;
    border-radius: 0.375rem;
    border: 1px solid rgb(var(--color-primary-200) / 1);
    background-color: rgb(var(--color-primary-100) / 0.6);
    color: rgb(var(--color-primary-600) / 1);
    font-size: 0.8125rem;
    font-weight: 500;
    line-height: 1;
    cursor: pointer;
    white-space: nowrap;
    transition: background-color 0.1s ease, border-color 0.1s ease, color 0.1s ease;
    text-decoration: none;
  }

  :global(.dark .pa-btn) {
    border-color: rgb(var(--color-primary-700) / 1);
    background-color: rgb(var(--color-primary-800) / 0.6);
    color: rgb(var(--color-primary-300) / 1);
  }

  :global(.pa-btn:hover) {
    background-color: rgb(var(--color-primary-200) / 1);
    border-color: rgb(var(--color-primary-300) / 1);
    color: rgb(var(--color-primary-700) / 1);
  }

  :global(.dark .pa-btn:hover) {
    background-color: rgb(var(--color-primary-700) / 1);
    border-color: rgb(var(--color-primary-600) / 1);
    color: rgb(var(--color-primary-100) / 1);
  }

  /* Copy success state */
  :global(.pa-copy-btn.is-copied) {
    color: rgb(var(--color-highlight-600) / 1);
    border-color: rgb(var(--color-highlight-300) / 1);
    background-color: rgb(var(--color-highlight-50) / 0.5);
  }

  :global(.dark .pa-copy-btn.is-copied) {
    color: rgb(var(--color-highlight-400) / 1);
    border-color: rgb(var(--color-highlight-700) / 1);
    background-color: rgb(var(--color-highlight-900) / 0.3);
  }
</style>

<script>
  function initializePageActions() {
    const btn = document.querySelector<HTMLButtonElement>('.pa-copy-btn');
    if (!btn) return;

    // Clone to strip stale listeners from previous Swup navigation
    const fresh = btn.cloneNode(true) as HTMLButtonElement;
    btn.parentNode?.replaceChild(fresh, btn);

    const copyIcon  = fresh.querySelector<HTMLElement>('.pa-copy-icon');
    const checkIcon = fresh.querySelector<HTMLElement>('.pa-check-icon');
    const label     = fresh.querySelector<HTMLElement>('.pa-copy-label');

    let resetTimer: ReturnType<typeof setTimeout> | null = null;

    fresh.addEventListener('click', async () => {
      const mdPath = fresh.dataset.mdPath;
      if (!mdPath) return;

      try {
        const res = await fetch(mdPath);
        if (!res.ok) throw new Error(`fetch ${mdPath} → ${res.status}`);
        const text = await res.text();
        await navigator.clipboard.writeText(text);

        // Success state
        fresh.classList.add('is-copied');
        if (copyIcon)  copyIcon.style.display  = 'none';
        if (checkIcon) checkIcon.style.display = '';
        if (label)     label.textContent = 'Copied!';

        if (resetTimer) clearTimeout(resetTimer);
        resetTimer = setTimeout(() => {
          fresh.classList.remove('is-copied');
          if (copyIcon)  copyIcon.style.display  = '';
          if (checkIcon) checkIcon.style.display = 'none';
          if (label)     label.textContent = 'Copy Markdown';
          resetTimer = null;
        }, 2000);
      } catch (err) {
        if (import.meta.env.DEV) console.warn('[PageActions] copy failed:', err);
      }
    });
  }

  function initializePageActionDropdowns() {
    const allDropdowns = document.querySelectorAll<HTMLElement>('.pa-dropdown');

    allDropdowns.forEach((dropdown) => {
      const dropdownId = dropdown.dataset.dropdownId!;
      const toggle = dropdown.querySelector<HTMLButtonElement>(`#pa-toggle-${dropdownId}`);
      const menu   = dropdown.querySelector<HTMLElement>(`#pa-menu-${dropdownId}`);
      if (!toggle || !menu) return;

      // Clone toggle to strip stale listeners
      const freshToggle = toggle.cloneNode(true) as HTMLButtonElement;
      toggle.parentNode?.replaceChild(freshToggle, toggle);

      freshToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = menu.classList.contains('is-open');
        // Close all dropdowns first
        document.querySelectorAll('.pa-dropdown-menu').forEach((m) =>
          m.classList.remove('is-open')
        );
        document.querySelectorAll('.pa-dropdown-toggle').forEach((t) =>
          (t as HTMLButtonElement).setAttribute('aria-expanded', 'false')
        );
        // Toggle this one
        if (!isOpen) {
          menu.classList.add('is-open');
          freshToggle.setAttribute('aria-expanded', 'true');
        }
      });
    });

    // Close all on outside click
    document.addEventListener('click', () => {
      document.querySelectorAll('.pa-dropdown-menu').forEach((m) =>
        m.classList.remove('is-open')
      );
      document.querySelectorAll('.pa-dropdown-toggle').forEach((t) =>
        (t as HTMLButtonElement).setAttribute('aria-expanded', 'false')
      );
    });
  }

  // Expose for Swup re-init
  (window as any).initializePageActions = initializePageActions;
  (window as any).initializePageActionDropdowns = initializePageActionDropdowns;

  // Initial page load
  document.addEventListener('DOMContentLoaded', () => {
    initializePageActions();
    initializePageActionDropdowns();
  });
</script>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/PageActions.astro src/components/PageActionsDropdown.astro
git commit -m "feat: add PageActions component (Open in AI, Share, Copy Markdown)"
```

---

## Task 4: Wire into PostLayout + BaseLayout

**Files:**
- Modify: `src/layouts/PostLayout.astro`
- Modify: `src/layouts/BaseLayout.astro`

- [ ] **Step 1: Read PostLayout to confirm insertion point**

Open `src/layouts/PostLayout.astro`. Find this block (around line 193):

```astro
            </div>
          </header>
```

That `</div>` closes the meta line (`flex flex-wrap items-center gap-x-2`). `</header>` is the next line.

- [ ] **Step 2: Add PageActions import to PostLayout**

At the top of `src/layouts/PostLayout.astro`, find the existing imports block. Add:

```astro
import PageActions from '@/components/PageActions.astro';
```

Place it after the other component imports (e.g. after `import LinkedMentions`).

- [ ] **Step 3: Add PageActions element in PostLayout**

Find this exact string in `src/layouts/PostLayout.astro`:

```astro
            </div>
          </header>

        <!-- Article content -->
```

Replace with:

```astro
            </div>

            <!-- Page action buttons: Open in AI · Share · Copy Markdown -->
            <PageActions
              postId={post.id}
              postTitle={post.data.title}
              postUrl={Astro.url.href}
            />
          </header>

        <!-- Article content -->
```

- [ ] **Step 4: Add Swup re-init calls in BaseLayout**

Open `src/layouts/BaseLayout.astro`. Find this block (around line 1522):

```javascript
      safe(function () { if (window._annRun) window._annRun(); });
```

Add two lines directly after it:

```javascript
      safe(function () { if (window._annRun) window._annRun(); });
      safe(() => window.initializePageActions?.());
      safe(() => window.initializePageActionDropdowns?.());
```

- [ ] **Step 5: Build and verify no TypeScript errors**

```bash
cd c:/Users/user1/Documents/GitHub/kufrCleaner
pnpm build 2>&1 | grep -E "error|Error|warning|Warning" | head -20
```

Expected: No TypeScript errors. Build completes successfully.

- [ ] **Step 6: Run dev server and manually verify**

```bash
pnpm dev
```

Open any post page in the browser. Check:

1. The actions bar appears below the date · read time · tags row, right-aligned
2. "Open in AI" dropdown opens on click, shows ChatGPT / Claude / Perplexity links, each opens in a new tab with the correct URL
3. "Share" dropdown opens on click, shows all 9 platforms, each opens in a new tab with the correct URL
4. Clicking outside either dropdown closes it
5. "Copy Markdown" button: click → icon swaps to check, label becomes "Copied!", reverts after 2 seconds
6. Navigate to another post (Swup transition) — actions bar still works on the new page
7. Check browser console for errors

- [ ] **Step 7: Verify the raw markdown endpoint**

In the browser, navigate to `/posts/{any-post-id}.md` (replace with a real post ID from your site).

Expected: Raw markdown text is served, starting with `---` frontmatter.

- [ ] **Step 8: Commit**

```bash
git add src/layouts/PostLayout.astro src/layouts/BaseLayout.astro
git commit -m "feat: wire PageActions into PostLayout and BaseLayout Swup hook"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task |
|---|---|
| "Copy Markdown" button — fetches `/posts/{id}.md`, copies to clipboard, icon swap | Task 3 |
| Raw markdown endpoint at `/posts/{id}.md` | Task 1 |
| "Open in AI" dropdown — ChatGPT, Claude, Perplexity with prompt | Task 3 |
| "Share" dropdown — 9 platforms | Task 3 |
| Placement: below meta line, right-aligned | Task 4 |
| Swup re-init — `initializePageActions` + `initializePageActionDropdowns` | Task 3 + Task 4 |
| `data-pagefind-ignore` on actions container | Task 3 |
| Dropdown reusable component | Task 2 |
| Theming via CSS custom properties, no hardcoded colours | Task 2 + 3 |
| Clipboard API graceful failure | Task 3 |
| `align="right"` on Share to prevent viewport overflow | Task 4 |

**Placeholder scan:** No TBD / TODO / "similar to" references. All code blocks are complete. ✅

**Type consistency:**
- `initializePageActions` defined in Task 3 script, called in Task 4 BaseLayout hook ✅
- `initializePageActionDropdowns` defined in Task 3 script, called in Task 4 BaseLayout hook ✅
- `PageActions` props `postId / postTitle / postUrl` defined in Task 3 interface, passed in Task 4 ✅
- `PageActionsDropdown` props `id / label / items / align` defined in Task 2, used in Task 3 ✅
- `pa-dropdown` / `pa-toggle-{id}` / `pa-menu-{id}` selectors consistent between Task 2 HTML and Task 3 script ✅
- `.pa-copy-btn` / `.is-copied` / `.pa-copy-icon` / `.pa-check-icon` classes consistent in Task 3 style + script ✅
