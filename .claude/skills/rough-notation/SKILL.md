---
name: rough-notation
description: Use when writing or editing post content and considering hand-drawn emphasis (==highlight==, !!underline!!, ^^box^^, ((circle)), ||bracket||) — gives the semantic mapping for each type and, more importantly, when NOT to use them.
---

# Rough-notation annotations

Hand-drawn ink effects (rough-notation library) that animate as they scroll into view. They are rhetorical devices, not text formatting. **The default number of annotations on a page is zero.**

## Semantic mapping — each type has ONE job

| Syntax | Effect | Use for | Example |
|---|---|---|---|
| `==text==` | highlight | The single most important phrase of a section — the sentence you'd quote | `the ==burden of proof== lies with the claimant` |
| `!!text!!` | underline | A claim being *flagged as wrong* — polemicist assertions, misreadings | `they insist the text is !!perfectly preserved!!` |
| `^^text^^` | box | A technical term **at its definition site** (first introduction only) | `scholars call this ^^interpolation^^` |
| `((text))` | circle | A key number or quantity in an argument | `affecting ((forty verses))` |
| `\|\|text\|\|` | bracket | An editorial aside set off from the main flow | `\|\|a charitable reading\|\|` |

Block form for whole-sentence emphasis only:

````markdown
```highlight
This entire sentence is annotated as one continuous phrase.
```
````

(`underline`, `box`, `circle`, `bracket` fences work the same way.)

## When NOT to use them — the actual point of this skill

- **Not decoration.** If the answer to "what work is this annotation doing?" is "emphasis," use `**bold**`. Annotations carry *semantic* weight per the table above; mixing jobs (boxing something for emphasis, highlighting a wrong claim) trains readers to ignore them.
- **Density cap: ~2 per screenful.** More reads as clutter and the scroll-in animations compete. A refutation post might legitimately use `!!...!!` several times across its length — but never several per paragraph.
- **Never inside** headings, links, code spans, callout titles, or margin notes. Never spanning across a sentence boundary.
- **Never on scripture.** Qurʼan/Bible/hadith quotations live in callouts (see the scripture-callouts skill) and stay visually unmarked — annotating a sacred text's words with hand-drawn ink reads as editorializing the source rather than the argument.
- **Not a substitute for structure.** If you're highlighting many phrases to help skimmers, the section needs a summary callout or better headings, not more ink.
- `^^box^^` only at the FIRST occurrence of a term. Boxing every repetition is noise.

## Litmus test before adding one

1. Does it match exactly one row of the semantic table? If it straddles two, don't.
2. Is it within the density cap for its screenful?
3. Would the sentence still make its point unannotated? (It must — annotations are progressive enhancement; some readers get reduced-motion or no-JS.)
