# Haptics Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend `web-haptics` from the reading deck to a curated set of ~6 high-value interactions via one shared, Swup-safe, opt-out-respecting module.

**Architecture:** A single `src/scripts/haptics.ts` singleton wraps one `WebHaptics` instance, exposes semantic verbs (`tap`/`select`/`success`/`error`), gates on `prefers-reduced-motion` + a `localStorage` opt-out, and destroys the instance on `swup:page:view` so the library's injected hidden `<label>` never accumulates in the persistent shell. Six existing user-gesture handlers each gain one call.

**Tech Stack:** TypeScript, Astro inline scripts, `web-haptics` 0.0.6 (already installed), Vitest 4.

## Global Constraints

- `web-haptics` version: `0.0.6` (already in `package.json`; do not bump).
- Haptics engine is Android `navigator.vibrate` + iOS `<label>` switch trick; **desktop is a silent no-op — that is correct, not a bug.**
- Attach haptics only inside genuine user-gesture handlers (iOS trick is unreliable outside them).
- One shared `WebHaptics` instance for the whole app. Never `new WebHaptics()` per component.
- Swup rule (CLAUDE.md #3): anything stateful re-inits/cleans up on `swup:page:view`.
- No `console.log` in production (CLAUDE.md #5).
- Never edit vendored `src/graph/.../pixi.js` / `pixi.d.ts` (CLAUDE.md #9). `simulator.ts` is NOT vendored — editable.
- Path alias `@/` → `src/`. Import as `import { haptics } from '@/scripts/haptics';`.
- The reading deck keeps its own existing instance; do not refactor it in this plan.

---

### Task 1: Shared haptics module + gate test

**Files:**
- Create: `src/scripts/haptics.ts`
- Test: `src/scripts/haptics.test.ts`

**Interfaces:**
- Produces:
  - `isHapticsEnabled(reduceMotion: boolean, pref: string | null): boolean` — pure decision function.
  - `haptics: { tap(): void; select(): void; success(): void; error(): void }` — the call-site API used by every later task.

- [ ] **Step 1: Write the failing test**

Create `src/scripts/haptics.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { isHapticsEnabled } from './haptics';

describe('isHapticsEnabled', () => {
  it('enabled by default (motion ok, no stored pref)', () => {
    expect(isHapticsEnabled(false, null)).toBe(true);
  });

  it('disabled when the user prefers reduced motion', () => {
    expect(isHapticsEnabled(true, null)).toBe(false);
  });

  it('disabled when the stored pref is "off"', () => {
    expect(isHapticsEnabled(false, 'off')).toBe(false);
  });

  it('any non-"off" stored value leaves it enabled', () => {
    expect(isHapticsEnabled(false, 'on')).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/scripts/haptics.test.ts`
Expected: FAIL — `isHapticsEnabled` is not exported / module not found.

- [ ] **Step 3: Write minimal implementation**

Create `src/scripts/haptics.ts`:

```ts
import { WebHaptics } from 'web-haptics';

/** Pure gate: haptics fire only when motion is allowed and the user hasn't opted out. */
export function isHapticsEnabled(reduceMotion: boolean, pref: string | null): boolean {
  return !reduceMotion && pref !== 'off';
}

let hx: WebHaptics | null = null;

function enabled(): boolean {
  if (typeof window === 'undefined') return false;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  return isHapticsEnabled(reduceMotion, localStorage.getItem('haptics'));
}

function get(): WebHaptics {
  if (!hx) hx = new WebHaptics({ debug: false, showSwitch: false });
  return hx;
}

// Fire-and-forget; haptics must never surface an error or block the interaction.
function fire(preset: string): void {
  if (enabled()) get().trigger(preset).catch(() => {});
}

export const haptics = {
  tap: () => fire('selection'),
  select: () => fire('light'),
  success: () => fire('success'),
  error: () => fire('error'),
};

// Swup: destroy on nav so the library's injected hidden <label> doesn't pile up
// in the persistent shell. Lazily recreated on the next fire().
if (typeof document !== 'undefined') {
  document.addEventListener('swup:page:view', () => {
    hx?.destroy();
    hx = null;
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/scripts/haptics.test.ts`
Expected: PASS (4 passing).

- [ ] **Step 5: Commit**

```bash
git add src/scripts/haptics.ts src/scripts/haptics.test.ts
git -c user.name=fayzabdul -c user.email=mail.zubayrali@gmail.com commit -m "feat(haptics): shared Swup-safe haptics module with opt-out gate

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Ship-first sites — theme toggle + copy permalink

**Files:**
- Modify: `src/components/ThemeToggle.astro` (inline `<script>`, ~L21-34)
- Modify: `src/layouts/PostLayout.astro` (inline `<script>`, ~L442-465)

**Interfaces:**
- Consumes: `haptics.select`, `haptics.success` from Task 1.

- [ ] **Step 1: Theme toggle → `select`**

In `src/components/ThemeToggle.astro`, add the import at the top of the `<script>` block and one call inside `_themeToggleClick`. The block becomes:

```html
<script>
  import { haptics } from '@/scripts/haptics';

  // Named function so addEventListener deduplicates if script somehow runs twice
  function _themeToggleClick() {
    const html = document.documentElement;
    const next = html.classList.contains('dark') ? 'light' : 'dark';
    localStorage.setItem('theme', next);
    html.classList.remove('light', 'dark');
    html.classList.add(next);
    window.dispatchEvent(new CustomEvent('themechange', { detail: { theme: next } }));
    haptics.select();
  }

  // Wire once — the button element persists across Swup page transitions
  const btn = document.getElementById('theme-toggle');
  if (btn) btn.addEventListener('click', _themeToggleClick);
</script>
```

- [ ] **Step 2: Copy permalink → `success` (only on a successful copy)**

In `src/layouts/PostLayout.astro`, add the import to the top of the `initHeadingPermalinks` `<script>` block, and chain the success haptic onto the clipboard promise. Change:

```ts
            navigator.clipboard.writeText(url.toString()).catch(() => {});
```

to:

```ts
            navigator.clipboard.writeText(url.toString())
              .then(() => haptics.success())
              .catch(() => {});
```

And add `import { haptics } from '@/scripts/haptics';` as the first line inside that `<script>` block (above `function initHeadingPermalinks()`).

- [ ] **Step 3: Typecheck**

Run: `pnpm exec astro check`
Expected: no new errors referencing `ThemeToggle.astro`, `PostLayout.astro`, or `haptics`.

- [ ] **Step 4: Commit**

```bash
git add src/components/ThemeToggle.astro src/layouts/PostLayout.astro
git -c user.name=fayzabdul -c user.email=mail.zubayrali@gmail.com commit -m "feat(haptics): tactile feedback on theme toggle and permalink copy

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Nav sites — mobile menu, mobile TOC, search result open

**Files:**
- Modify: `src/components/Header.astro` (nav-drawer handler, ~L182-184)
- Modify: `src/scripts/mobile-toc-client.ts` (`open()`, ~L33-35)
- Modify: `src/components/SearchPalette.astro` (`navigate()`, ~L236-241)

**Interfaces:**
- Consumes: `haptics.tap`, `haptics.select` from Task 1.

- [ ] **Step 1: Mobile menu open → `tap` (only on open, not close)**

In `src/components/Header.astro`, add `import { haptics } from '@/scripts/haptics';` to the top of the inline `<script>` block, then change the hamburger handler:

```ts
    document.getElementById('nav-menu-switch')?.addEventListener('click', () => {
      const next = !drawerIsOpen();
      if (next) haptics.tap();
      setDrawer(next);
    });
```

- [ ] **Step 2: Mobile TOC open → `tap`**

In `src/scripts/mobile-toc-client.ts`, add `import { haptics } from '@/scripts/haptics';` at the top, then in `open()`:

```ts
  const open = () => {
    root.classList.add('is-open');
    bar.setAttribute('aria-expanded', 'true');
    haptics.tap();
  };
```

- [ ] **Step 3: Search result open → `select`**

In `src/components/SearchPalette.astro`, add `import { haptics } from '@/scripts/haptics';` to the top of the inline `<script>`, then in `navigate()`:

```ts
    const navigate = (href: string) => {
      haptics.select();
      close();
      const swup = (window as any).swup;
      if (swup?.navigate) swup.navigate(href);
      else window.location.href = href;
    };
```

- [ ] **Step 4: Typecheck**

Run: `pnpm exec astro check`
Expected: no new errors in the three modified files.

- [ ] **Step 5: Commit**

```bash
git add src/components/Header.astro src/scripts/mobile-toc-client.ts src/components/SearchPalette.astro
git -c user.name=fayzabdul -c user.email=mail.zubayrali@gmail.com commit -m "feat(haptics): tactile feedback on menu, TOC drawer, and search open

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Graph node navigate (tentative)

`src/graph/` is the "read AGENTS.md §Graph first" zone. `simulator.ts` is not vendored, so it is editable, but if this hook fights the Pixi/D3 event layer, drop the task — the other five stand alone.

**Files:**
- Modify: `src/graph/components/graph/simulator.ts` (navigate branch, ~L348-350)

**Interfaces:**
- Consumes: `haptics.tap` from Task 1.

- [ ] **Step 1: Read the graph section**

Read `AGENTS.md` §Graph System before editing anything under `src/graph/`.

- [ ] **Step 2: Fire `tap` when a node navigation actually commits**

In `src/graph/components/graph/simulator.ts`, add `import { haptics } from '@/scripts/haptics';` at the top of the file, then in the navigate branch:

```ts
						const swup = (window as unknown as { swup?: { navigate?: (url: string) => void } }).swup;
						haptics.tap();
						if (window.self === window.top && typeof swup?.navigate === 'function') {
							swup.navigate(url);
						} else {
							window.open(url, '_self');
						}
```

- [ ] **Step 3: Full build (definitive gate for the graph edit)**

Run: `pnpm build`
Expected: build succeeds; no errors mentioning `simulator.ts` or `haptics`.
If the build breaks or graph behaviour regresses, revert this file and stop — Task 4 is optional.

- [ ] **Step 4: Commit**

```bash
git add src/graph/components/graph/simulator.ts
git -c user.name=fayzabdul -c user.email=mail.zubayrali@gmail.com commit -m "feat(haptics): tactile feedback on graph node navigation

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: On-device verification (manual — the real test)

Haptic hardware cannot be asserted in CI. Verify on real devices.

- [ ] **Step 1: Android Chrome** — visit a deployed/preview build. Confirm a buzz on: theme toggle, permalink copy, mobile menu open, mobile TOC open, search result open, graph node navigate.
- [ ] **Step 2: iOS Safari** — same six. The `<label>` switch trick fires the taps. Confirm no visible stray control appears (`showSwitch: false`).
- [ ] **Step 3: Desktop** — confirm all six are silent no-ops (no errors in console).
- [ ] **Step 4: Opt-out** — in devtools run `localStorage.setItem('haptics','off')`, reload, confirm all six go silent. Set OS "reduce motion" and confirm the same.
- [ ] **Step 5: Swup leak check** — navigate between 5+ pages, then in devtools run `document.querySelectorAll('label[for^="web-haptics-"]').length` — expect `0` or `1`, never growing per navigation.

---

## Self-Review

**Spec coverage:**
- Shared module (singleton, reduced-motion + localStorage gate, Swup destroy) → Task 1. ✓
- Theme toggle → Task 2. Copy permalink → Task 2. ✓
- Mobile menu → Task 3. Mobile TOC → Task 3. Search select → Task 3. ✓
- Graph node select → Task 4 (tentative, matches spec caveat). ✓
- Error handling (`.catch(() => {})`, fire-and-forget) → Task 1 `fire()`. ✓
- Testing: pure-gate unit test → Task 1; on-device matrix + Swup leak check → Task 5. ✓
- Non-goal (deck untouched) → honored; no task modifies the reading deck. ✓

**Placeholder scan:** No TBD/TODO; every code step shows exact code. ✓

**Type consistency:** `isHapticsEnabled(boolean, string|null): boolean` and `haptics.{tap,select,success,error}` are defined in Task 1 and used verbatim in Tasks 2–4. ✓
