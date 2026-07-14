# Secondary architecture opportunities

This read-only scan excludes the Reading Deck runtime, its client entry point, homepage preview, and Reading Deck stylesheet. The required codebase-memory graph query was attempted first, but the MCP transport returned `Transport closed`; the evidence below therefore comes from direct, read-only repository inspection.

| Candidate | Evidence | Leverage | Locality problem | Recommended next step |
|---|---|---:|---|---|
| Base browser runtime | `src/layouts/BaseLayout.astro` is 2,209 lines and owns theme state, CSS variables, Twitter/Giscus integration, Swup hooks, sidebar state, image loading, smooth/hash scrolling, and global re-initialization. Several responsibilities expose globals on `window`. | Very high | Independent lifecycles and browser adapters share one inline-script scope, so a change to navigation or theming requires understanding unrelated integrations. | Separate design cycle. Define one small page-lifecycle registry, then extract theme, navigation/scroll, and third-party embeds as deep modules with idempotent `attach()/destroy()` seams. |
| Internal-link compiler | `src/utils/internallinks.ts` is 1,850 lines and combines parsing, slug/anchor rules, remark transforms, validation, backlinks, excerpts, HTML rewriting, folder images, and image captions. It also uses a module-global posts cache. | Very high | One file mixes multiple compilation stages and runtime-like cache state; link grammar decisions are duplicated across extraction and transformation paths. | Separate design cycle. First model a canonical `InternalLink` value and resolution result, then route remark, validation, backlinks, and HTML rewriting through one parser/resolver module. |
| Search experience | `src/scripts/search-client.ts` is 716 lines with one large `initSearch()` closure containing Pagefind loading, result hydration, filtering, selection, desktop preview, mobile sheet gestures, and rendering. `src/components/SearchPalette.astro` separately owns another search UI. | High | Search data semantics and two presentation modes are entangled; Pagefind result normalization cannot be tested independently from DOM state. | Brainstorm shared scope first. Extract a Pagefind gateway and pure result/filter model; keep desktop and mobile presentation behind one view module without forcing the palette and full page into identical UI. |
| Homepage composition | `src/pages/index.astro` is 982 lines and `src/components/PlatformShowcase.astro` is 950 lines. Content selection, structured data, feature configuration, and several visually distinct showcase sections live together. | Medium | Build-time content queries and presentation decisions cross component boundaries, making homepage changes require broad context. | Use a focused interface-design pass. Build a typed homepage view model in a server-side module, then let sections consume narrow data props; avoid a generic “section engine.” |
| Post layout assembly | `src/layouts/PostLayout.astro` is 726 lines and coordinates article metadata, Pagefind attributes, sidebars, TOC, marginalia, graph, navigation, and Reading Deck inputs. | Medium | Layout policy and feature assembly are centralized, while feature-specific prerequisites are inferred inline. | After BaseLayout work, define a typed post-page model and move feature eligibility/metadata derivation behind it. Preserve Astro composition rather than creating a client framework layer. |

## Recommended order

1. Base browser runtime: highest change surface and lifecycle risk.
2. Internal-link compiler: deepest build-time complexity and strongest testability payoff.
3. Search model: clear data/view seam with user-visible mobile risk.
4. Homepage and PostLayout assembly: useful, but lower urgency and easier after the first two establish project patterns.

Each candidate warrants its own brainstorming and behavioral-baseline phase. None should be folded into the Reading Deck refactor.
