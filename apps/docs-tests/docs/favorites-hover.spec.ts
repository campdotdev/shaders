import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

/**
 * The homepage favorites come alive on hover (SHA-183): hovering or focusing a
 * favorite mounts its live scene, the poster stays up until the scene's first
 * frame, the scene pauses when the visitor leaves, at most one favorite holds
 * a canvas, and a touch device never mounts one. The case with no WebGPU
 * lives in homepage.spec.ts, because it needs the browser this file turns
 * WebGPU on for.
 */

// Headless Chromium exposes navigator.gpu but hands out no adapter, so the
// favorites would stay posters. This flag turns on its SwiftShader adapter,
// on macOS and on CI's Linux alike. A launch option forces a new browser, so
// it has to be set for the whole file.
test.use({ launchOptions: { args: ['--enable-unsafe-webgpu'] } });

const favoritesList = (page: Page) =>
  page.getByRole('list', { name: 'Start with one of our favorites' });

const favorites = (page: Page) => favoritesList(page).getByRole('link');

const poster = (favorite: Locator) => favorite.getByRole('img');

// The live scene's layer, which says through `data-scene` whether its first
// frame is on screen.
const scene = (favorite: Locator) => favorite.locator('[data-scene]');

// The favorites' section is scrolled to the top of the viewport, which takes
// the hero off screen, and ShaderScene pauses a scene it cannot see. On
// SwiftShader the full-width Aurora hero otherwise takes every CPU cycle, and
// a favorite's renderer never finishes starting. The section is what scrolls,
// because the list itself is `display: contents` and has no box to scroll to.
async function open(page: Page): Promise<void> {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await favoritesList(page).evaluate((list) =>
    list.closest('section')!.scrollIntoView({ block: 'start' }),
  );
}

// Every canvas under the favorites list, counted on each DOM change from the
// moment this is called, so the spec sees the most the page ever held at once
// rather than only the count when it looks.
async function trackMostCanvases(page: Page): Promise<() => Promise<number>> {
  await favoritesList(page).evaluate((list) => {
    const tracked = window as unknown as { mostFavoriteCanvases: number };
    const count = () => list.querySelectorAll('canvas').length;

    tracked.mostFavoriteCanvases = count();
    new MutationObserver(() => {
      tracked.mostFavoriteCanvases = Math.max(tracked.mostFavoriteCanvases, count());
    }).observe(list, { childList: true, subtree: true });
  });

  return () =>
    page.evaluate(
      () => (window as unknown as { mostFavoriteCanvases: number }).mostFavoriteCanvases,
    );
}

// What the favorite looked like the moment its canvas was added, read inside
// the DOM change that added it, before the renderer could start up.
async function recordCanvasMount(favorite: Locator): Promise<() => Promise<unknown>> {
  await favorite.evaluate((link) => {
    const tracked = window as unknown as { canvasMount?: unknown };

    new MutationObserver((_mutations, observer) => {
      if (!link.querySelector('canvas')) return;
      observer.disconnect();
      tracked.canvasMount = {
        scene: link.querySelector('[data-scene]')?.getAttribute('data-scene'),
        posterOpacity: getComputedStyle(link.querySelector('img')!).opacity,
      };
    }).observe(link, { childList: true, subtree: true });
  });

  return () =>
    favorite.page().evaluate(() => (window as unknown as { canvasMount?: unknown }).canvasMount);
}

// ---------------------------------------------
// Hover and focus
// ---------------------------------------------

test('hovering a favorite mounts its scene behind the poster until the first frame', async ({
  page,
}) => {
  await open(page);

  const favorite = favorites(page).first();

  await expect(favorite.locator('canvas')).toHaveCount(0);

  const readCanvasMount = await recordCanvasMount(favorite);

  await favorite.hover();

  await expect(favorite.locator('canvas')).toHaveCount(1);
  expect(await readCanvasMount()).toEqual({ scene: 'loading', posterOpacity: '1' });

  // The renderer starts up on SwiftShader, which takes seconds on CI.
  await expect(scene(favorite)).toHaveAttribute('data-scene', 'painted', { timeout: 30_000 });
  await expect(poster(favorite)).toHaveCSS('opacity', '0');
  // The poster still names the link once it has faded.
  await expect(favorite).toHaveAccessibleName('Simplex Noise');
});

test('focusing a favorite mounts its scene behind the poster until the first frame', async ({
  page,
}) => {
  await open(page);

  const favorite = favorites(page).nth(1);
  const readCanvasMount = await recordCanvasMount(favorite);

  await favorite.focus();

  await expect(favorite.locator('canvas')).toHaveCount(1);
  expect(await readCanvasMount()).toEqual({ scene: 'loading', posterOpacity: '1' });
  await expect(scene(favorite)).toHaveAttribute('data-scene', 'painted', { timeout: 30_000 });
  await expect(poster(favorite)).toHaveCSS('opacity', '0');
});

// ---------------------------------------------
// Pausing when the visitor leaves
// ---------------------------------------------

// The scene freezes on its current frame rather than unmounting, so the
// spec marks the canvas and checks the same one plays again. The frozen
// frame itself is the package's to prove: the shader-scene unit tests check
// that a paused scene draws nothing and loses no time.
test('leaving a favorite pauses its scene, and coming back resumes the same one', async ({
  page,
}) => {
  await open(page);

  const favorite = favorites(page).first();

  await favorite.hover();
  await expect(scene(favorite)).toHaveAttribute('data-scene', 'painted', { timeout: 30_000 });
  await expect(scene(favorite)).not.toHaveAttribute('data-paused');
  await favorite.locator('canvas').evaluate((canvas) => {
    canvas.dataset.firstMount = 'true';
  });

  // The heading sits outside every card.
  await page.getByRole('heading', { name: 'Start with one of our favorites' }).hover();
  await expect(scene(favorite)).toHaveAttribute('data-paused');
  await expect(favorite.locator('canvas')).toHaveCount(1);

  await favorite.hover();
  await expect(scene(favorite)).not.toHaveAttribute('data-paused');
  await expect(favorite.locator('canvas[data-first-mount]')).toHaveCount(1);
});

test('a favorite that loses keyboard focus pauses its scene', async ({ page }) => {
  await open(page);

  const favorite = favorites(page).nth(1);

  await favorite.focus();
  await expect(scene(favorite)).toHaveAttribute('data-scene', 'painted', { timeout: 30_000 });
  await favorite.blur();

  await expect(scene(favorite)).toHaveAttribute('data-paused');
});

// ---------------------------------------------
// One live favorite at a time
// ---------------------------------------------

test('at most one favorite holds a canvas', async ({ page }) => {
  await open(page);

  const readMostCanvases = await trackMostCanvases(page);
  const links = await favorites(page).all();
  const [first, second] = links;

  // A second favorite takes over from one whose scene is playing, and the
  // first returns to its poster at once.
  await first!.hover();
  await expect(scene(first!)).toHaveAttribute('data-scene', 'painted', { timeout: 30_000 });
  await second!.hover();
  await expect(second!.locator('canvas')).toHaveCount(1);
  await expect(first!.locator('canvas')).toHaveCount(0);
  await expect(poster(first!)).toHaveCSS('opacity', '1');

  // Then every favorite is hovered, and a few focused, without waiting for
  // any scene to paint, so each one takes over from a scene still starting.
  for (const link of links) await link.hover();
  for (const link of links.slice(0, 3)) await link.focus();

  const lastFocused = links[2]!;

  await expect(lastFocused.locator('canvas')).toHaveCount(1);
  await expect(scene(lastFocused)).toHaveAttribute('data-scene', 'painted', { timeout: 30_000 });
  await expect(favoritesList(page).locator('canvas')).toHaveCount(1);
  expect(await readMostCanvases()).toBe(1);
});

// ---------------------------------------------
// Touch
// ---------------------------------------------

test.describe('on a touch device', () => {
  test.use({ hasTouch: true, isMobile: true });

  test('no favorite mounts a scene, and a tap opens the component page', async ({ page }) => {
    await open(page);

    const readMostCanvases = await trackMostCanvases(page);
    const favorite = favorites(page).first();

    // A touch browser still fires focus and mouse events on a tap, so both
    // are tried before the tap itself.
    await favorite.hover();
    await favorite.focus();
    // Nothing to wait on when nothing should happen, so the spec gives the
    // page the time a desktop favorite takes to mount its canvas.
    await page.waitForTimeout(1_000);
    expect(await readMostCanvases()).toBe(0);

    await favorite.tap();

    // The component page runs two scenes, the banner and the demo, so it can
    // be slow to load on CI's software renderer (the "Open site chrome from a
    // static route" section of docs/development/visual-regression.md).
    await expect(page).toHaveURL('/components/simplex-noise', { timeout: 30_000 });
  });
});
