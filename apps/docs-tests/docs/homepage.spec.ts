import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * The homepage layout with no motion (SHA-181): the intro, the Aurora hero,
 * the favorites, and the homepage-only footer, asserted through roles, hrefs,
 * and image sources so a restyle cannot break this file. FAVORITES is listed
 * by hand rather than read from the content module, so a reshuffle there
 * fails here for review.
 */

const FAVORITES = [
  'simplex-noise',
  'mesh-gradient',
  'wave-lines',
  'voronoi',
  'dither',
  'god-rays',
  'led-wall',
];

// The favorites that show a card poster rather than their component's.
const CARD_POSTERS = new Set(['dither', 'led-wall']);

const favorites = (page: Page) =>
  page.getByRole('list', { name: 'Start with one of our favorites' }).getByRole('link');

async function open(page: Page): Promise<void> {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
}

// The HTTP status of a route, fetched from inside the page.
async function statusOf(page: Page, href: string): Promise<number> {
  return page.evaluate(async (url) => (await fetch(url)).status, href);
}

// ---------------------------------------------
// Hero
// ---------------------------------------------

test('the heading and description introduce the library', async ({ page }) => {
  await open(page);

  await expect(
    page.getByRole('heading', { level: 1, name: 'Shader components for the modern web' }),
  ).toBeVisible();
  await expect(
    page.getByText('A growing library for React, written in TSL and rendered with WebGPU.'),
  ).toBeVisible();
});

// The link is checked by its href and by fetching its target, rather than
// by a click. A click from a page running a live scene can outlast the
// expect budget on CI's software renderer (the "Open site chrome from a
// static route" section of docs/development/visual-regression.md).
test('Get started links to the getting started guide', async ({ page }) => {
  await open(page);

  const getStarted = page.getByRole('link', { name: 'Get started' });

  await expect(getStarted).toHaveAttribute('href', '/getting-started');
  expect(await statusOf(page, '/getting-started')).toBe(200);
});

// The site underlines a link on hover, and Get started is a link drawn as
// the site's text button, which drops the underline.
test('Get started shows no underline on hover', async ({ page }) => {
  await open(page);

  const getStarted = page.getByRole('link', { name: 'Get started' });

  await getStarted.hover();
  await expect(getStarted).toHaveCSS('text-decoration-line', 'none');
});

// The poster is checked in the server's HTML, which is what a visitor sees
// before any script runs and what stays up when WebGPU is missing. The live
// scene is checked in the browser, where the scene mounts its canvas.
test('the hero shows the Aurora poster first, then the live scene', async ({ page, request }) => {
  const html = await (await request.get('/')).text();

  expect(html).toMatch(/<img[^>]+src="[^"]*aurora-hero\.jpg[^"]*"/);

  await open(page);

  await expect(page.locator('[data-home-hero] canvas')).toBeAttached();
});

// ---------------------------------------------
// Favorites
// ---------------------------------------------

test('seven favorites link to their pages, in order', async ({ page }) => {
  await open(page);

  const hrefs = await favorites(page).evaluateAll((links) =>
    links.map((link) => link.getAttribute('href') ?? ''),
  );

  expect(hrefs).toEqual(FAVORITES.map((slug) => `/components/${slug}`));

  for (const href of hrefs) {
    expect(await statusOf(page, href), href).toBe(200);
  }
});

// The link's name is the component's label, which the poster's alt carries.
test('a favorite is named for its component', async ({ page }) => {
  await open(page);

  await expect(favorites(page).first()).toHaveAccessibleName('Simplex Noise');
});

// Each favorite shows a full poster, not the small square the components
// index uses, and every one has loaded. Dither and LED Wall show a card
// poster, captured at the live scene's size, because both size their pattern
// in CSS pixels.
test('each favorite shows its poster', async ({ page }) => {
  await open(page);
  await expect(favorites(page)).toHaveCount(FAVORITES.length);
  // The posters load lazily, so the grid is brought on screen first.
  await favorites(page).last().scrollIntoViewIfNeeded();

  const readImages = () =>
    favorites(page).evaluateAll((links) =>
      links.map((link) => {
        const image = link.querySelector('img');

        return {
          href: link.getAttribute('href') ?? '',
          src: decodeURIComponent(image?.currentSrc ?? ''),
          loaded: !!image && image.complete && image.naturalWidth > 0,
        };
      }),
    );

  await expect
    .poll(async () => (await readImages()).filter((image) => !image.loaded).map((i) => i.href))
    .toEqual([]);

  for (const [index, image] of (await readImages()).entries()) {
    expect(image.src, image.href).toMatch(
      new RegExp(
        `/posters/${FAVORITES[index]}${CARD_POSTERS.has(FAVORITES[index]!) ? '-card' : ''}\\.(jpg|png)`,
      ),
    );
  }
});

// This file's browser has no WebGPU adapter: headless Chromium exposes
// navigator.gpu but hands out none without --enable-unsafe-webgpu, which
// favorites-hover.spec.ts turns on to test the live scenes. The spec asks for
// an adapter itself first, to prove this browser has none.
test('with no WebGPU, a hovered or focused favorite stays a poster', async ({ page }) => {
  await open(page);

  // This package's TypeScript config carries no WebGPU types.
  const hasAdapter = await page.evaluate(async () => {
    const { gpu } = navigator as { gpu?: { requestAdapter: () => Promise<unknown> } };

    return (await gpu?.requestAdapter()) != null;
  });

  expect(hasAdapter).toBe(false);

  const favorite = favorites(page).first();

  await favorite.hover();
  await favorite.focus();
  // Nothing to wait on when nothing should happen, so the spec gives the page
  // the time a favorite with WebGPU takes to mount its canvas.
  await page.waitForTimeout(1_000);

  await expect(
    page.getByRole('list', { name: 'Start with one of our favorites' }).locator('canvas'),
  ).toHaveCount(0);
  await expect(favorite.getByRole('img')).toBeVisible();
});

// ---------------------------------------------
// Footer
// ---------------------------------------------

test('the footer shows the wordmark and no links', async ({ page }) => {
  await open(page);

  const footer = page.locator('footer');

  await expect(footer).toHaveCount(1);
  await expect(footer.getByText('shaders', { exact: true })).toBeVisible();
  await expect(footer.getByRole('link')).toHaveCount(0);
});

// One route per layout the site has: the docs home and a guide share the
// docs-content layout, and the components index and a component page share
// the components layout.
for (const route of ['/docs', '/getting-started', '/components', '/components/aurora']) {
  test(`${route} renders no footer`, async ({ page }) => {
    await page.goto(route);

    await expect(page.locator('footer')).toHaveCount(0);
  });
}

// ---------------------------------------------
// The placeholder is gone
// ---------------------------------------------

test('the old placeholder content is gone', async ({ page }) => {
  await open(page);

  await expect(page.getByText(/^Status:/)).toHaveCount(0);
  await expect(page.getByRole('link', { name: '<LinearGradient>' })).toHaveCount(0);
});
