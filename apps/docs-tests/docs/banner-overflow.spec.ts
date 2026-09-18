import { expect, test } from '@playwright/test';

/**
 * The Components banner's shader renders in a fixed 1728px box, centered
 * under the band, so its dot grid lines up with the poster at every window
 * width. On any narrower viewport that box reaches past the right edge of
 * the page, and unless the band clips it sideways the page grows a
 * horizontal scrollbar. These pages must never scroll sideways.
 */

const routes = ['/components', '/components/led-wall'];

// Both narrower than the banner box, one at the project default and one
// well under it, so the box overhangs on each and the band has to clip it.
const widths = [1280, 1024];

for (const route of routes) {
  for (const width of widths) {
    test(`${route} has no horizontal scroll at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 720 });
      await page.goto(route);
      await page.waitForLoadState('networkidle');

      const [scrollWidth, clientWidth] = await page.evaluate(() => [
        document.documentElement.scrollWidth,
        document.documentElement.clientWidth,
      ]);

      expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
    });
  }
}
