import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * The homepage hero turns into Aurora's demo on scroll (SHA-187). On a wide
 * window the hero pins and scroll morphs it into the demo, with the control
 * panel beside the scene. On a phone and under reduced motion the finished
 * demo sits in the page's flow with no pin. Every check is on where things
 * sit and what the controls hold, never on how long the change takes or the
 * curve it follows, so tuning the motion cannot break this file.
 */

// Headless Chromium hands out no WebGPU adapter, so the hero's renderer falls
// back to WebGL2, which on CI's GPU-less runners is SwiftShader drawing
// full-width Aurora on the CPU, at about one frame every 6 seconds. A check
// that scrolls waits on a frame, so those checks outran their 5-second
// budget. No check reads the scene's pixels, so this file turns WebGL off: the
// renderer fails to start and the hero keeps its poster, the same layout
// with nothing to draw. A launch option forces a new browser, so it has to
// be set for the whole file.
test.use({ launchOptions: { args: ['--disable-webgl'] } });

// The site container's width at Playwright's 1280px viewport: the page's
// two 32px gutters come off it.
const WIDE_CONTAINER = 1280 - 2 * 32;

const scene = (page: Page) => page.locator('[data-home-hero]');

const panel = (page: Page) => page.getByRole('group', { name: 'Shader controls' });

const speed = (page: Page) => panel(page).getByRole('slider', { name: 'Speed' });

// The hero's frame: the scene's parent, which carries the hero's inset and
// border before the change and fits the scene once the demo lands.
const frame = (page: Page) => scene(page).locator('xpath=..');

async function open(page: Page): Promise<void> {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
}

// Scrolls to where the pin releases and the demo has landed: the track's
// bottom, less the pin's height. The pin is the track's first child, and
// the track is the element that says whether the hero pins.
async function scrollToLanded(page: Page): Promise<void> {
  await page.evaluate(() => {
    const track = document.querySelector<HTMLElement>('[data-pinned]')!;
    const pin = track.firstElementChild as HTMLElement;
    const top = track.getBoundingClientRect().top + window.scrollY;

    window.scrollTo(0, top + track.offsetHeight - pin.offsetHeight);
  });
}

async function box(page: Page, locator: ReturnType<typeof scene>) {
  const found = await locator.boundingBox();

  expect(found).not.toBeNull();

  return found!;
}

// ---------------------------------------------
// A wide window: the hero pins and turns into the demo
// ---------------------------------------------

test.describe('on a wide window', () => {
  test('the hero starts full width, with the panel out of view', async ({ page }) => {
    await open(page);

    await expect(page.locator('[data-pinned]')).toHaveAttribute('data-pinned', 'true');
    expect((await box(page, frame(page))).width).toBeCloseTo(WIDE_CONTAINER, 0);
    await expect(panel(page)).not.toBeInViewport();
  });

  test('scrolled through the pin, the panel sits beside the scene and its controls work', async ({
    page,
  }) => {
    await open(page);
    await scrollToLanded(page);

    await expect(panel(page)).toBeInViewport();
    await expect
      .poll(async () => {
        const [sceneBox, panelBox] = [await box(page, scene(page)), await box(page, panel(page))];

        return {
          beside: panelBox.x >= sceneBox.x + sceneBox.width,
          top: Math.round(panelBox.y - sceneBox.y),
          shape: Math.round((sceneBox.width / sceneBox.height) * 100) / 100,
        };
      })
      .toEqual({ beside: true, top: 0, shape: 1.5 });

    await speed(page).focus();
    await page.keyboard.press('ArrowRight');
    await expect(speed(page)).toHaveAttribute('aria-valuenow', '1.01');
  });

  test('scrolling back up returns the full-width hero', async ({ page }) => {
    await open(page);
    await scrollToLanded(page);
    await expect(panel(page)).toBeInViewport();

    await page.evaluate(() => window.scrollTo(0, 0));

    await expect
      .poll(async () => Math.round((await box(page, frame(page))).width))
      .toBe(WIDE_CONTAINER);
    await expect(panel(page)).not.toBeInViewport();
  });

  // Tabbing into the panel before it has slid in would put focus on
  // controls past the container's edge, so the page scrolls the demo in.
  // The first stop is Reset, or the panel's scroll area where the panel
  // starts shorter than its controls, as at 720px tall, so the check is
  // that focus went into the panel.
  test('tabbing into the panel scrolls to the finished demo', async ({ page }) => {
    await open(page);

    await page.getByRole('link', { name: 'Get started' }).focus();
    await page.keyboard.press('Tab');

    expect(
      await panel(page).evaluate((group) => {
        const focused = document.activeElement;

        return focused !== null && (group.contains(focused) || focused.contains(group));
      }),
    ).toBe(true);
    await expect(panel(page)).toBeInViewport();
  });

  test('reloading resets the demo to Aurora’s defaults', async ({ page }) => {
    await open(page);
    await scrollToLanded(page);
    await speed(page).focus();
    await page.keyboard.press('ArrowRight');
    await expect(speed(page)).toHaveAttribute('aria-valuenow', '1.01');

    await page.reload();
    await page.waitForLoadState('networkidle');
    // The server's HTML already holds the defaults, so the check waits for
    // the hero to measure itself, which happens after hydration, when a
    // store that outlived the load would have restored the old value.
    await expect(page.locator('[data-pinned]')).toHaveAttribute('data-pinned', 'true');

    await expect(speed(page)).toHaveAttribute('aria-valuenow', '1');
  });

  // The favorites ride in the pin and rise into place as the demo lands. On
  // a short window they are still below the fold then, and must come in at
  // rest rather than staying hidden.
  for (const height of [720, 500]) {
    test(`at ${height}px tall, the favorites are in place once the demo lands`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1280, height });
      await open(page);
      await scrollToLanded(page);
      await page.mouse.wheel(0, 400);

      const favorite = page
        .getByRole('list', { name: 'Start with one of our favorites' })
        .getByRole('link')
        .first();

      await expect(favorite).toBeInViewport();
      await expect
        .poll(() =>
          favorite.evaluate((link) => {
            const item = link.closest('li')!;

            return `${getComputedStyle(item).transform} ${item.style.maskImage || 'none'}`;
          }),
        )
        .toBe('none none');
    });
  }
});

// ---------------------------------------------
// No pin: a phone, and reduced motion
// ---------------------------------------------

// With no pin, the scene scrolls with the page, so scrolling moves its top
// by the distance scrolled.
async function expectScrollsWithPage(page: Page): Promise<void> {
  const before = (await box(page, scene(page))).y;

  await page.evaluate(() => window.scrollBy(0, 200));
  await expect.poll(async () => Math.round(before - (await box(page, scene(page))).y)).toBe(200);
}

test.describe('at 390px', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('the demo stacks, with no pin and no sideways scroll', async ({ page }) => {
    await open(page);

    await expect(page.locator('[data-pinned]')).toHaveAttribute('data-pinned', 'false');
    const [sceneBox, panelBox] = [await box(page, scene(page)), await box(page, panel(page))];

    expect(Math.round((sceneBox.width / sceneBox.height) * 100) / 100).toBe(1.5);
    expect(panelBox.y).toBeGreaterThanOrEqual(sceneBox.y + sceneBox.height);
    expect(Math.round(panelBox.x)).toBe(Math.round(sceneBox.x));
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await expectScrollsWithPage(page);

    await speed(page).focus();
    await page.keyboard.press('ArrowRight');
    await expect(speed(page)).toHaveAttribute('aria-valuenow', '1.01');
  });
});

test.describe('under reduced motion', () => {
  test('the demo renders directly, with no pin', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page);

    await expect(page.locator('[data-pinned]')).toHaveAttribute('data-pinned', 'false');
    const [sceneBox, panelBox] = [await box(page, scene(page)), await box(page, panel(page))];

    expect(Math.round((sceneBox.width / sceneBox.height) * 100) / 100).toBe(1.5);
    expect(panelBox.x).toBeGreaterThanOrEqual(sceneBox.x + sceneBox.width);
    await expectScrollsWithPage(page);
  });
});
