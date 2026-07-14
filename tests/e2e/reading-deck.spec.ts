import { expect, test, type Page } from '@playwright/test';

const pilot =
  '/posts/does-the-prophet-speak-only-by-revelation-refuting-the-alleged-contradiction-in-an-najm-53-34/';

const dialog = (page: Page) => page.locator('dialog[data-reading-deck]');
const activeCard = (page: Page) => dialog(page).locator('.reading-deck-card[aria-hidden="false"]');

async function openDeck(page: Page, feed: 'slides' | 'tldr' = 'slides') {
  await page.goto(pilot);
  await expect(page.locator('html')).toHaveClass(/reading-deck-ready/);
  await page.locator(`[data-deck-open="${feed}"]`).click();
  await expect(dialog(page)).toBeVisible();
  await expect(activeCard(page)).toHaveCount(1);
  await page.waitForTimeout(450);
}

test('navigates, switches feeds, and restores browser history', async ({ page }) => {
  await openDeck(page);
  await page.locator('[data-deck-next]').click();
  await expect(page).toHaveURL(/#slides-1$/);
  await expect(activeCard(page)).toHaveAttribute('data-deck-distance', '0');

  await page.locator('[data-deck-feed="tldr"]').click();
  await expect(page).toHaveURL(/#tldr-0$/);
  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`${pilot}$`));
  await expect(dialog(page)).toBeHidden();
  await page.goForward();
  await expect(page).toHaveURL(/#tldr-0$/);
  await expect(dialog(page)).toBeVisible();
  await expect(dialog(page).locator('[data-deck-feed="tldr"]')).toHaveAttribute('aria-pressed', 'true');
});

test('Contents selects a card and returns focus to the deck', async ({ page }) => {
  await openDeck(page);
  await page.locator('[data-deck-index-open]').click();
  const contents = dialog(page).locator('[data-deck-index]');
  await expect(contents).toBeVisible();
  await contents.locator('[data-card-index]').nth(1).click();
  await expect(contents).toBeHidden();
  await expect(page).toHaveURL(/#slides-2$/);
  await expect(activeCard(page)).toHaveCount(1);
});

test('neighbor cards navigate and explicit Finish opens completion', async ({ page, isMobile }) => {
  test.skip(Boolean(isMobile), 'desktop transform behavior');
  await openDeck(page);
  await page.locator('[data-deck-next]').click();
  const before = await activeCard(page).textContent();
  await dialog(page).locator('[data-deck-neighbor="1"]').click();
  await expect(activeCard(page)).not.toHaveText(before ?? '');

  const next = dialog(page).locator('[data-deck-next]');
  while ((await next.textContent())?.includes('Finish') === false) await next.click();
  await expect(dialog(page).locator('[data-deck-finish]')).not.toHaveAttribute(
    'data-deck-finish-active',
    'true',
  );
  await next.click();
  await expect(dialog(page).locator('[data-deck-finish]')).toHaveAttribute('data-deck-finish-active', 'true');
  await dialog(page).locator('[data-deck-finish]').click({ position: { x: 5, y: 5 } });
  await expect(dialog(page).locator('[data-deck-finish]')).toHaveAttribute('data-deck-finish-active', 'false');
});

test('mobile scroll snap settles on one card without snapping back', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'mobile scroll-snap behavior');
  await openDeck(page);
  const track = dialog(page).locator('[data-deck-track]');
  await track.evaluate((element) => {
    const card = element.querySelector<HTMLElement>('.reading-deck-card');
    element.scrollTo({ left: card?.offsetWidth ?? 390, behavior: 'instant' });
  });
  await expect(page).toHaveURL(/#slides-1$/);
  await page.waitForTimeout(600);
  await expect(page).toHaveURL(/#slides-1$/);
  const settled = await track.evaluate((element) => ({
    left: element.scrollLeft,
    width: element.querySelector<HTMLElement>('.reading-deck-card')?.offsetWidth ?? 0,
  }));
  expect(Math.abs(settled.left - settled.width)).toBeLessThan(12);
  await expect(activeCard(page)).toHaveCount(1);
});

test('page-load reinitialization keeps the active session attached', async ({ page }) => {
  await openDeck(page);
  const before = page.url();
  await page.evaluate(() => document.dispatchEvent(new Event('astro:page-load')));
  await expect(dialog(page)).toBeVisible();
  await expect(page).toHaveURL(before);
  await page.locator('[data-deck-next]').click();
  await expect(page).toHaveURL(/#slides-1$/);
});

test('direct heading links restore the matching card', async ({ page }) => {
  await page.goto(`${pilot}#deck-slides-3-the-face-of-invalidating-the-doubt`);
  await expect(dialog(page)).toBeVisible();
  await expect(activeCard(page)).toContainText('The Face of Invalidating the Doubt');
  await expect(page).toHaveURL(/#deck-slides-3-the-face-of-invalidating-the-doubt$/);
});

test('footnote popovers remain until an outside pointer dismisses them', async ({ page }) => {
  await page.goto(`${pilot}#deck-slides-3-the-face-of-invalidating-the-doubt`);
  await expect(dialog(page)).toBeVisible();
  const note = activeCard(page).locator('a[data-deck-source-id], .footnote-number').first();
  await expect(note).toBeVisible();
  await note.click();
  const popover = dialog(page).locator('[data-deck-source-panel]');
  await expect(popover).toBeVisible();
  await page.waitForTimeout(450);
  await expect(popover).toBeVisible();
  await dialog(page).locator('.reading-deck-topbar').click({ position: { x: 4, y: 4 } });
  await expect(popover).toBeHidden();
});

test('mobile partial movement, reversal, and nested scrolling stay local', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'mobile scroll-snap behavior');
  await openDeck(page);
  const track = dialog(page).locator('[data-deck-track]');
  const card = activeCard(page);
  await card.evaluate((element) => element.scrollTo({ top: 120, behavior: 'instant' }));
  await expect(page).toHaveURL(/#slides-0$/);

  await track.evaluate((element) => element.scrollTo({ left: 48, behavior: 'instant' }));
  await page.waitForTimeout(500);
  await expect(page).toHaveURL(/#slides-0$/);

  await track.evaluate((element) => {
    const width = element.querySelector<HTMLElement>('.reading-deck-card')?.offsetWidth ?? 390;
    element.scrollTo({ left: width * 2, behavior: 'instant' });
    element.scrollTo({ left: width, behavior: 'instant' });
  });
  await page.waitForTimeout(650);
  await expect(page).toHaveURL(/#slides-1$/);
});

test('mobile controls remain in the visual viewport and double tap does not zoom', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'mobile viewport behavior');
  await openDeck(page);
  const controls = dialog(page).locator('.reading-deck-controls');
  const bounds = await controls.boundingBox();
  const viewport = await page.evaluate(() => ({
    height: window.visualViewport?.height ?? window.innerHeight,
    scale: window.visualViewport?.scale ?? 1,
  }));
  expect(bounds).not.toBeNull();
  expect((bounds?.y ?? 0) + (bounds?.height ?? 0)).toBeLessThanOrEqual(viewport.height + 1);
  await page.touchscreen.tap(200, 400);
  await page.touchscreen.tap(200, 400);
  await page.waitForTimeout(350);
  await expect(dialog(page)).toBeVisible();
  expect(await page.evaluate(() => window.visualViewport?.scale ?? 1)).toBe(1);
  await expect(dialog(page).locator('[data-deck-scroll-shadow]')).toHaveCount(1);
  await expect(dialog(page).locator('[data-deck-scroll-shadow]')).toHaveText('');
});
