import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * The homepage layout with no motion (SHA-181 and SHA-213): the intro, the
 * hero, the favorites, the features section, and the footer, asserted through
 * roles, hrefs, and image sources so a restyle cannot break this file. The
 * lists are written by hand, so a reshuffle in the content module fails here.
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

// Each feature card's title, its description, and its illustration's URL.
const FEATURE_CARDS = [
  {
    title: 'Composable',
    description: 'Stack shaders in a single scene to build the exact effect you want.',
    illustration: '/features/composable.png',
  },
  {
    title: 'Performant',
    description: 'Reduce browser overhead for your users with WebGPU rendering.',
    illustration: '/features/performant.png',
  },
  {
    title: 'Reactive',
    description: 'Bring shaders to life with animation, cursor, and scroll inputs.',
    illustration: '/features/reactive.png',
  },
  {
    title: 'Extensible',
    description: 'Write your own shaders with the same TSL primitives our components use.',
    illustration: '/features/extensible.png',
  },
];

const FAVORITES_HEADING = 'Add some fun to your website';
const FEATURES_HEADING = 'We’ll handle the complex stuff';

const favoritesList = (page: Page) => page.getByRole('list', { name: FAVORITES_HEADING });

const favorites = (page: Page) => favoritesList(page).getByRole('link');

const featuresList = (page: Page) => page.getByRole('list', { name: FEATURES_HEADING });

const featureCards = (page: Page) => featuresList(page).getByRole('listitem');

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
    page.getByText(
      'A growing library for React, written in Three.js Shading Language and rendered with WebGPU.',
    ),
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

// Each favorite shows its card poster, not the small square the components
// index uses, and every one has loaded. A card poster is captured at the live
// scene's shape, 376 by 275, so the spec checks the file's shape too.
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
          // next/image may serve a resized file, which keeps the shape.
          shape: image ? image.naturalWidth / image.naturalHeight : 0,
        };
      }),
    );

  await expect
    .poll(async () => (await readImages()).filter((image) => !image.loaded).map((i) => i.href))
    .toEqual([]);

  for (const [index, image] of (await readImages()).entries()) {
    expect(image.src, image.href).toMatch(
      new RegExp(`/posters/${FAVORITES[index]}-card\\.(jpg|png)`),
    );
    expect(image.shape, image.href).toBeCloseTo(376 / 275, 2);
  }
});

// This file's browser has no WebGPU adapter: headless Chromium exposes
// navigator.gpu but hands out none without --enable-unsafe-webgpu, which
// favorites-hover.spec.ts turns on to test the live scenes. The spec asks for
// an adapter itself first, to prove this browser has none.
test('with no WebGPU, a hovered or focused favorite stays a poster and the hero plays on', async ({
  page,
}) => {
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

  await expect(favoritesList(page).locator('canvas')).toHaveCount(0);
  await expect(favorite.getByRole('img')).toBeVisible();
  // The hero falls back to WebGL2 and keeps drawing, and a favorite that
  // stays a poster costs no GPU time, so the hero has nothing to pause for.
  await expect(page.locator('[data-home-hero]')).not.toHaveAttribute('data-paused');
});

// ---------------------------------------------
// Features
// ---------------------------------------------

// Document order rather than boxes: the section rides in the hero's pin, so
// where it sits on screen depends on the scroll.
test('the features section sits between the favorites and the footer', async ({ page }) => {
  await open(page);

  const heading = page.getByRole('heading', { level: 2, name: FEATURES_HEADING });

  await expect(heading).toBeVisible();

  const favoritesHandle = await favoritesList(page).elementHandle();
  const footerHandle = await page.locator('footer').elementHandle();
  const order = await heading.evaluate(
    (element, [favoritesElement, footer]) => ({
      afterFavorites: !!(
        favoritesElement!.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING
      ),
      beforeFooter: !!(element.compareDocumentPosition(footer!) & Node.DOCUMENT_POSITION_FOLLOWING),
    }),
    [favoritesHandle, footerHandle] as const,
  );

  expect(order).toEqual({ afterFavorites: true, beforeFooter: true });
});

test('four feature cards show their titles and descriptions, in order', async ({ page }) => {
  await open(page);
  await expect(featureCards(page)).toHaveCount(FEATURE_CARDS.length);

  for (const [index, card] of FEATURE_CARDS.entries()) {
    const item = featureCards(page).nth(index);

    await expect(item.getByRole('heading', { level: 3 })).toHaveText(card.title);
    await expect(item.getByText(card.description, { exact: true })).toBeVisible();
  }
});

// The illustration is decoration: the card's title and description carry
// its message, so a screen reader skips the image.
test('each feature card shows its illustration, hidden from screen readers', async ({ page }) => {
  await open(page);
  // The illustrations load lazily, so the cards are brought on screen first.
  await featureCards(page).last().scrollIntoViewIfNeeded();

  for (const [index, card] of FEATURE_CARDS.entries()) {
    const item = featureCards(page).nth(index);
    const image = item.locator('img');

    await expect(item.getByRole('img')).toHaveCount(0);
    await expect(image).toHaveAttribute('aria-hidden', 'true');
    await expect(image).toHaveAttribute('src', card.illustration);
    await expect
      .poll(() =>
        image.evaluate((element: HTMLImageElement) => element.complete && element.naturalWidth > 0),
      )
      .toBe(true);
  }
});

test('no feature card is a link or takes focus', async ({ page }) => {
  await open(page);
  await expect(featureCards(page)).toHaveCount(FEATURE_CARDS.length);

  await expect(featuresList(page).getByRole('link')).toHaveCount(0);
  // Anything a Tab press could land on.
  await expect(
    featuresList(page).locator('a, button, input, select, textarea, [tabindex]'),
  ).toHaveCount(0);
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
