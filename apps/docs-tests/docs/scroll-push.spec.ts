import { type CDPSession, expect, type Page, test } from '@playwright/test';

/**
 * Scroll push in a real browser (SHA-225): a CDP touch that drags on the
 * touch probe's opted-in scene scrolls the page, and the probe's recorder
 * logs the push frames that reached the scene. SwiftShader draws slowly on
 * CI and the push comes once per frame, so the drag takes its time and every
 * check polls.
 */
test.use({
  hasTouch: true,
  isMobile: true,
  viewport: { width: 412, height: 839 },
  deviceScaleFactor: 1,
});

const scene = (page: Page) => page.locator('[data-scroll-push-scene]');

const scrollY = (page: Page) => page.evaluate(() => window.scrollY);

const touch = (
  client: CDPSession,
  type: 'touchStart' | 'touchMove' | 'touchEnd',
  points: Array<{ x: number; y: number; id: number }>,
) => client.send('Input.dispatchTouchEvent', { type, touchPoints: points });

/**
 * Opens the probe with the top scene in view, once it has drawn. A scene
 * pauses while it is off screen, and this one starts below the fold, so it
 * scrolls in before the wait.
 */
async function open(page: Page): Promise<{ client: CDPSession; x: number; y: number }> {
  await page.goto('/dev/touch-probe');
  await scene(page).evaluate((element) => element.scrollIntoView({ block: 'center' }));
  await expect(scene(page)).toHaveAttribute('data-ready', 'true', { timeout: 60_000 });
  const box = await scene(page).boundingBox();

  if (!box) throw new Error('The scroll-push scene has no box.');

  return {
    client: await page.context().newCDPSession(page),
    x: box.x + box.width / 2,
    y: box.y + box.height * 0.8,
  };
}

/** The push frames the probe logged for its first contact, once it settles. */
async function firstContactPushFrames(page: Page): Promise<number | null> {
  const report = await page.getByLabel('Report').inputValue();
  const match = /#1: .* (\d+) push frames/.exec(report);

  return match ? Number(match[1]) : null;
}

test('a drag on an opted-in scene scrolls the page and pushes the scene', async ({ page }) => {
  const { client, x, y } = await open(page);
  const before = await scrollY(page);

  await touch(client, 'touchStart', [{ x, y, id: 1 }]);
  for (let step = 1; step <= 20; step += 1) {
    await touch(client, 'touchMove', [{ x, y: y - step * 10, id: 1 }]);
    await page.waitForTimeout(50);
  }
  await touch(client, 'touchEnd', []);

  await expect.poll(() => scrollY(page)).toBeGreaterThan(before + 50);
  await expect.poll(() => firstContactPushFrames(page), { timeout: 30_000 }).toBeGreaterThan(0);
  // The Input ends the push once the fling settles (SHA-229).
  await expect(page.locator('[data-push-count]')).toHaveText('Input pushes: 1 started, 1 ended', {
    timeout: 30_000,
  });
});

test('a tap on an opted-in scene pushes nothing', async ({ page }) => {
  const { client, x, y } = await open(page);

  await touch(client, 'touchStart', [{ x, y, id: 1 }]);
  await page.waitForTimeout(200);
  await touch(client, 'touchEnd', []);

  await expect.poll(() => firstContactPushFrames(page), { timeout: 30_000 }).toBe(0);
});
