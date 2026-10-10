import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

/**
 * The Performant feature card's story (SHA-215): a hover streams a band of
 * work in under the chip, which keeps flowing while the pointer stays and
 * runs dry once it leaves, back to the still frame with no work showing. A
 * hover during that ending doesn't cut it short. Touch and reduced motion
 * leave the still frame. Checks count the particles showing and watch them
 * move, never how long anything takes or its curve, so tuning the motion
 * cannot break this.
 */

// No check here needs a scene, so this file turns WebGL off, as
// favorites-card-tab.spec.ts does. The hero keeps its poster rather than
// drawing full-width Aurora on CI's CPU renderer. A launch option forces a
// new browser, so it has to be set for the whole file.
test.use({ launchOptions: { args: ['--disable-webgl'] } });

const featuresList = (page: Page) =>
  page.getByRole('list', { name: 'We’ll handle the complex stuff' });

const performantCard = (page: Page) =>
  featuresList(page)
    .getByRole('listitem')
    .filter({ has: page.getByRole('heading', { name: 'Performant' }) });

// The illustration around the band of work the story streams.
const illustration = (card: Locator) =>
  card.locator('[aria-hidden="true"]').filter({ has: card.page().locator('[data-band]') });

// Scrolls the features section to the middle of the viewport, twice, for the
// reason favorites-hover.spec.ts gives: the section rides in the hero's
// sticky pin, and the hero finishes its change a frame after the first
// scroll, which moves the section again.
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

/** Moves the pointer off the card, onto the site header. */
async function leave(page: Page): Promise<void> {
  await page.mouse.move(0, 0);
}

/** The band on one frame. */
interface BandFrame {
  /** How many particles show. */
  showing: number;
  /** The band's particles' places, summed, which changes whenever one moves. */
  places: number;
}

interface BandRecord {
  /** Every frame so far, oldest first. */
  all: () => Promise<BandFrame[]>;
  /** The latest frame. */
  now: () => Promise<BandFrame>;
}

// Records the band on every frame from the moment this is called: how many
// of its particles show, and where they all are.
async function recordBand(card: Locator): Promise<BandRecord> {
  await card.evaluate((cardElement) => {
    const frames: BandFrame[] = [];
    const lanes = [...cardElement.querySelector('[data-band]')!.children];
    const measure = () => {
      const styles = lanes.map((lane) => getComputedStyle(lane));

      frames.push({
        showing: styles.filter((style) => Number(style.opacity) > 0).length,
        places: styles.reduce((sum, style) => sum + new DOMMatrix(style.transform).m42, 0),
      });
      requestAnimationFrame(measure);
    };

    (window as unknown as { bandFrames: BandFrame[] }).bandFrames = frames;
    measure();
  });

  const all = () =>
    card.page().evaluate(() => (window as unknown as { bandFrames: BandFrame[] }).bandFrames);

  return { all, now: async () => (await all()).at(-1)! };
}

/** How many particles the band holds once it has filled. */
const bandSize = (card: Locator) => card.locator('[data-band] > *').count();

/**
 * A picture of the illustration, a pixel inside its box, so a box that falls
 * between device pixels never pulls in the card around the window.
 */
async function screenshotIllustration(card: Locator): Promise<Buffer> {
  const box = (await illustration(card).boundingBox())!;

  return card.page().screenshot({
    clip: { x: box.x + 1, y: box.y + 1, width: box.width - 2, height: box.height - 2 },
  });
}

/** Expects no particle to have shown the whole time. */
function expectStillThroughout(frames: BandFrame[]): void {
  expect(frames.length).toBeGreaterThan(0);
  expect(frames.filter((frame) => frame.showing > 0)).toEqual([]);
}

// ---------------------------------------------
// Hover
// ---------------------------------------------

test('a hover plays the story, which runs dry after the pointer leaves', async ({ page }) => {
  await open(page);

  const card = performantCard(page);
  const stillFrame = await screenshotIllustration(card);
  const band = await recordBand(card);

  expect((await band.now()).showing).toBe(0);

  await card.hover();
  await expect.poll(async () => (await band.now()).showing).toBeGreaterThan(0);

  // The band carries on after the pointer leaves, its particles still
  // moving, then runs dry and stays empty.
  const framesBeforeLeaving = (await band.all()).length;

  await leave(page);
  await expect.poll(async () => (await band.now()).showing).toBe(0);

  const ending = (await band.all()).slice(framesBeforeLeaving);
  const stillShowing = ending.filter((frame) => frame.showing > 0);

  expect(new Set(stillShowing.map((frame) => frame.places)).size).toBeGreaterThan(1);

  const afterTheStory = await recordBand(card);

  await page.waitForTimeout(1_000);
  expectStillThroughout(await afterTheStory.all());
  expect(await screenshotIllustration(card)).toEqual(stillFrame);
});

// A restart would cut the drain short, emptying the band at once, or bring
// particles back into it while it drains. The check fills the band, leaves
// and comes straight back, then reads every frame from the leave: the band
// empties a few particles at a time and never refills until it has run
// dry, and the story plays again after that, because the pointer is on the
// card.
test('a hover during the ending lets the band run dry before it plays again', async ({ page }) => {
  await open(page);

  const card = performantCard(page);
  const band = await recordBand(card);
  const filled = await bandSize(card);

  await card.hover();
  await expect.poll(async () => (await band.now()).showing).toBe(filled);

  const framesBeforeLeaving = (await band.all()).length;

  await leave(page);
  await card.hover();
  // The pointer is back while the band still drains.
  expect((await band.now()).showing).toBeGreaterThan(0);

  const ranDryThenPlayed = async () => {
    const since = (await band.all()).slice(framesBeforeLeaving);
    const dry = since.findIndex((frame) => frame.showing === 0);

    return dry >= 0 && since.slice(dry).some((frame) => frame.showing > 0);
  };

  await expect.poll(ranDryThenPlayed).toBe(true);

  const since = (await band.all()).slice(framesBeforeLeaving);
  const draining = since.slice(
    0,
    since.findIndex((frame) => frame.showing === 0),
  );

  expect(draining.some((frame) => frame.showing > 0 && frame.showing < filled)).toBe(true);
  draining.forEach((frame, index) => {
    expect(frame.showing).toBeLessThanOrEqual(draining[index - 1]?.showing ?? filled);
  });
});

test('the story keeps going while the pointer stays', async ({ page }) => {
  await open(page);

  const card = performantCard(page);
  const band = await recordBand(card);

  await card.hover();
  await expect.poll(async () => (await band.now()).showing).toBeGreaterThan(0);
  await page.waitForTimeout(3_000);

  const before = await band.now();

  await expect.poll(async () => (await band.now()).places).not.toBe(before.places);
  expect((await band.now()).showing).toBeGreaterThan(0);
});

// ---------------------------------------------
// Touch
// ---------------------------------------------

// A touch browser still fires mouse events around a tap, so the spec tries
// a hover as well as the tap itself. Nothing should happen, so there is
// nothing to wait on, and the spec gives the page a second, as
// favorites-card-tab.spec.ts does.
test.describe('on a touch device', () => {
  test.use({ hasTouch: true, isMobile: true });

  test('a hover or a tap leaves the card on its still frame', async ({ page }) => {
    await open(page);

    const card = performantCard(page);
    const stillFrame = await screenshotIllustration(card);
    const band = await recordBand(card);

    await card.hover();
    await card.tap();
    await page.waitForTimeout(1_000);

    expectStillThroughout(await band.all());
    expect(await screenshotIllustration(card)).toEqual(stillFrame);
  });
});

// A touch-screen laptop passes the hover gate, because its primary pointer
// is the trackpad, so only the story's own check keeps a tap from playing
// it. Chromium's touch emulation fails the gate's query, so the spec answers
// it for the page. A mouse hover at the end proves the gate was open all
// along.
test.describe('on a touch-screen laptop', () => {
  test.use({ hasTouch: true });

  test('a tap leaves the card on its still frame, and a mouse hover plays it', async ({ page }) => {
    await page.addInitScript(() => {
      const matchMedia = window.matchMedia.bind(window);

      window.matchMedia = (query) =>
        matchMedia(query === '(hover: hover) and (pointer: fine)' ? 'all' : query);
    });
    await open(page);

    const card = performantCard(page);
    const band = await recordBand(card);

    await card.tap();
    await page.waitForTimeout(1_000);
    expectStillThroughout(await band.all());

    await card.hover();
    await expect.poll(async () => (await band.now()).showing).toBeGreaterThan(0);
  });
});

// ---------------------------------------------
// Reduced motion
// ---------------------------------------------

test.describe('under reduced motion', () => {
  test('a hover leaves the card on its still frame', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page);

    const card = performantCard(page);
    const stillFrame = await screenshotIllustration(card);
    const band = await recordBand(card);

    await card.hover();
    await page.waitForTimeout(1_000);

    expectStillThroughout(await band.all());
    expect(await screenshotIllustration(card)).toEqual(stillFrame);
  });
});
