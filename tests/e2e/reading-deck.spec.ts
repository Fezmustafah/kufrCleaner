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

test('mobile native swipe settles on one card without snapping back', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'mobile scroll-snap behavior');
  await openDeck(page);
  const track = dialog(page).locator('[data-deck-track]');
  await track.evaluate((element) => {
    const card = element.querySelector<HTMLElement>('.reading-deck-card');
    element.scrollTo({ left: card?.offsetWidth ?? 390, behavior: 'instant' });
    element.dispatchEvent(new Event('scroll'));
    element.dispatchEvent(new Event('scrollend'));
  });
  await expect(page).toHaveURL(/#slides-1$/);
  await page.waitForTimeout(600);
  await expect(page).toHaveURL(/#slides-1$/);
  await expect(activeCard(page)).toHaveCount(1);
});
