import { expect, test } from '@playwright/test';

/**
 * The shared ScrollArea's edge fades in its three other consumers: the demo
 * page's control panel, which fades both edges off Base UI's overflow state
 * with the top fade tucked under its sticky title row, the search panel's
 * results, which fade both edges the same way, and the narrow-viewport nav
 * dropdown, which draws the same fades but switches them from its own
 * measurement. The sidebar's fades are covered in sidebar-scroll.spec.ts.
 */

test.describe('the control panel', () => {
  // Two columns, and a panel cap short enough that WaveLines' sixteen color
  // rows overflow it.
  test.use({ viewport: { width: 1280, height: 720 } });

  test('fades whichever edge has controls past it', async ({ page }) => {
    await page.goto('/components/wave-lines');
    await page.waitForLoadState('networkidle');

    const scrollArea = page.locator('main aside > div');
    const viewport = scrollArea.locator(':scope > div').first();
    const fadeStart = scrollArea.locator('[data-scroll-fade="start"]');
    const fadeEnd = scrollArea.locator('[data-scroll-fade="end"]');

    await expect(fadeStart).toHaveCSS('opacity', '0');
    await expect(fadeEnd).toHaveCSS('opacity', '1');

    await viewport.evaluate((element) => element.scrollTo({ top: element.scrollHeight }));

    await expect(fadeStart).toHaveCSS('opacity', '1');
    await expect(fadeEnd).toHaveCSS('opacity', '0');
  });

  test('starts its top fade under the sticky title row', async ({ page }) => {
    await page.goto('/components/wave-lines');
    await page.waitForLoadState('networkidle');

    const scrollArea = page.locator('main aside > div');
    const viewport = scrollArea.locator(':scope > div').first();
    const fadeStart = scrollArea.locator('[data-scroll-fade="start"]');
    const titleRow = page
      .getByRole('group', { name: 'Shader controls' })
      .locator(':scope > div')
      .first();

    await viewport.evaluate((element) => element.scrollTo({ top: element.scrollHeight }));
    await expect(fadeStart).toHaveCSS('opacity', '1');

    // The fade's top edge meets the row's bottom edge, so the gradient
    // covers the controls under the row and none of the row itself.
    const rowBox = (await titleRow.boundingBox())!;
    const fadeBox = (await fadeStart.boundingBox())!;

    expect(fadeBox.y).toBeCloseTo(rowBox.y + rowBox.height, 0);
  });
});

test.describe('the search results', () => {
  test('fade whichever edge has results past it', async ({ page }) => {
    await page.goto('/components/aurora');
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: 'Open search' }).click();
    // A word on every page, so the list is sure to outgrow its cap.
    await page.getByRole('combobox', { name: 'Search query' }).fill('shader');

    const panel = page.getByRole('dialog', { name: 'Search', exact: true });

    await expect(panel.getByRole('option').first()).toBeVisible();

    const scrollArea = panel.locator('div[class*="search_resultsScroller"]');
    const viewport = scrollArea.locator(':scope > div').first();
    const fadeStart = scrollArea.locator('[data-scroll-fade="start"]');
    const fadeEnd = scrollArea.locator('[data-scroll-fade="end"]');

    await expect(fadeStart).toHaveCSS('opacity', '0');
    await expect(fadeEnd).toHaveCSS('opacity', '1');

    await viewport.evaluate((element) => element.scrollTo({ top: element.scrollHeight }));

    await expect(fadeStart).toHaveCSS('opacity', '1');
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
