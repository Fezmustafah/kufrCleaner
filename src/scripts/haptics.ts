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
