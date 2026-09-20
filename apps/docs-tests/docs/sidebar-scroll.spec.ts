import { expect, test } from '@playwright/test';

/**
 * The docs sidebar is sticky under a header and banner that scroll away, so
 * a reader reaches its lower groups by scrolling the window until the nav
 * pins. Navigating from a row must not undo that: the group the reader
 * clicked in stays on screen, and the new page still opens at its top. The
 * tree also fades whichever edge has more rows past it (SHA-154), and only
 * that edge.
 */

const sidebar = 'nav[aria-label="Docs"]';

// Short enough that the sidebar's last group starts below the fold and the
// nav has to pin before the last row comes into view.
test.use({ viewport: { width: 1280, height: 720 } });

test('the sidebar fades only the edges with more tree beyond them', async ({ page }) => {
  await page.goto('/components/aurora');
  await page.waitForLoadState('networkidle');

  const scrollArea = page.locator(`${sidebar} > div`);
  const viewport = scrollArea.locator(':scope > div').first();
  const fadeStart = scrollArea.locator('[data-scroll-fade="start"]');
  const fadeEnd = scrollArea.locator('[data-scroll-fade="end"]');

  await expect(fadeStart).toHaveAttribute('aria-hidden', 'true');
  await expect(fadeEnd).toHaveAttribute('aria-hidden', 'true');

  await expect(fadeStart).toHaveCSS('opacity', '0');
  await expect(fadeEnd).toHaveCSS('opacity', '1');

  // Half the scroll range, not half the height: the tree is about twice
  // the cap, so half its height would land inside the 16px end threshold.
  await viewport.evaluate((element) =>
    element.scrollTo({ top: (element.scrollHeight - element.clientHeight) / 2 }),
  );

  await expect(fadeStart).toHaveCSS('opacity', '1');
  await expect(fadeEnd).toHaveCSS('opacity', '1');

  await viewport.evaluate((element) => element.scrollTo({ top: element.scrollHeight }));

  await expect(fadeStart).toHaveCSS('opacity', '1');
  await expect(fadeEnd).toHaveCSS('opacity', '0');
});

test('a short sidebar has no edge fades', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 2000 });
  await page.goto('/components/aurora');
  await page.waitForLoadState('networkidle');

  const scrollArea = page.locator(`${sidebar} > div`);

  await expect(scrollArea.locator('[data-scroll-fade="start"]')).toHaveCSS('opacity', '0');
  await expect(scrollArea.locator('[data-scroll-fade="end"]')).toHaveCSS('opacity', '0');
});

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
