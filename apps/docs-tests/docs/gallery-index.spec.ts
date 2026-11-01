import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * The Gallery grid at /gallery: a card per composition, each with its
 * poster, its title, and its description, linking to the composition's
 * page. A composition whose poster scripts/build-posters.sh never wrote
 * shows a broken image here and fails the poster test, the way
 * components-index.spec.ts catches a missing thumbnail.
 *
 * Each test reads every card in one evaluate rather than stepping card by
 * card, because the section banner's live scene slows every Playwright step
 * on CI's software renderer.
 */

test.use({ viewport: { width: 1280, height: 2000 } });

interface Card {
  href: string;
  title: string;
  description: string;
  posterLoaded: boolean;
}

async function open(page: Page): Promise<void> {
  await page.goto('/gallery');
  await page.waitForLoadState('networkidle');
}

// A card is the only link in the page's article that carries a
// description. Its title and description are the elements its
// aria-labelledby and aria-describedby name.
async function readCards(page: Page): Promise<Card[]> {
  return page.locator('article a[aria-describedby]').evaluateAll((links) =>
    links.map((link) => {
      const referenced = (name: string) => document.getElementById(link.getAttribute(name) ?? '');
      const title = referenced('aria-labelledby');
      const description = referenced('aria-describedby');
      const poster = link.querySelector('img');

      if (!title || !description || !poster) {
        throw new Error(`a card is missing a part: ${link.outerHTML}`);
      }

      return {
        href: link.getAttribute('href') ?? '',
        title: title.innerText,
        description: description.innerText,
        posterLoaded: poster.complete && poster.naturalWidth > 0,
      };
    }),
  );
}

test('each card links to its composition, titled and described from the registry', async ({
  page,
}) => {
  await open(page);

  const cards = await readCards(page);

  expect(cards.length).toBeGreaterThan(0);

  // The composition pages are fetched inside the browser in one step, which
  // shows each link leads to a page whose title and meta description match
  // the card's.
  const pages = await page.evaluate(
    (hrefs) =>
      Promise.all(
        hrefs.map(async (href) => {
          const response = await fetch(href);
          const html = new DOMParser().parseFromString(await response.text(), 'text/html');

          return {
            href,
            status: response.status,
            title: html.querySelector('h1')?.textContent ?? '',
            description:
              html.querySelector('meta[name="description"]')?.getAttribute('content') ?? '',
          };
        }),
      ),
    cards.map((card) => card.href),
  );

  expect(pages).toEqual(
    cards.map(({ href, title, description }) => ({ href, status: 200, title, description })),
  );
});

test('each card shows its poster', async ({ page }) => {
  await open(page);

  await expect
    .poll(async () =>
      (await readCards(page)).filter((card) => !card.posterLoaded).map((card) => card.href),
    )
    .toEqual([]);
});
