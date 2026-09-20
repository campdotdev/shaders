import { expect, test } from '@playwright/test';

/**
 * The shared ScrollArea's edge fades in its two other consumers: the demo
 * page's control panel, which fades only its bottom edge off Base UI's
 * overflow state, and the narrow-viewport nav dropdown, which draws the
 * same fades but switches them from its own measurement. The sidebar's
 * fades are covered in sidebar-scroll.spec.ts.
 */

test.describe('the control panel', () => {
  // Two columns, and a panel cap short enough that WaveLines' sixteen color
  // rows overflow it.
  test.use({ viewport: { width: 1280, height: 720 } });

  test('fades its bottom edge until the last control is in view', async ({ page }) => {
    await page.goto('/components/wave-lines');
    await page.waitForLoadState('networkidle');

    const scrollArea = page.locator('main aside > div');
    const viewport = scrollArea.locator(':scope > div').first();
    const fadeEnd = scrollArea.locator('[data-scroll-fade="end"]');

    await expect(scrollArea.locator('[data-scroll-fade="start"]')).toHaveCount(0);
    await expect(fadeEnd).toHaveCSS('opacity', '1');

    await viewport.evaluate((element) => element.scrollTo({ top: element.scrollHeight }));

    await expect(fadeEnd).toHaveCSS('opacity', '0');
  });
});

test.describe('the nav dropdown', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('fades whichever edge has rows past it', async ({ page }) => {
    await page.goto('/components/aurora');
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: 'Aurora' }).click();

    const scrollArea = page.locator('div[class*="docs-nav-dropdown_body"] > div');
    const viewport = scrollArea.locator(':scope > div').first();
    const fadeStart = scrollArea.locator('[data-scroll-fade="start"]');
    const fadeEnd = scrollArea.locator('[data-scroll-fade="end"]');

    await viewport.evaluate((element) => element.scrollTo({ top: element.scrollHeight }));

    await expect(fadeStart).toHaveCSS('opacity', '1');
    await expect(fadeEnd).toHaveCSS('opacity', '0');

    await viewport.evaluate((element) => element.scrollTo({ top: 0 }));

    await expect(fadeStart).toHaveCSS('opacity', '0');
    await expect(fadeEnd).toHaveCSS('opacity', '1');
  });
});
