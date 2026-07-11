---
name: scripture-callouts
description: Use when quoting sources in post content — Qurʼan, Bible, hadith, scholars, or opposing arguments. The callout type chosen is load-bearing: it drives the infobox "Sources cited" counts and the refutation-post rhythm.
---

# Scripture & source callouts

Source quotations use Obsidian-style callouts. The type is not cosmetic: `PostInfobox.astro` regexes the post body for these types to build the "Sources cited" counts, so a misfiled quote produces wrong numbers in the infobox.

## The types

```markdown
> [!quran] Qurʼan 2:79
> So woe to those who write the Book with their own hands…

> [!bible] Jeremiah 8:8
> How can you say, "We are wise…"

> [!hadith] Sahih al-Bukhari 1234
> The narration text…

> [!scholar] Bart Ehrman
> There are more differences among our manuscripts…
```

Rules:
- **Exact source class → exact type.** A Qurʼan verse in a `[!quote]` callout is invisible to the infobox counter.
- **The reference goes in the title line**, not the body: `[!quran] Qurʼan 2:79`, `[!scholar] Ibn Taymiyyah, Majmūʿ al-Fatāwā 4:12`. Use the ʿ/ʾ transliteration marks consistently with the rest of the site.
- Quotation text stays verbatim and unannotated (no rough-notation inside callouts — see the rough-notation skill).
- Generic `[!quote]` exists for quotations that fit no source class; it is deliberately NOT counted in "Sources cited".

## Refutation rhythm: objection / response / admission

```markdown
> [!objection] The polemicist's claim
> Stated fairly, in its strongest form.

> [!response] The answer
> The refutation.
```

- `objection` (grey) and `response` (gold) render as a visually paired rhythm — use them as alternating beats in refutation posts, always in that order.
- **Steelman the objection.** The objection callout must state the opposing claim in the form its proponents would recognize; refuting a weakened version undermines the whole site's credibility.
- `[!admission]` is reserved for concessions from the *opposing* side (a critic conceding a point, a hostile source agreeing) — high rhetorical value, don't dilute it with friendly sources.
- `[!cite]` is for bibliographic notes attached to another callout.

## Rendering context

These render de-carded as left-rule quotations (wiki style), not boxed cards. Callout types beyond this list exist site-wide (`[!note]`, `[!warning]`, etc.) and behave as normal callouts — this skill only governs source quotation.
