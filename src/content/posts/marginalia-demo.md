---
title: "Marginalia — Side Notes in the Margin"
date: 2026-04-13
description: "A demonstration of the marginalia feature: Tufte-style side notes that appear in the margin on wide screens and degrade to numbered footnotes on mobile."
tags: [demo, features, writing]
---

## Table of Contents

## What Are Marginalia?

Marginalia {{From Latin *margo* — "margin."}} are notes written in the margins of a text. Scholars have used them for centuries {{Medieval monks filled their manuscripts with marginalia — questions, jokes, and prayers squeezed into every available gap.}} to add commentary without disrupting the reading flow.

On wide screens (≥1640px) these notes appear beside the paragraph they annotate. On smaller screens they fall back to numbered footnotes at the bottom of the page. The same `{{double braces}}` syntax works everywhere.

## Usage

Wrap any text in `{{double curly braces}}` to create a note:

```markdown
The theory {{Proposed by Einstein in 1905}} changed everything.
```

The plugin picks up the content, converts it to HTML {{Including **bold**, _italic_, `code`, and [links](https://en.wikipedia.org/wiki/Sidenote).}}, and injects a superscript reference at that point in the prose.

## Examples

### Short asides

These are perfect for quick definitions {{A *definition* gives the meaning of a term.}} or quick context {{Like a year, a name, or a place.}} that would slow the sentence down if inlined.

### Longer commentary

Sometimes a thought deserves more room {{This is a longer note. It can span several sentences, give historical background, or cite a source — all without forcing the reader to jump to the bottom of the page. On desktop the note sits right beside the paragraph it belongs to.}}.

### Multiple notes in one paragraph

You can have as many notes {{First}} in a single paragraph {{Second}} as you need {{Third — they stack without overlapping, pushed down if necessary.}}. Each gets its own sequential number.

### Notes in lists

Marginalia work inside list items too:

1. Clarity {{Avoid jargon unless you define it.}}
2. Brevity {{Say more with less.}}
3. Accuracy {{Check your sources.}}

### Formatting inside notes

Notes support full Markdown:

- **Bold** emphasis {{**Like this** — draws the eye.}}
- _Italic_ emphasis {{_Used for titles, foreign words, and light stress._}}
- Inline code {{Use `const` for values that do not change.}}
- Links {{See [Edward Tufte's books](https://www.edwardtufte.com/) for the gold standard of margin note design.}}

## Comparison with Footnotes

| Feature | Marginalia | Traditional footnotes |
|---|---|---|
| Placement | Beside the text | Bottom of page |
| Reading flow | Uninterrupted | Requires jumping |
| Numbering | Automatic | Manual or automatic |
| Mobile fallback | Numbered footnotes | N/A |
| Syntax | `{{note}}` | `[^1]` + definition |

Traditional footnotes[^1] are still useful for formal citations. Marginalia are better for conversational asides.

[^1]: This is a standard Markdown footnote, rendered separately by the footnotes plugin.

## Best Practices

**Keep notes short** {{Two sentences is usually the right length.}}. If a thought is essential to the argument, it belongs in the main text {{Move it inline if removing the note would confuse the reader.}}. Marginalia are for enrichment, not load-bearing information.

Good uses:

- Etymology {{The word "philosophy" comes from Greek *philo-* (love) + *sophia* (wisdom).}}
- Quick facts {{The Roman Empire fell in 476 CE.}}
- Cross-references {{See also the [[vault-cms-guide]] for how Obsidian feeds this blog.}}
- Personal commentary {{My own gloss on a point I find interesting.}}
