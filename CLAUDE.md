# CLAUDE.md — Astro Modular (kufrCleaner)

> **Primary reference**: [`AGENTS.md`](AGENTS.md) contains exhaustive technical docs. Read its critical sections before making any changes.

## Project

Astro 6 blog theme designed around Obsidian as a CMS. Version 0.8.6. MIT license.

**Stack**: Astro 6 · TypeScript · Tailwind CSS 3 · MDX · Swup · Fuse.js · Sharp · KaTeX · Mermaid · D3

**Package manager**: pnpm (requires pnpm 10.29.3+, Node 24.13.0+)

**Deployment targets**: Netlify, Vercel, Cloudflare Workers, GitHub Pages (configured in `src/config.ts`)

## Critical Rules (do not violate)

1. **Use `entry.id`, never `entry.slug`** — `slug` is removed in Astro v6 and returns `undefined`. All API routes and URL generation must use `entry.id`.
2. **Never edit `src/content/**/*.md` files** without explicit user permission. Content is user-authored.
3. **Swup page transitions break JS** — any interactive element added must re-initialize on Swup's `page:view` event. See AGENTS.md for the pattern.
4. **Never disable `devToolbar.enabled: true`** in `astro.config.mjs` — it will cause module loading errors.
5. **No `console.log()` in production code** — gate logging behind `import.meta.env.DEV`.
6. **Math rendering**: CSS must hide `.math-inline .katex-html` and `.math-display .katex-html` to prevent duplication.
7. **Plugin order matters** — remark plugins run sequentially; changing order breaks embed/callout handling.

## Key Files

| File | Purpose |
|---|---|
| `src/config.ts` | All site configuration (theme, layout, nav, features) |
| `src/content.config.ts` | Content collection schemas (posts, pages, projects, docs, special) |
| `astro.config.mjs` | Astro integrations, CSP headers, remark/rehype plugin chain |
| `tailwind.config.mjs` | Theme colors (CSS vars), typography, dark mode |
| `src/types.ts` | Shared TypeScript types |
| `src/utils/internallinks.ts` | Wikilink/folder image resolution |
| `src/utils/remark-*.ts` | Custom remark plugins (callouts, embeds, mermaid, etc.) |
| `src/utils/rehype-*.ts` | Custom rehype plugins (anchors, image attrs, mark) |
| `src/utils/seo.ts` | SEO/OG metadata helpers |
| `src/utils/images.ts` | Image processing utilities |
| `scripts/` | Build-time Node scripts (image sync, alias processing, graph data) |

## Path Aliases

```
@/          → src/
@/components → src/components/
@/layouts   → src/layouts/
@/utils     → src/utils/
@/types     → src/types.ts
@/config    → src/config.ts
```

## Content Collections

All use glob loaders (Astro Content Layer). IDs are derived from filename/path.

- `posts` — blog articles (`src/content/posts/`)
- `pages` — static pages (`src/content/pages/`)
- `projects` — project showcase (`src/content/projects/`)
- `docs` — documentation (`src/content/docs/`)
- `special` — homepage & special pages (`src/content/special/`)

Folder-based posts: a post at `src/content/posts/my-post/index.md` gets `id = "my-post"` (not `"my-post/index"`).

## Dev Workflow

```bash
pnpm dev       # sync images → process aliases → gen configs/graph → dev server (port 5000)
pnpm build     # same pipeline then Astro build
pnpm preview   # build then preview
```

## Markdown Processing Pipeline

Remark plugins (in order): internal links → folder images → callouts → image grids → mermaid → Obsidian embeds → bases → inline tags → comments → image size → math → reading time → TOC → line breaks

Rehype plugins (in order): KaTeX → mark → image attributes → slug → autolink headings → anchor normalization

Shiki syntax theme: `github-dark`

## Themes

15+ built-in themes in `src/themes/`. Custom themes go in `src/themes/custom/`. Theme selection and font families are set in `src/config.ts`. Colors are CSS custom properties consumed by Tailwind.

## Image System

Two separate systems:
- **Post card images** — frontmatter `image` field, rendered in listing pages
- **Post content images** — processed by remark plugins, supports Obsidian syntax (`![[image.png|caption|500]]`)

Images sync from `src/content/` to `public/` via `scripts/sync-images.js` at dev/build time.

## API Routes

Static JSON endpoints at `src/pages/api/`:
- `posts.json.ts`, `pages.json.ts`, `projects.json.ts`, `docs.json.ts` — collection data for command palette/search
- `files.json.ts` — file listing for graph view
- `og-image.ts` — Open Graph image generation

All use `entry.id` (not `entry.slug`).
