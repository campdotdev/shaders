import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

/**
 * The Reactive feature card's story (SHA-216). A hover sends the arrow off
 * the window and back in to the pointer, which it follows until the pointer
 * leaves. Then it swoops back along the J to the still frame. A hover during
 * that ending lets it land, then plays again. A touch that scrolls the page
 * over the card hides the arrow and stirs the smudge until the page stops.
 * Under reduced motion the card shows its still image, with no live scene.
 * Checks read where the story is and where the arrow is from the
 * illustration's data attributes, never how long anything takes or its
 * curve, so tuning the motion cannot break this.
 */

// The card's live scene needs a WebGPU adapter. Headless Chromium hands out
// none, so this flag turns on its SwiftShader adapter, as
// favorites-hover.spec.ts does. A launch option forces a new browser, so it
// has to be set for the whole file.
test.use({ launchOptions: { args: ['--enable-unsafe-webgpu'] } });

// SwiftShader draws on the CPU, so the scene's first frame and its smudge
// can take a while, and every wait on the story allows for that.
const SCENE_TIMEOUT = 60_000;
const STORY_TIMEOUT = 20_000;

const featuresList = (page: Page) =>
  page.getByRole('list', { name: 'We’ll handle the complex stuff' });

const reactiveCard = (page: Page) =>
  featuresList(page)
    .getByRole('listitem')
    .filter({ has: page.getByRole('heading', { name: 'Reactive' }) });

// The illustration, whose data attributes say where the story is.
const illustration = (card: Locator) => card.locator('[data-scene]');

const stage = (card: Locator) => illustration(card).getAttribute('data-stage');
const arrowLeg = (card: Locator) => illustration(card).getAttribute('data-arrow');

// Scrolls the features section to the middle of the viewport, twice, for the
// reason favorites-hover.spec.ts gives: the section rides in the hero's
// sticky pin, and the hero finishes its change a frame after the first
// scroll, which moves the section again. Off screen, the hero's scene
// pauses, which leaves SwiftShader to the card's.
async function open(page: Page): Promise<void> {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await featuresList(page).evaluate(async (list) => {
    const section = list.closest('section')!;
    const nextFrames = () =>
      new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    section.scrollIntoView({ block: 'center' });
    await nextFrames();
    section.scrollIntoView({ block: 'center' });
  });
}

/** Opens the page and waits for the card's live scene to show the still frame. */
async function openLive(page: Page): Promise<Locator> {
  await open(page);
  const card = reactiveCard(page);

  await expect(illustration(card)).toHaveAttribute('data-scene', 'laid', {
    timeout: SCENE_TIMEOUT,
  });

  return card;
}

/** Moves the pointer onto the illustration's middle. */
async function hover(card: Locator): Promise<void> {
  const box = (await illustration(card).boundingBox())!;

  await card.page().mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 4 });
}

/** Moves the pointer off the card, onto the site header. */
async function leave(page: Page): Promise<void> {
  await page.mouse.move(0, 0, { steps: 4 });
}

// Records the story's stage on every frame from the moment this is called.
async function recordStages(card: Locator): Promise<() => Promise<string[]>> {
  await illustration(card).evaluate((element) => {
    const stages: string[] = [];
    const record = () => {
      const current = element.getAttribute('data-stage') ?? '';

      if (stages.at(-1) !== current) stages.push(current);
      requestAnimationFrame(record);
    };

    (window as unknown as { stages: string[] }).stages = stages;
    record();
  });

  return () => card.page().evaluate(() => (window as unknown as { stages: string[] }).stages);
}

// ---------------------------------------------
// Hover
// ---------------------------------------------

test('a hover hands the arrow to the pointer, and leaving brings it back to the still frame', async ({
  page,
}) => {
  const card = await openLive(page);

  await hover(card);
  await expect.poll(() => stage(card)).toBe('holding');
  await expect.poll(() => arrowLeg(card), { timeout: STORY_TIMEOUT }).toBe('following');
  // The arrow stands in for the cursor once it follows the pointer.
  await expect(illustration(card)).toHaveCSS('cursor', 'none');

  await leave(page);
  await expect.poll(() => stage(card)).toBe('ending');
  await expect.poll(() => stage(card), { timeout: STORY_TIMEOUT }).toBe('still');
  expect(await arrowLeg(card)).toBe('resting');
});

test('a hover during the ending lets it land, then plays again', async ({ page }) => {
  const card = await openLive(page);

  await hover(card);
  await expect.poll(() => arrowLeg(card), { timeout: STORY_TIMEOUT }).toBe('following');

  const stages = await recordStages(card);

  await leave(page);
  await expect.poll(() => stage(card)).toBe('ending');
  await hover(card);
  // The pointer is back, but the ending carries on.
  expect(await stage(card)).toBe('ending');

  await expect.poll(stages, { timeout: STORY_TIMEOUT }).toEqual(['holding', 'ending', 'holding']);
});

// ---------------------------------------------
// Touch
// ---------------------------------------------

test.describe('on a touch device', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 412, height: 839 } });

  test('a touch that scrolls the page over the card stirs it, then it settles on the still frame', async ({
    page,
  }) => {
    const card = await openLive(page);
    const box = (await illustration(card).boundingBox())!;
    const client = await page.context().newCDPSession(page);
    const touch = (
      type: 'touchStart' | 'touchMove' | 'touchEnd',
      points: Array<{ x: number; y: number; id: number }>,
    ) => client.send('Input.dispatchTouchEvent', { type, touchPoints: points });
    const x = box.x + box.width / 2;
    const y = box.y + box.height * 0.7;
    const scrollBefore = await page.evaluate(() => window.scrollY);

    await touch('touchStart', [{ x, y, id: 1 }]);
    for (let step = 1; step <= 16; step += 1) {
      await touch('touchMove', [{ x, y: y - step * 12, id: 1 }]);
      await page.waitForTimeout(30);
    }

    await expect.poll(() => stage(card)).toBe('holding');
    expect(await arrowLeg(card)).toBe('pushing');
    await expect(illustration(card)).toHaveAttribute('data-arrow-hidden', 'true');

    await touch('touchEnd', []);
    await expect.poll(() => stage(card), { timeout: STORY_TIMEOUT }).toBe('still');
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(scrollBefore + 50);
  });
});

// ---------------------------------------------
// Reduced motion
// ---------------------------------------------

test.describe('under reduced motion', () => {
  test('the card shows its still image, and a hover leaves it there', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page);

    const card = reactiveCard(page);

    await expect(card.locator('img[src*="/features/reactive.png"]')).toBeVisible();
    await hover(card);
    await page.waitForTimeout(1_000);

    expect(await stage(card)).toBe('still');
    await expect(illustration(card)).toHaveAttribute('data-scene', 'still');
    await expect(card.locator('canvas')).toHaveCount(0);
  });
});
