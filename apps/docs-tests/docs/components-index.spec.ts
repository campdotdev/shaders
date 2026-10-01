import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

/**
 * The components index (SHA-180): every component as a card under its
 * category heading, each with a thumbnail, its label, and its description
 * cut to two lines, linking to its page.
 *
 * The sidebar is the expected list. The index and the sidebar both render
 * the catalog's taxonomy tree, and taxonomy.test.ts pins how that tree files
 * each catalog record under its category in the curated order. A component
 * added to the catalog is checked here with no edit to this file.
 *
 * /components runs the section banner's live scene, and on CI's software
 * renderer that slows every Playwright step (the "Open site chrome from a
 * static route" section of docs/development/visual-regression.md). So each
 * test reads every card in one evaluate rather than stepping card by card,
 * and the viewport is tall enough to show the whole grid, which loads every
 * lazy thumbnail without scrolling to each one.
 */

test.use({ viewport: { width: 1280, height: 3000 } });

const sidebar = (page: Page) => page.locator('nav[aria-label="Docs"]');
// The root layout's <main> holds the sidebar too, so the cards are read
// from the page's article.
const componentsIndex = (page: Page) => page.locator('article');

async function open(page: Page): Promise<void> {
  await page.goto('/components');
  await page.waitForLoadState('networkidle');
}

// Every list under the root as the heading that labels it over its links'
// hrefs, in document order. The sidebar and the index both label each list
// with the heading above it through aria-labelledby, so one reader serves
// both.
async function groupsIn(root: Locator): Promise<Array<{ heading: string; hrefs: string[] }>> {
  return root.evaluate((element) =>
    Array.from(element.querySelectorAll('ul[aria-labelledby]'), (list) => ({
      heading:
        document.getElementById(list.getAttribute('aria-labelledby') ?? '')?.textContent ?? '',
      hrefs: Array.from(list.querySelectorAll('a'), (link) => link.getAttribute('href') ?? ''),
    })),
  );
}

// A sidebar row's text is the component's label.
async function sidebarRows(page: Page): Promise<Array<{ href: string; label: string }>> {
  return sidebar(page)
    .locator('a')
    .evaluateAll((links) =>
      links.map((link) => ({
        href: link.getAttribute('href') ?? '',
        label: link.textContent ?? '',
      })),
    );
}

interface Card {
  href: string;
  label: string;
  description: string;
  descriptionHeight: number;
  descriptionLineHeight: number;
  descriptionCut: boolean;
  thumbnailSrc: string;
  thumbnailWidth: number;
  thumbnailLoaded: boolean;
}

// Every card, read in one step. A card is the only link that carries a
// description. Its label and description are the elements its
// aria-labelledby and aria-describedby name. A card missing any part fails
// the read, and with it the test.
async function readCards(page: Page): Promise<Card[]> {
  return componentsIndex(page)
    .locator('a[aria-describedby]')
    .evaluateAll((links) => {
      const attribute = (element: Element, name: string) => element.getAttribute(name) ?? '';
      const referenced = (link: Element, name: string) =>
        document.getElementById(attribute(link, name));

      return links.map((link) => {
        const label = referenced(link, 'aria-labelledby');
        const description = referenced(link, 'aria-describedby');
        const thumbnail = link.querySelector('img');

        if (!label || !description || !thumbnail) {
          throw new Error(`a card is missing a part: ${link.outerHTML}`);
        }

        return {
          href: attribute(link, 'href'),
          label: label.innerText,
          description: description.innerText,
          descriptionHeight: description.getBoundingClientRect().height,
          descriptionLineHeight: Number.parseFloat(getComputedStyle(description).lineHeight),
          descriptionCut: description.scrollHeight > description.clientHeight,
          thumbnailSrc: attribute(thumbnail, 'src'),
          thumbnailWidth: thumbnail.getBoundingClientRect().width,
          thumbnailLoaded: thumbnail.complete && thumbnail.naturalWidth > 0,
        };
      });
    });
}

// ---------------------------------------------
// Grouping
// ---------------------------------------------

test('every component appears once, under its category, in the sidebar order', async ({ page }) => {
  await open(page);

  const expected = await groupsIn(sidebar(page));
  const actual = await groupsIn(componentsIndex(page));
  const hrefs = actual.flatMap((group) => group.hrefs);

  expect(expected.length).toBeGreaterThan(0);
  expect(actual).toEqual(expected);
  expect(new Set(hrefs).size).toBe(hrefs.length);
  // The category headings are the page's section headings, one level under
  // the page title.
  await expect(componentsIndex(page).getByRole('heading', { level: 2 })).toHaveText(
    expected.map((group) => group.heading),
  );
});

// ---------------------------------------------
// Cards
// ---------------------------------------------

// Each card's description is checked against the description its component
// page declares in its metadata, which comes from the same catalog entry.
// The pages are fetched inside the browser in one step, which also shows
// that every link leads to a page that exists.
test('each card links to its page, labeled and described from the catalog', async ({ page }) => {
  await open(page);

  const rows = await sidebarRows(page);
  const cards = await readCards(page);

  expect(cards.map(({ href, label }) => ({ href, label }))).toEqual(rows);

  const pages = await page.evaluate(
    (hrefs) =>
      Promise.all(
        hrefs.map(async (href) => {
          const response = await fetch(href);
          const html = new DOMParser().parseFromString(await response.text(), 'text/html');

          return {
            href,
            status: response.status,
            description:
              html.querySelector('meta[name="description"]')?.getAttribute('content') ?? '',
          };
        }),
      ),
    cards.map((card) => card.href),
  );

  expect(pages).toEqual(cards.map(({ href, description }) => ({ href, status: 200, description })));

  // The name is the label alone and the description is the link's
  // description, so a screen reader says the name first and does not run
  // the two together. readCards follows the same ARIA references by hand.
  // This checks one card through the accessibility tree, to prove the
  // references resolve there too.
  const [firstRow] = rows;
  const [firstCard] = cards;

  if (!firstRow || !firstCard) throw new Error('the components index has no cards');

  await expect(
    componentsIndex(page).getByRole('link', { name: firstRow.label, exact: true }),
  ).toHaveAccessibleDescription(firstCard.description);
});

test('each card shows its thumbnail', async ({ page }) => {
  await open(page);

  await expect
    .poll(async () =>
      (await readCards(page)).filter((card) => !card.thumbnailLoaded).map((card) => card.href),
    )
    .toEqual([]);

  for (const card of await readCards(page)) {
    expect(card.thumbnailSrc, card.href).toMatch(/\.thumb\.webp$/);
    expect(card.thumbnailWidth, card.href).toBeGreaterThan(0);
  }
});

// The height is read against the description's own line height, so a
// change of font size cannot break it. The longest descriptions run well
// past two lines at this width, which is what shows the cut is real rather
// than every description happening to be short.
test('each description is cut to two lines', async ({ page }) => {
  await open(page);

  const cards = await readCards(page);

  expect(cards.length).toBe((await sidebarRows(page)).length);

  for (const card of cards) {
    expect(card.descriptionHeight, card.href).toBeLessThanOrEqual(
      card.descriptionLineHeight * 2 + 0.5,
    );
  }

  expect(cards.some((card) => card.descriptionCut)).toBe(true);
});

// ---------------------------------------------
// Page weight and chrome
// ---------------------------------------------

// The listener goes on before the first load, so no image can come from
// the cache unseen. The section banner's own poster is the one full-size
// image the page may load; it is the banner's, not a card's.
test('no card loads a full-size poster', async ({ page }) => {
  const posters: string[] = [];

  page.on('request', (request) => {
    const { pathname } = new URL(request.url());

    if (pathname.startsWith('/posters/') && pathname !== '/posters/banner.jpg') {
      posters.push(pathname);
    }
  });

  await open(page);

  const rows = await sidebarRows(page);

  await expect.poll(() => posters.length).toBe(rows.length);
  expect(posters.filter((pathname) => !pathname.endsWith('.thumb.webp'))).toEqual([]);
});

test('no sidebar row is marked current', async ({ page }) => {
  await open(page);

  await expect(sidebar(page).getByRole('link').first()).toBeVisible();
  await expect(sidebar(page).locator('[aria-current]')).toHaveCount(0);
});
