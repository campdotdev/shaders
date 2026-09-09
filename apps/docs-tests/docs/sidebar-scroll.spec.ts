import { expect, test } from '@playwright/test';

/**
 * The docs sidebar is sticky under a header and banner that scroll away, so
 * a reader reaches its lower groups by scrolling the window until the nav
 * pins. Navigating from a row must not undo that: the group the reader
 * clicked in stays on screen, and the new page still opens at its top.
 */

const sidebar = 'nav[aria-label="Docs"]';

// Short enough that the sidebar's last group starts below the fold and the
// nav has to pin before the last row comes into view.
test.use({ viewport: { width: 1280, height: 720 } });

test('a sidebar click keeps the clicked group on screen', async ({ page }) => {
  await page.goto('/components/aurora');
  await page.waitForLoadState('networkidle');

  const lastRow = page.locator(`${sidebar} a`).last();
  const target = await lastRow.getAttribute('href');

  await lastRow.scrollIntoViewIfNeeded();
  await expect(lastRow).toBeInViewport();
  await lastRow.click();
  await expect(page).toHaveURL(target!);

  await expect(lastRow).toHaveAttribute('aria-current', 'page');
  await expect(lastRow).toBeInViewport();
  await expect(page.locator('main h1')).toBeInViewport();
  await expect(page.locator('[data-shader-demo]')).toBeInViewport({ ratio: 0.5 });
});

test('a sidebar click from deep in a page opens the new page at its top', async ({ page }) => {
  await page.goto('/components/aurora');
  await page.waitForLoadState('networkidle');

  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const firstRow = page.locator(`${sidebar} a`).first();
  const target = await firstRow.getAttribute('href');

  await expect(firstRow).toBeInViewport();
  await firstRow.click();
  await expect(page).toHaveURL(target!);

  await expect(firstRow).toHaveAttribute('aria-current', 'page');
  await expect(firstRow).toBeInViewport();
  await expect(page.locator('main h1')).toBeInViewport();
  await expect(page.locator('[data-shader-demo]')).toBeInViewport({ ratio: 0.5 });
});
