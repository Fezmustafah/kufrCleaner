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

  // web-haptics produces its iOS tap by synthetically clicking a hidden <label>
  // it appends to <body> (the switch-toggle trick). That click bubbles to app
  // click handlers — outside-click-to-close drawers, popovers, search overlays —
  // and misfires them (a drawer closes the same tick it opened). Swallow it here
  // once, centrally, so no call site has to know: capture phase runs before any
  // bubble-phase app listener, and stopping propagation does NOT cancel the
  // label's activation, so the haptic still fires. Real user taps are isTrusted.
  document.addEventListener(
    'click',
    (e) => {
      const el = e.target as Element | null;
      if (!e.isTrusted && el?.closest?.('label[for^="web-haptics-"]')) {
        e.stopImmediatePropagation();
      }
    },
    true,
  );
}
