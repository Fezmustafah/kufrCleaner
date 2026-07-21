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
