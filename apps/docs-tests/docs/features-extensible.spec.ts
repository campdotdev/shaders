import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

/**
 * The Extensible feature card's story (SHA-214): a hover plays it, it keeps
 * going while the pointer stays, the play under way finishes after the pointer
 * leaves, and a second hover doesn't restart it. Touch and reduced motion
 * leave the still frame. Checks read how far the code has scrolled, never
 * how long a step takes or its curve, so tuning the motion cannot break this.
 */

// No check here needs a scene, so this file turns WebGL off, as
// favorites-card-tab.spec.ts does. The hero keeps its poster rather than
// drawing full-width Aurora on CI's CPU renderer. A launch option forces a
// new browser, so it has to be set for the whole file.
test.use({ launchOptions: { args: ['--disable-webgl'] } });

const featuresList = (page: Page) =>
  page.getByRole('list', { name: 'We’ll handle the complex stuff' });

const extensibleCard = (page: Page) =>
  featuresList(page)
    .getByRole('listitem')
    .filter({ has: page.getByRole('heading', { name: 'Extensible' }) });

// The illustration around the column of code the story scrolls.
const illustration = (card: Locator) =>
  card.locator('[aria-hidden="true"]').filter({ has: card.page().locator('[data-lines]') });

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

interface ScrollRecord {
  /** Every measurement so far, oldest first. */
  all: () => Promise<number[]>;
  /** The latest measurement. */
  now: () => Promise<number>;
}

// Measures how far the code has scrolled on every frame from the moment this
// is called, in lines: 0 at the still frame, and one more for each step up.
// Each play mounts a fresh column, so every frame looks the column up again.
async function recordScroll(card: Locator): Promise<ScrollRecord> {
  await card.evaluate((cardElement) => {
    const lines: number[] = [];
    const measure = () => {
      const column = cardElement.querySelector('[data-lines]')!;
      const lineHeight = column.firstElementChild!.getBoundingClientRect().height;

      lines.push(-new DOMMatrix(getComputedStyle(column).transform).m42 / lineHeight);
      requestAnimationFrame(measure);
    };

    (window as unknown as { scrolledLines: number[] }).scrolledLines = lines;
    measure();
  });

  const all = () =>
    card.page().evaluate(() => (window as unknown as { scrolledLines: number[] }).scrolledLines);

  return { all, now: async () => (await all()).at(-1)! };
}

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

/** Expects the code to have stayed on the still frame the whole time. */
function expectStillThroughout(lines: number[]): void {
  expect(lines.length).toBeGreaterThan(0);
  expect(lines.filter((scrolled) => scrolled !== 0)).toEqual([]);
}

// ---------------------------------------------
// Hover
// ---------------------------------------------

test('a hover plays the story, which finishes after the pointer leaves', async ({ page }) => {
  await open(page);

  const card = extensibleCard(page);
  const stillFrame = await screenshotIllustration(card);
  const scroll = await recordScroll(card);

  await card.hover();
  await expect.poll(scroll.now).toBeGreaterThan(0.5);

  // The play under way carries on after the pointer leaves, then lands back
  // on the still frame and stays there.
  await leave(page);

  const whenLeft = await scroll.now();

  await expect.poll(scroll.now).toBeGreaterThan(whenLeft);
  await expect.poll(scroll.now).toBeCloseTo(0);

  const afterTheStory = await recordScroll(card);

  await page.waitForTimeout(1_000);
  expectStillThroughout(await afterTheStory.all());
  expect(await screenshotIllustration(card)).toEqual(stillFrame);
});

// A restart would put the code back at the still frame mid-play. The check
// takes the scroll just before the pointer leaves, then watches every frame
// for a moment after it comes back, all well inside one play, for any frame
// that has gone back toward the still frame.
test('a hover during a play does not restart it', async ({ page }) => {
  await open(page);

  const card = extensibleCard(page);
  const scroll = await recordScroll(card);

  await card.hover();
  await expect.poll(scroll.now, { intervals: [50] }).toBeGreaterThan(1.5);

  const beforeLeaving = await scroll.now();
  const framesBeforeLeaving = (await scroll.all()).length;

  await leave(page);
  await card.hover();
  // A few frames for a restart to show.
  await page.waitForTimeout(200);

  const framesSince = (await scroll.all()).slice(framesBeforeLeaving);

  expect(Math.min(...framesSince)).toBeGreaterThanOrEqual(beforeLeaving);
});

// A second play shows as the code back at the still frame after it had
// scrolled, then scrolling again, all with the pointer still on the card.
test('the story keeps going while the pointer stays', async ({ page }) => {
  await open(page);

  const card = extensibleCard(page);
  const scroll = await recordScroll(card);

  await card.hover();

  await expect
    .poll(
      async () => {
        const lines = await scroll.all();
        const scrolled = lines.findIndex((scrolledLines) => scrolledLines > 0.5);
        const backAtStillFrame = lines.findIndex(
          (scrolledLines, index) => index > scrolled && scrolledLines < 0.05,
        );

        return (
          scrolled >= 0 &&
          backAtStillFrame >= 0 &&
          lines.some((scrolledLines, index) => index > backAtStillFrame && scrolledLines > 0.5)
        );
      },
      { timeout: 10_000 },
    )
    .toBe(true);
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

    const card = extensibleCard(page);
    const scroll = await recordScroll(card);

    await card.hover();
    await card.tap();
    await page.waitForTimeout(1_000);

    expectStillThroughout(await scroll.all());
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

    const card = extensibleCard(page);
    const scroll = await recordScroll(card);

    await card.tap();
    await page.waitForTimeout(1_000);
    expectStillThroughout(await scroll.all());

    await card.hover();
    await expect.poll(scroll.now).toBeGreaterThan(0.5);
  });
});

// ---------------------------------------------
// Reduced motion
// ---------------------------------------------

test.describe('under reduced motion', () => {
  test('a hover leaves the card on its still frame', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page);

    const card = extensibleCard(page);
    const scroll = await recordScroll(card);

    await card.hover();
    await page.waitForTimeout(1_000);

    expectStillThroughout(await scroll.all());
  });
});
