# ADR-0002: Bases feature gated off

**Status:** Accepted · 2026-07-16
**Context:** Plan `docs/superpowers/plans/2026-07-15-build-time-deepening.md`, Workstream 2.

## Decision

The Bases (JEXL query) feature is intentionally disabled via
`siteConfig.bases.enabled = false` (`// [CONFIG:BASES_ENABLED]` in `src/config.ts`).
When disabled: `remarkBases` is not registered in the remark pipeline (zero
per-post cost), `base/[...base].astro` returns an empty `getStaticPaths()`
(no `.base` directory scan, no routes), and `base/index.astro` skips its scan
and renders an empty state.

## What is preserved

All Bases source is kept: `src/utils/bases/**`, `src/components/base/**`,
`src/utils/remark-bases.ts`, and both route files. All `.base` files live in
the `src/content/` submodule and are untouched. Re-enabling is a one-line
config flip.

## Known defects parked behind the gate (deliberately NOT fixed)

1. **JEXL case-sensitivity mismatch** — `contains`/`startsWith`/`endsWith`
   are case-insensitive as JEXL globals but case-sensitive as `StringWrapper`
   methods (`src/utils/bases/`).
2. **Duplicate `slugifyPath`** — two implementations exist.

Both have zero blast radius while the flag is off. Fix them only if Bases is
re-enabled. Future architecture scans should not re-flag them while
`bases.enabled` is false — this ADR is the record.

## Consequences

- Removes one remark plugin from every post's pipeline and a recursive
  content-directory scan from every build.
- Verified before gating: zero published posts contain inline ```` ```base ````
  fences (checked 2026-07-15 and again at implementation time), so the change
  is user-invisible.
