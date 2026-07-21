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

  // TEMP DIAGNOSTIC (remove after debugging): append ?hapticdebug=1 to any URL to
  // get an on-screen event log — pointerdown/click (target + isTrusted) and the
  // mobile TOC's is-open state. Registered before the swallow below so it still
  // sees the synthetic haptic clicks. ponytail: throwaway, deleted once TOC is fixed.
  if (location.search.includes('hapticdebug')) {
    const box = document.createElement('div');
    box.style.cssText =
      'position:fixed;bottom:0;left:0;right:0;max-height:45vh;overflow:auto;z-index:99999;background:rgba(0,0,0,.85);color:#0f0;font:11px/1.35 monospace;padding:6px;white-space:pre-wrap;pointer-events:none';
    const log = (m: string) => {
      box.textContent = `+${performance.now().toFixed(0)}ms ${m}\n${box.textContent ?? ''}`.slice(0, 6000);
    };
    const mount = () => document.body && document.body.appendChild(box);
    if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);
    const desc = (t: EventTarget | null) => {
      const e = t as Element | null;
      if (!e?.tagName) return String(t);
      const cls = typeof e.className === 'string' && e.className
        ? '.' + e.className.split(/\s+/).filter(Boolean).slice(0, 2).join('.') : '';
      return `${e.tagName.toLowerCase()}${e.id ? '#' + e.id : ''}${cls}`;
    };
    (['pointerdown', 'click'] as const).forEach((ev) =>
      document.addEventListener(ev, (e) => log(`${ev} ${desc(e.target)} trusted=${(e as Event).isTrusted}`), true));
    const observeToc = () => {
      const el = document.querySelector('.mobile-toc');
      if (!el || (el as any)._dbgObserved) return;
      (el as any)._dbgObserved = true;
      new MutationObserver(() => log(`TOC is-open=${el.classList.contains('is-open')}`))
        .observe(el, { attributes: true, attributeFilter: ['class'] });
      log('TOC observer attached');
    };
    document.addEventListener('astro:page-load', observeToc);
    window.setTimeout(observeToc, 400);
    window.setTimeout(observeToc, 1200);
  }

  // web-haptics produces its iOS tap by clicking a hidden <label>+<input switch>
  // it appends to <body>. Those clicks bubble to app click handlers — outside-
  // click-to-close drawers, popovers, search overlays — and misfire them (a drawer
  // closes the same tick it opened). Two clicks fire per tap: the label's own click
  // (isTrusted=false) AND, when the label activates its input, a SEPARATE click on
  // input#web-haptics-N which iOS marks isTrusted=TRUE (confirmed on-device). So we
  // must match by TARGET, not trust. Capture phase runs before any bubble-phase app
  // listener; stopImmediatePropagation does NOT cancel the switch toggle (a default
  // action), so the haptic still fires. The elements are display:none — a real user
  // can never click them, so swallowing every click on them is safe.
  document.addEventListener(
    'click',
    (e) => {
      const el = e.target as Element | null;
      if (el?.closest?.('label[for^="web-haptics-"], input[id^="web-haptics-"]')) {
        e.stopImmediatePropagation();
      }
    },
    true,
  );
}
