---
name: margin-apparatus
description: Use when writing or editing post content that needs asides, sources, or evidence — decides between marginalia {{...}}, footnotes [^n], and citations [@key], and gives the exact syntax and semantic rules for each.
---

# Margin apparatus: marginalia vs footnotes vs citations

Three separate systems. The hard part is choosing, not the syntax.

## The decision

| You want to add… | Use | Renders as |
|---|---|---|
| A source already in `_refs.bib` | `[@key]` citation | Inline author-year link |
| Numbered evidence: a source, quotation, manuscript reading, precise claim backup | `[^n]` footnote | Superscript number → separated FOOTNOTES section at the bottom, hover-peek popover |
| An aside: qualification, wry commentary, "by the way" context, a tangent | `{{margin note}}` | ▪ marker with the note floating in the page margin |

Rule of thumb: **numbers are evidence, ▪ is voice.** If deleting it would weaken the argument, it's a footnote. If deleting it would only make the post less interesting, it's a margin note.

## Marginalia syntax

Two forms:

```markdown
Bare form: some running text.{{The note. A small ▪ appears in the text as the marker.}}

Labeled form: the layout engine must {{sidenotes[choose]: The word "choose" in the
running text becomes the anchor — gold-underlined, with a small ▪ after it.}} carefully.
```

- **Prefer the labeled form** when the note is *about* specific words in the sentence — the anchor words must be the thing the note comments on, never arbitrary words that happen to sit there. Use the bare form for notes attached to a whole sentence or clause.
- Inline markdown works inside notes: `**bold**`, `*italic*`, `` `code` ``, `[links](/)`, and `[^n]` footnote references (the footnote renders at the bottom; its ↩ returns to the note's marker).
- Placement is zero-drift (Tufte purist): a note sits exactly level with its anchor or — if the margin at that height is occupied — silently demotes to a hover/click popover. **Therefore the body text must read complete without any note.** Never put load-bearing argument in a margin note.

## Marginalia constraints (learned the hard way)

- **~40–60 words per note.** The margin column is ~260px wide; longer notes tower and crowd out neighbors below them.
- **Space notes out.** Two markers in the same paragraph is fine; four in two sentences guarantees popover demotion. Both margins are used (right gutter first, then left of the text), but the right gutter's top is blocked by the infobox — early-in-post notes land left or demote.
- **Inline content only.** A GFM table, image, or block element inside `{{}}` is not supported (block-level GFM inside a note used to crash the whole post render — now handled, but still don't).
- **MDX files:** `{{` is auto-escaped by a Vite pre-transform. Write the normal syntax; never hand-escape to `⟪⟫`.
- On screens below ~1100px all marginalia become popovers — another reason notes must be optional reading.

## Footnotes

Standard GFM:

```markdown
A precise claim.[^1]

[^1]: The source, with *markdown* allowed in the definition.
```

- Definitions render in a visually separated small-caps FOOTNOTES section at the bottom (the "rest" of the document — the TOC rail releases there).
- Readers get a hover-peek popover on the reference, so the definition should make sense out of context.
- Anchors are clean `#fn-1` / `#fnref-1` (no `user-content-` prefix — `clobberPrefix` is `''`).

## Citations

`[@key]` where `key` exists in the content repo's `_refs.bib`. Run `pnpm parse-bib` after editing the bib file. Prefer a citation over a hand-written footnote whenever the source is (or should be) in the bibliography.
