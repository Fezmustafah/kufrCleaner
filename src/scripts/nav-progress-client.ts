// Thin top-of-viewport progress bar for Swup navigations. Drives #nav-progress
// (rendered once in BaseLayout, outside #swup-container so it persists across
// swaps). CSS does the visual trickle via a long `width` transition; this only
// flips classes on Swup's visit lifecycle hooks.
//
// Lifecycle: visit:start → after a short delay (skip the flash on instant
// same-cache loads) show the bar and let CSS trickle width toward 90%.
// page:view → snap to 100% and fade out. visit:end also completes, covering
// aborted/failed visits so the bar never sticks.

interface SwupLike {
  hooks: { on: (event: string, cb: () => void) => void };
}
declare global {
  interface Window { swup?: SwupLike; }
}

// Delay before showing — most cached Swup nav resolves in <120ms, so we skip
// showing the bar at all for those and only reveal it for genuinely slow loads.
const SHOW_DELAY = 120;

function initNavProgress() {
  const bar = document.getElementById('nav-progress');
  const swup = window.swup;
  if (!bar || !swup) return;

  let showTimer: ReturnType<typeof setTimeout> | undefined;
  let doneTimer: ReturnType<typeof setTimeout> | undefined;

  const start = () => {
    clearTimeout(doneTimer);
    bar.classList.remove('is-done');
    // Reset to 0 without a transition so the next trickle starts clean.
    bar.classList.remove('is-active');
    // Force reflow so removing then re-adding is-active restarts the transition.
    void bar.offsetWidth;
    clearTimeout(showTimer);
    showTimer = setTimeout(() => bar.classList.add('is-active'), SHOW_DELAY);
  };

  const done = () => {
    clearTimeout(showTimer);
    if (!bar.classList.contains('is-active')) return; // never shown → nothing to finish
    bar.classList.add('is-done'); // CSS: snap to 100% then fade
    doneTimer = setTimeout(() => {
      bar.classList.remove('is-active', 'is-done');
    }, 300);
  };

  swup.hooks.on('visit:start', start);
  swup.hooks.on('page:view', done);
  swup.hooks.on('visit:end', done); // safety net for aborted/failed visits
}

// window.swup is created by @swup/astro's client; it may not exist at first
// import, so retry a few frames until it's there. Idempotent hook registration
// isn't safe (would double-fire), so only register once.
let registered = false;
let tries = 0;
function boot() {
  if (registered) return;
  if (!window.swup) {
    if (tries++ < 120) requestAnimationFrame(boot); // ~2s cap, then give up
    return;
  }
  registered = true;
  initNavProgress();
}

document.addEventListener('DOMContentLoaded', boot);
if (document.readyState !== 'loading') boot();

export {};
