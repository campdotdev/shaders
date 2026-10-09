import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

/**
 * A favorite's card tab (SHA-184) shows on hover or focus and hides when the
 * card is let go, never on touch, and in place under reduced motion. Checks
 * read what shows and where it sits, never the slide's duration or curve,
 * so tuning the motion cannot break this file.
 */

// No check here needs a scene, so this file turns WebGL off, as
// hero-demo.spec.ts does. The hero keeps its poster rather than drawing
// full-width Aurora on CI's CPU renderer. Headless Chromium hands out no
// WebGPU adapter either, so the favorites stay posters too, and their card
// tabs never wait on a scene. A launch option forces a new browser, so it
// has to be set for the whole file.
test.use({ launchOptions: { args: ['--disable-webgl'] } });

// Each favorite's short name, in the grid's order.
const SHORT_NAMES = ['Simplex', 'Mesh', 'Waves', 'Voronoi', 'Dither', 'God Rays', 'LED Wall'];

const favoritesList = (page: Page) =>
  page.getByRole('list', { name: 'Add some fun to your website' });

const favorites = (page: Page) => favoritesList(page).getByRole('link');

const heading = (page: Page) => page.getByRole('heading', { name: 'Add some fun to your website' });

const cardTab = (favorite: Locator) => favorite.locator('[data-card-tab]');

// The card's window, which clips the card tab while it is out past the
// edge: the poster's parent.
const cardWindow = (favorite: Locator) => favorite.getByRole('img').locator('xpath=..');

// Scrolls the favorites' section to the top of the viewport, twice, for the
// reason favorites-hover.spec.ts gives: the section rides in the hero's
// sticky pin, and the hero finishes its change a frame after the first
// scroll, which moves the section again.
async function open(page: Page): Promise<void> {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await favoritesList(page).evaluate(async (list) => {
    const section = list.closest('section')!;
    const nextFrames = () =>
      new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    section.scrollIntoView({ block: 'start' });
    await nextFrames();
    section.scrollIntoView({ block: 'start' });
  });
}

/** Waits for the favorite's card tab to come to rest on the window's right edge. */
async function expectOnTheEdge(favorite: Locator): Promise<void> {
  await expect
    .poll(async () => {
      const [tabBox, windowBox] = [
        await cardTab(favorite).boundingBox(),
        await cardWindow(favorite).boundingBox(),
      ];

      return tabBox && windowBox
        ? Math.round(tabBox.x + tabBox.width - (windowBox.x + windowBox.width))
        : null;
    })
    .toBe(0);
}

// The longest short name, in CSS pixels, that the card tab's swell holds
// (favorites.module.css). A longer one would run past the outline.
const LONGEST_SHORT_NAME = 60;

// The distinct transforms the favorite's card tab has had, read on every
// DOM change from the moment this is called, so the spec sees every frame
// Motion writes rather than only where the card tab ends up.
async function recordCardTabTransforms(favorite: Locator): Promise<() => Promise<string[]>> {
  await favorite.evaluate((link) => {
    const seen = new Set<string>();

    (window as unknown as { cardTabTransforms: Set<string> }).cardTabTransforms = seen;
    new MutationObserver(() => {
      const tab = link.querySelector('[data-card-tab]');

      if (tab) seen.add(getComputedStyle(tab).transform);
    }).observe(link, { attributes: true, childList: true, subtree: true });
  });

  return () =>
    favorite
      .page()
      .evaluate(() => [
        ...(window as unknown as { cardTabTransforms: Set<string> }).cardTabTransforms,
      ]);
}

// ---------------------------------------------
// Hover and focus
// ---------------------------------------------

test('hovering a favorite slides its card tab in with its short name, and leaving hides it', async ({
  page,
}) => {
  await open(page);

  const favorite = favorites(page).first();

  await expect(cardTab(favorite)).toBeHidden();

  const readTransforms = await recordCardTabTransforms(favorite);

  await favorite.hover();

  await expect(cardTab(favorite)).toBeVisible();
  await expect(cardTab(favorite)).toHaveText('Simplex');
  await expectOnTheEdge(favorite);
  // It slid in, so it moved on its way to the edge.
  expect((await readTransforms()).length).toBeGreaterThan(1);
  // The card tab is hidden from screen readers, so the link keeps the full
  // label as its name.
  await expect(favorite).toHaveAccessibleName('Simplex Noise');

  // The heading sits outside every card.
  await heading(page).hover();
  await expect(cardTab(favorite)).toBeHidden();
});

// The first favorite is focused from script only to start the Tab order
// there. The second gets its focus from a Tab press, the way a keyboard
// visitor reaches it, and loses it to the next one.
test('tabbing to a favorite shows its card tab, and tabbing on hides it', async ({ page }) => {
  await open(page);

  const [first, second] = await favorites(page).all();

  await first!.focus();
  await page.keyboard.press('Tab');
  await expect(second!).toBeFocused();

  await expect(cardTab(second!)).toBeVisible();
  await expect(cardTab(second!)).toHaveText('Mesh');
  await expectOnTheEdge(second!);
  await expect(cardTab(first!)).toBeHidden();

  await page.keyboard.press('Tab');
  await expect(cardTab(second!)).toBeHidden();
});

test('each favorite shows its own short name, one at a time, inside the swell', async ({
  page,
}) => {
  await open(page);

  const links = await favorites(page).all();

  expect(links).toHaveLength(SHORT_NAMES.length);

  for (const [index, link] of links.entries()) {
    await link.hover();
    await expect(cardTab(link)).toHaveText(SHORT_NAMES[index]!);
    await expect(favoritesList(page).locator('[data-card-tab]:visible')).toHaveCount(1);
    await expect(cardTab(link)).toBeVisible();

    // The name reads bottom to top, so its box's height is its length.
    const nameBox = await cardTab(link).locator('span').boundingBox();

    expect(nameBox!.height).toBeLessThanOrEqual(LONGEST_SHORT_NAME);
  }
});

// ---------------------------------------------
// A narrow desktop
// ---------------------------------------------

// At 1024px the grid still has four columns, and each card's window is about
// 143px tall, shorter than the outline's 168px plus its 16px foot. The card
// tab shortens to fit rather than running out past the window's top, where
// the window would clip the card tab's head.
test.describe('on a narrow desktop', () => {
  test.use({ viewport: { width: 1024, height: 768 } });

  test('the card tab fits inside its window', async ({ page }) => {
    await open(page);

    const favorite = favorites(page).first();

    await favorite.hover();
    await expect(cardTab(favorite)).toBeVisible();
    await expectOnTheEdge(favorite);

    const [tabBox, windowBox] = [
      (await cardTab(favorite).boundingBox())!,
      (await cardWindow(favorite).boundingBox())!,
    ];

    expect(tabBox.y).toBeGreaterThanOrEqual(windowBox.y);
    expect(tabBox.y + tabBox.height).toBeLessThanOrEqual(windowBox.y + windowBox.height);
  });
});

// ---------------------------------------------
// Touch
// ---------------------------------------------

// A touch browser still fires mouse and focus events around a tap, so the
// spec tries a hover and a focus as well as the tap itself. The click that
// follows the tap is stopped before it navigates, so the spec can watch the
// favorites after it.
test.describe('on a touch device', () => {
  test.use({ hasTouch: true, isMobile: true });

  test('no favorite shows a card tab', async ({ page }) => {
    await open(page);

    const favorite = favorites(page).first();

    await page.evaluate(() =>
      document.addEventListener('click', (event) => event.preventDefault(), { capture: true }),
    );
    await favorite.hover();
    await favorite.focus();
    await favorite.tap();
    // Nothing to wait on when nothing should happen, so the spec gives the
    // page a second, as favorites-hover.spec.ts does for its scenes.
    await page.waitForTimeout(1_000);

    await expect(favoritesList(page).locator('[data-card-tab]:visible')).toHaveCount(0);
  });
});

// ---------------------------------------------
// Reduced motion
// ---------------------------------------------

test.describe('under reduced motion', () => {
  test('the card tab appears and leaves in place, with no change to its transform', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page);

    const favorite = favorites(page).first();
    const readTransforms = await recordCardTabTransforms(favorite);

    await favorite.hover();

    await expect(cardTab(favorite)).toBeVisible();
    await expect(cardTab(favorite)).toHaveCSS('opacity', '1');
    await expectOnTheEdge(favorite);

    await heading(page).hover();
    await expect(cardTab(favorite)).toBeHidden();

    expect(await readTransforms()).toEqual(['none']);
  });
});
