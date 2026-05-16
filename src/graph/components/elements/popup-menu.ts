import { onClickOutside } from '../util';

export function showPopupMenu(anchor: HTMLElement, contents: HTMLElement[]) {
	// Any existing popup should be removed first
	document.querySelector('.slsg-popup-menu')?.remove();

	const popupMenu = document.createElement('div');
	popupMenu.className = 'slsg-popup-menu';

	const popupMenuContent = document.createElement('div');
	popupMenuContent.className = 'slsg-popup-menu-content';
	for (const content of contents) {
		popupMenuContent.appendChild(content);
	}
	popupMenu.appendChild(popupMenuContent);

	// Append to body so overflow:hidden on .slsg-graph-container doesn't clip it.
	// Use position:fixed so coordinates are relative to the viewport.
	document.body.appendChild(popupMenu);

	// Position alongside the anchor's right edge. Default: open downward.
	// If the popup overflows the viewport bottom, flip to open upward instead.
	const rect = anchor.getBoundingClientRect();
	popupMenu.style.position = 'fixed';
	popupMenu.style.right = (window.innerWidth - rect.right) + 'px';
	popupMenu.style.top = (rect.bottom + 4) + 'px';

	// After the element is in the DOM its rendered height is available.
	// Flip upward when there isn't enough space below the button.
	const popupRect = popupMenu.getBoundingClientRect();
	if (popupRect.bottom > window.innerHeight - 8) {
		popupMenu.style.top = '';
		popupMenu.style.bottom = (window.innerHeight - rect.top + 4) + 'px';
	}

	setTimeout(() => {
		onClickOutside(popupMenu, () => {
			popupMenu.remove();
		});
	});
}
