import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * The site chrome around the docs home (SHA-179). The header's Docs link and
 * every Documentation breadcrumb lead to /docs, which lists what the docs
 * sidebar lists, and Examples is gone from the site until it has a design.
 * Links are asserted through their roles and hrefs, so a restyle cannot break
 * this file.
 */

const sidebar = (page: Page) => page.locator('nav[aria-label="Docs"]');
const breadcrumbs = (page: Page) => page.getByRole('navigation', { name: 'Breadcrumb' });

// The href of every element the selector matches, in document order.
async function hrefsIn(page: Page, selector: string): Promise<string[]> {
  return page
    .locator(selector)
    .evaluateAll((links) => links.map((link) => link.getAttribute('href') ?? ''));
}

// ---------------------------------------------
// The Docs link
// ---------------------------------------------

test('the header Docs link opens the docs home', async ({ page }) => {
  await page.goto('/components/aurora');
  await page.waitForLoadState('networkidle');

  await page.locator('header nav[aria-label="Site"]').getByRole('link', { name: 'Docs' }).click();

  await expect(page).toHaveURL('/docs');
  await expect(page.getByRole('heading', { level: 1, name: 'Documentation' })).toBeVisible();
});

// The narrow-viewport nav's Docs link is clicked through in
// narrow-layout.spec.ts, which checks that the click lands on /docs and
// closes the nav.

// ---------------------------------------------
// The docs home
// ---------------------------------------------

test('the docs home sits in the docs layout, first in the sidebar', async ({ page }) => {
  await page.goto('/docs');
  await page.waitForLoadState('networkidle');

  await expect(sidebar(page)).toBeVisible();

  // Overview is the sidebar's first group, so its first row is the tree's
  // first link.
  const firstRow = sidebar(page).getByRole('link').first();

  await expect(firstRow).toHaveAttribute('href', '/docs');
  await expect(firstRow).toHaveAttribute('aria-current', 'page');
});

// The page and the sidebar both read the nav config, so every row the
// sidebar shows has to have a link on the page. That is what keeps a page
// added to the config from being missed here. The links are read from the
// article, because the root layout's <main> holds the sidebar too.
test('the docs home links to every sidebar row and to the components index', async ({ page }) => {
  await page.goto('/docs');
  await page.waitForLoadState('networkidle');

  const rows = (await hrefsIn(page, 'nav[aria-label="Docs"] a')).filter((href) => href !== '/docs');
  const pageLinks = await hrefsIn(page, 'article a');

  expect(rows.length).toBeGreaterThan(0);

  for (const href of rows) {
    expect(pageLinks, `the docs home is missing ${href}`).toContain(href);
  }

  await expect(
    page.locator('article').getByRole('link', { name: 'React components' }),
  ).toHaveAttribute('href', '/components');
});

// ---------------------------------------------
// Breadcrumbs
// ---------------------------------------------

for (const route of ['/components/aurora', '/getting-started', '/react/api']) {
  test(`the Documentation breadcrumb on ${route} links to the docs home`, async ({ page }) => {
    await page.goto(route);
    await page.waitForLoadState('networkidle');

    await expect(breadcrumbs(page).getByRole('link', { name: 'Documentation' })).toHaveAttribute(
      'href',
      '/docs',
    );
  });
}

test('the components index reads Home, Documentation, Components', async ({ page }) => {
  await page.goto('/components');
  await page.waitForLoadState('networkidle');

  const trail = breadcrumbs(page);

  await expect(trail.getByRole('listitem')).toHaveText(['Home', 'Documentation', 'Components']);
  await expect(trail.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/');
  await expect(trail.getByRole('link', { name: 'Documentation' })).toHaveAttribute('href', '/docs');
  await expect(trail.getByText('Components')).toHaveAttribute('aria-current', 'page');
});

// ---------------------------------------------
// No Examples
// ---------------------------------------------

for (const route of ['/', '/docs', '/getting-started', '/components', '/components/aurora']) {
  test(`${route} has no link to /examples`, async ({ page }) => {
    await page.goto(route);
    await page.waitForLoadState('networkidle');

    await expect(page.locator('a[href="/examples"]')).toHaveCount(0);
  });
}

test('the narrow-viewport nav links Docs to the docs home and has no Examples', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/getting-started');
  await page.waitForLoadState('networkidle');

  await page.getByRole('button', { name: 'Open site navigation' }).click();

  const dialog = page.getByRole('dialog', { name: 'Site navigation' });

  await expect(dialog.getByRole('link', { name: 'Docs' })).toHaveAttribute('href', '/docs');
  await expect(dialog.getByRole('link', { name: 'Examples' })).toHaveCount(0);
});

test('the static export has no /examples page', async ({ request }) => {
  const response = await request.get('/examples');

  expect(response.status()).toBe(404);
});

// Straight to the built Pagefind index rather than through the search panel,
// because a result row carries its page's title but not its URL.
test('site search does not return /examples', async ({ page }) => {
  await page.goto('/getting-started');
  await page.waitForLoadState('networkidle');

  const urls = await page.evaluate(async () => {
    // A variable rather than a literal, so TypeScript leaves the browser's
    // import of the built index unresolved.
    const path = '/pagefind/pagefind.js';
    const pagefind = (await import(path)) as {
      search: (
        query: string,
      ) => Promise<{ results: Array<{ data: () => Promise<{ url: string }> }> }>;
    };
    const search = await pagefind.search('examples');
    const results = await Promise.all(search.results.map((result) => result.data()));

    return results.map((result) => result.url);
  });

  expect(urls.filter((url) => url.startsWith('/examples'))).toEqual([]);
});
