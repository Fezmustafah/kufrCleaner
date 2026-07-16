// Linked-mentions collapse toggle (LinkedMentions.astro). Loaded globally from
// BaseLayout (see the always-loaded init modules block there): post pages can
// be reached via Swup nav from any entry page, and Swup never executes scripts
// shipped only with the fetched page. No-ops when the toggle is absent.
function initializeLinkedMentions() {
  const toggle = document.getElementById('linked-mentions-toggle') as HTMLButtonElement;
  const content = document.getElementById('linked-mentions-content') as HTMLElement;
  const arrowIcon = document.getElementById('linked-mentions-arrow-icon') as HTMLElement;

  if (toggle && content && arrowIcon) {
    // Remove any existing event listeners to prevent duplicates
    const newToggle = toggle.cloneNode(true) as HTMLButtonElement;
    const parentNode = toggle.parentNode;
    if (parentNode) {
      parentNode.replaceChild(newToggle, toggle);
    }

    // Get fresh references after cloning
    const freshContent = document.getElementById('linked-mentions-content') as HTMLElement;
    const freshArrowIcon = document.getElementById('linked-mentions-arrow-icon') as HTMLElement;

    // Add click handler to the new toggle element
    newToggle.addEventListener('click', function () {
      const isExpanded = newToggle.getAttribute('aria-expanded') === 'true';

      if (isExpanded) {
        // Collapse
        freshContent.style.maxHeight = '0';
        freshContent.style.opacity = '0';
        freshArrowIcon.style.transform = 'rotate(-180deg)';
        newToggle.setAttribute('aria-expanded', 'false');
      } else {
        // Expand
        freshContent.style.maxHeight = freshContent.scrollHeight + 'px';
        freshContent.style.opacity = '1';
        freshArrowIcon.style.transform = 'rotate(0deg)';
        newToggle.setAttribute('aria-expanded', 'true');
      }
    });

    // Initialize with expanded state
    freshContent.style.maxHeight = freshContent.scrollHeight + 'px';
    freshContent.style.opacity = '1';
    freshArrowIcon.style.transform = 'rotate(0deg)';
  }
}

(window as any).initializeLinkedMentions = initializeLinkedMentions;
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeLinkedMentions);
} else {
  initializeLinkedMentions();
}
document.addEventListener('astro:page-load', initializeLinkedMentions);

// Mark as an ES module (loaded via dynamic import in BaseLayout); no runtime effect.
export {};
