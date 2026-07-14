import { expect, test } from '@playwright/test';

const pilot =
  '/posts/does-the-prophet-speak-only-by-revelation-refuting-the-alleged-contradiction-in-an-najm-53-34/#slides-2';

test('reading deck visual baseline', async ({ page }) => {
  await page.goto(pilot);
  const deck = page.locator('dialog[data-reading-deck]');
  await expect(deck).toBeVisible();
  await expect(deck).toHaveAttribute('data-active-feed', 'slides');
  await expect(deck).toHaveScreenshot('reading-deck-card.png', {
    animations: 'disabled',
    maxDiffPixels: 100,
  });
});
