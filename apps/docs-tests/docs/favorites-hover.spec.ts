import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

/**
 * The homepage favorites come alive on hover (SHA-183): the scene mounts under
 * its poster on hover or focus, pauses when the visitor leaves, stays paused
 * when another favorite plays, and never mounts on touch. The no-WebGPU case
 * is in homepage.spec.ts, which runs without the adapter this file turns on.
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

// The elements under the favorites list that match `selector`, counted on
// each DOM change from the moment this is called, so the spec sees the most
// the page ever held at once rather than only the count when it looks.
async function trackMostMatching(page: Page, selector: string): Promise<() => Promise<number>> {
  await favoritesList(page).evaluate((list, matching) => {
    const tracked = window as unknown as { mostMatching: number };
    const count = () => list.querySelectorAll(matching).length;

    tracked.mostMatching = count();
    new MutationObserver(() => {
      tracked.mostMatching = Math.max(tracked.mostMatching, count());
    }).observe(list, { attributes: true, childList: true, subtree: true });
  }, selector);

  return () => page.evaluate(() => (window as unknown as { mostMatching: number }).mostMatching);
}

// A live scene that is playing, rather than paused on its frame.
const PLAYING_SCENE = '[data-scene]:not([data-paused])';

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
// One playing favorite at a time
// ---------------------------------------------

// Every favorite a visitor engages keeps its scene, paused on its last
// frame, so its card never falls back to the poster. Only one plays. The
// first half waits for a paint, so the paused card shows a drawn frame. The
// sweep after it checks only the counts, before any of those scenes paint.
test('one favorite plays at a time, and the ones before it stay paused, not posters', async ({
  page,
}) => {
  await open(page);

  const readMostPlaying = await trackMostMatching(page, PLAYING_SCENE);
  const links = await favorites(page).all();
  const [first, second] = links;

  // A second favorite takes over from one whose scene is playing. The first
  // keeps its canvas, paused, with its poster still faded.
  await first!.hover();
  await expect(scene(first!)).toHaveAttribute('data-scene', 'painted', { timeout: 30_000 });
  await second!.hover();
  await expect(second!.locator('canvas')).toHaveCount(1);
  await expect(scene(first!)).toHaveAttribute('data-paused');
  await expect(first!.locator('canvas')).toHaveCount(1);
  await expect(poster(first!)).toHaveCSS('opacity', '0');

  // Then every favorite is hovered, and a few focused, without waiting for
  // any scene to paint. The last one focused is the one that plays.
  for (const link of links) await link.hover();
  for (const link of links.slice(0, 3)) await link.focus();

  await expect(favoritesList(page).locator('canvas')).toHaveCount(links.length);
  await expect(favoritesList(page).locator(PLAYING_SCENE)).toHaveCount(1);
  await expect(scene(links[2]!)).not.toHaveAttribute('data-paused');
  expect(await readMostPlaying()).toBe(1);
});

test('when the playing favorite loses focus, the one under the pointer plays', async ({ page }) => {
  await open(page);

  const [hovered, focused] = await favorites(page).all();

  await hovered!.hover();
  await focused!.focus();
  await expect(scene(focused!)).not.toHaveAttribute('data-paused');
  await expect(scene(hovered!)).toHaveAttribute('data-paused');

  await focused!.blur();
  await expect(scene(focused!)).toHaveAttribute('data-paused');
  await expect(scene(hovered!)).not.toHaveAttribute('data-paused');
});

// ---------------------------------------------
// Touch
// ---------------------------------------------

test.describe('on a touch device', () => {
  test.use({ hasTouch: true, isMobile: true });

  test('no favorite mounts a scene, and a tap opens the component page', async ({ page }) => {
    await open(page);

    const readMostCanvases = await trackMostMatching(page, 'canvas');
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

// A touch-screen laptop passes the hover gate, because its primary pointer
// is the trackpad, so only the card's own checks keep a tap from going live.
// Chromium's touch emulation fails the gate's query, so the spec answers it
// for the page. The click that follows a tap is stopped before it navigates,
// so the spec can watch the favorites after it. A mouse hover at the end
// proves the gate was open all along.
test.describe('on a touch-screen laptop', () => {
  test.use({ hasTouch: true });

  test('a tap never mounts a scene, and a mouse hover still does', async ({ page }) => {
    await page.addInitScript(() => {
      const matchMedia = window.matchMedia.bind(window);

      window.matchMedia = (query) =>
        matchMedia(query === '(hover: hover) and (pointer: fine)' ? 'all' : query);
    });
    await open(page);

    expect(
      await page.evaluate(() => matchMedia('(hover: hover) and (pointer: fine)').matches),
    ).toBe(true);

    const readMostCanvases = await trackMostMatching(page, 'canvas');
    const favorite = favorites(page).first();

    await page.evaluate(() =>
      document.addEventListener('click', (event) => event.preventDefault(), { capture: true }),
    );
    await favorite.tap();
    await expect(favorite).toBeFocused();
    // As above, the time a desktop favorite takes to mount its canvas.
    await page.waitForTimeout(1_000);
    expect(await readMostCanvases()).toBe(0);

    await favorite.hover();
    await expect(favorite.locator('canvas')).toHaveCount(1);
  });
});
