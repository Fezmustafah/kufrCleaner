# Haptics Integration — Design

**Date:** 2026-07-21
**Branch:** zubayrali/more-haptics
**Status:** Approved (design), pending implementation plan

## Goal

Extend the `web-haptics` library — currently used only in the reading deck — to a small,
curated set of high-value interactions across the site. Tasteful punctuation, not a global
buzz-on-everything handler.

## Library reality (`web-haptics` 0.0.6)

Two engines, chosen automatically:

- **Android Chrome** → `navigator.vibrate()` (`WebHaptics.isSupported === true`).
- **iOS Safari** → hidden `<label>` + `<input type="checkbox" switch>` click trick; fires a
  real iOS haptic. Reliable **only inside a genuine user-gesture handler**.
- **Desktop** → no-op (no haptic hardware). Synthesizes an audio click only when `debug: true`.

Consequences that shaped the design:

1. Timers / scroll-settle / programmatic events buzz on Android but are flaky-to-silent on
   iOS. Attach haptics to real user-gesture handlers.
2. Each `new WebHaptics()` injects a hidden `<label>` into `<body>`. One instance per
   component leaks DOM nodes — worse under Swup's persistent shell. **Use one shared
   instance**, destroyed on `swup:page:view`.
3. Desktop no-op is correct behaviour, not a bug.

## Non-goals

- No global click delegation / hot-wiring every button.
- No migration of the reading deck onto the shared module (it is self-contained and already
  Swup-cleaned). Possible future unification; out of scope now.
- No `showSwitch` UI pill. Opt-out is a `localStorage` flag.

## Architecture

### `src/scripts/haptics.ts` (new — the only real code)

A singleton wrapper exposing semantic helpers.

```ts
import { WebHaptics } from 'web-haptics';

let hx: WebHaptics | null = null;
const enabled = () =>
  !window.matchMedia('(prefers-reduced-motion: reduce)').matches &&
  localStorage.getItem('haptics') !== 'off';

function get() {
  if (!hx) hx = new WebHaptics({ debug: false, showSwitch: false });
  return hx;
}
const fire = (p: string) => { if (enabled()) get().trigger(p).catch(() => {}); };

export const haptics = {
  tap:     () => fire('selection'),
  select:  () => fire('light'),
  success: () => fire('success'),
  error:   () => fire('error'),
};

document.addEventListener('swup:page:view', () => { hx?.destroy(); hx = null; });
```

- **Gating:** `enabled()` checks `prefers-reduced-motion` and a `localStorage.haptics` opt-out.
- **Presets** map to `web-haptics` built-ins: `selection`, `light`, `success`, `error`.
- **Swup:** instance destroyed and nulled on `swup:page:view`; lazily recreated on next
  `fire()`. Prevents hidden-`<label>` accumulation in the persistent shell.
- **Interface:** semantic verbs (`tap`/`select`/`success`/`error`), not raw presets, so call
  sites stay intent-revealing and the preset mapping can change in one place.

## Call sites (6 one-line additions at existing handlers)

| Moment | File / anchor | Call |
|---|---|---|
| Theme toggle | `ThemeToggle.astro` — inside `_themeToggleClick` (~L34) | `haptics.select()` |
| Copy heading permalink | `PostLayout.astro` — `.writeText().then()` (~L457) | `haptics.success()` |
| Mobile menu open | Header hamburger `#nav-menu-switch` open handler | `haptics.tap()` |
| Mobile TOC drawer open | `MobileTableOfContents` toggle handler | `haptics.tap()` |
| Search result open | `SearchPalette.astro` — `navigate(href)` (~L236) | `haptics.select()` |
| Graph node select (touch) | `simulator.ts` — node navigate/settle | `haptics.tap()` |

Each import: `import { haptics } from '@/scripts/haptics';` (or relative path from `.astro`
inline scripts). Astro inline `<script>` blocks are bundled, so the import resolves.

**Graph caveat:** `src/graph/` is the "read AGENTS.md §Graph first" zone and wraps vendored
PixiJS. The graph node-select hook is added last and dropped if it fights the Pixi event
layer. The other five are independent and low-risk.

## Error handling

- `trigger()` is fire-and-forget with `.catch(() => {})` — haptics never surface errors to the
  user or block the interaction.
- On unsupported devices `web-haptics` no-ops internally; no guard needed at call sites beyond
  the `enabled()` gate.

## Testing

- **Manual, on-device (primary):** real Android Chrome and iOS Safari — confirm each of the 6
  moments fires and desktop stays silent. Haptic hardware cannot be asserted in CI.
- **Self-check (`enabled()` logic):** a small runnable check asserting the gate returns false
  when `prefers-reduced-motion` matches and when `localStorage.haptics === 'off'`, true
  otherwise. This is the one branch worth pinning; the rest are trivial one-liners.
- Verify no duplicate hidden `<label>` nodes accumulate after several Swup navigations.

## Rollout

Ship the module + theme toggle + copy first, confirm feel on a real phone, then add the
remaining sites. Graph last.
