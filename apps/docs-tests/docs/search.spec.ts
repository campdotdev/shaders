import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * The docs search (SHA-155): the search trigger in the header and the search
 * panel it opens. Everything here goes through roles and accessible names,
 * and the results come from the real Pagefind index the Playwright web
 * server builds, so swapping the dialog primitive or the styling cannot
 * silently break the reader's path from Cmd+k to a page.
 */

const trigger = (page: Page) => page.getByRole('button', { name: 'Open search' });
const panel = (page: Page) => page.getByRole('dialog', { name: 'Search', exact: true });
const input = (page: Page) => page.getByRole('combobox', { name: 'Search query' });

// ---------------------------------------------
// Opening and querying
// ---------------------------------------------

test('the trigger opens the panel with the input focused and nothing listed', async ({ page }) => {
  await page.goto('/components/aurora');
  await page.waitForLoadState('networkidle');

  await expect(panel(page)).toBeHidden();
  await trigger(page).click();

  await expect(panel(page)).toBeVisible();
  await expect(input(page)).toBeFocused();
  // A fresh panel is the input alone: no rows, and no "no results" line for
  // a query nobody has typed.
  await expect(panel(page).getByRole('option')).toHaveCount(0);
  await expect(panel(page).getByText(/no results/i)).toHaveCount(0);
});

test('typing lists results from the index, and Enter opens the highlighted one', async ({
  page,
}) => {
  // If Pagefind fails to load or initialize, search normally falls back to
  // this endpoint. Blocking it here makes visible rows proof that the built
  // Pagefind index, rather than the fallback document, answered the query.
  await page.route('**/api/search', (route) => route.abort());
  await page.goto('/components/aurora');
  await page.waitForLoadState('networkidle');

  const pagefindLoaded = page.waitForResponse(
    (response) => new URL(response.url()).pathname === '/pagefind/pagefind.js',
  );

  await trigger(page).click();
  expect((await pagefindLoaded).ok()).toBe(true);
  await input(page).fill('vignette');

  const rows = panel(page).getByRole('option');

  await expect(rows.first()).toBeVisible();
  await expect(rows.first()).toHaveAttribute('aria-selected', 'true');

  // The highlight follows the arrow keys while focus stays on the input,
  // which is what aria-activedescendant reports to a screen reader.
  await page.keyboard.press('ArrowDown');

  const highlighted = rows.nth(1);

  await expect(highlighted).toHaveAttribute('aria-selected', 'true');
  await expect(rows.first()).toHaveAttribute('aria-selected', 'false');

  const highlightedText = await highlighted.textContent();

  await page.keyboard.press('Enter');

  // Enter lands on the highlighted page with the panel gone. Pagefind's
  // title for a page is its first h1, so the row's text starts with the
  // heading the reader arrives at; that ties the navigation to the row
  // without the test knowing any URL in advance.
  await expect(page).not.toHaveURL('/components/aurora');
  await expect(panel(page)).toBeHidden();

  const heading = await page.getByRole('heading', { level: 1 }).first().textContent();

  expect(heading).toBeTruthy();
  expect(highlightedText).toContain(heading!.trim());
});

test('clearing a completed query returns to the input-only state', async ({ page }) => {
  await page.goto('/components/aurora');
  await page.waitForLoadState('networkidle');

  await trigger(page).click();
  await input(page).fill('vignette');
  await expect(panel(page).getByRole('option').first()).toBeVisible();

  await input(page).clear();

  await expect(panel(page).getByRole('option')).toHaveCount(0);
  await expect(panel(page).getByRole('status')).toBeEmpty();
});

test('editing a completed query does not announce a transient empty state', async ({ page }) => {
  await page.goto('/components/aurora');
  await page.waitForLoadState('networkidle');

  await trigger(page).click();
  await input(page).fill('vignette');
  await expect(panel(page).getByRole('option').first()).toBeVisible();

  const status = panel(page).getByRole('status');

  await status.evaluate((element) => {
    const announcements: string[] = [];

    element.setAttribute('data-announcements', '[]');
    new MutationObserver((records) => {
      for (const record of records) {
        const changedNodes =
          record.type === 'characterData' ? [record.target] : Array.from(record.addedNodes);

        for (const changedNode of changedNodes) {
          const announcement = changedNode.textContent?.trim();

          if (announcement) announcements.push(announcement);
        }
      }
      element.setAttribute('data-announcements', JSON.stringify(announcements));
    }).observe(element, { childList: true, characterData: true, subtree: true });
  });

  await input(page).fill('aurora');
  await expect(panel(page).getByRole('option').first()).toBeVisible();

  const announcements = JSON.parse((await status.getAttribute('data-announcements')) ?? '[]');

  expect(announcements).not.toContain('No results found.');
});

// ---------------------------------------------
// Navigation
// ---------------------------------------------

test('a click on a row opens it', async ({ page }) => {
  await page.goto('/components/aurora');
  await page.waitForLoadState('networkidle');

  await trigger(page).click();
  await input(page).fill('vignette');

  const row = panel(page).getByRole('option').first();

  await expect(row).toBeVisible();

  const rowText = await row.textContent();

  await row.click();

  await expect(page).not.toHaveURL('/components/aurora');
  await expect(panel(page)).toBeHidden();

  const heading = await page.getByRole('heading', { level: 1 }).first().textContent();

  expect(heading).toBeTruthy();
  expect(rowText).toContain(heading!.trim());
});

// ---------------------------------------------
// Dismissal and focus restoration
// ---------------------------------------------

test('the shortcut toggles the panel, and every close returns focus to the trigger', async ({
  page,
}) => {
  await page.goto('/getting-started');
  await page.waitForLoadState('networkidle');

  // Cmd+k opens from anywhere, with nothing focused, and a second press
  // closes: the shortcut is a toggle.
  await page.keyboard.press('ControlOrMeta+k');
  await expect(panel(page)).toBeVisible();
  await expect(input(page)).toBeFocused();
  await page.keyboard.press('ControlOrMeta+k');
  await expect(panel(page)).toBeHidden();

  // Escape.
  await page.keyboard.press('ControlOrMeta+k');
  await expect(panel(page)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(panel(page)).toBeHidden();
  await expect(trigger(page)).toBeFocused();

  // The esc hint is a real close control.
  await trigger(page).click();
  await expect(panel(page)).toBeVisible();
  await panel(page).getByRole('button', { name: 'Close search' }).click();
  await expect(panel(page)).toBeHidden();
  await expect(trigger(page)).toBeFocused();

  // A press on the backdrop, clear of the panel.
  await trigger(page).click();
  await expect(panel(page)).toBeVisible();

  const box = await panel(page).boundingBox();

  if (!box) throw new Error('the search panel has no box to aim beside');

  await page.mouse.click(box.x / 2, box.y + box.height / 2);
  await expect(panel(page)).toBeHidden();
  await expect(trigger(page)).toBeFocused();
});

test('a shortcut-opened panel restores focus to a visible control on a narrow viewport', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/getting-started');
  await page.waitForLoadState('networkidle');

  const homeLink = page.getByRole('link', { name: 'Shaders home' });

  await homeLink.focus();
  await page.keyboard.press('ControlOrMeta+k');
  await expect(panel(page)).toBeVisible();
  await expect(input(page)).toBeFocused();
  await page.keyboard.press('Escape');

  await expect(panel(page)).toBeHidden();
  await expect(homeLink).toBeFocused();
});

// ---------------------------------------------
// Accessibility and layout
// ---------------------------------------------

// The panel opens in a portal the a11y suite never opens, so its axe pass
// lives here, with rows showing so the combobox, listbox, and options are
// all in the tree.
test('@a11y the open panel is axe-clean', async ({ page }) => {
  await page.goto('/components/aurora');
  await page.waitForLoadState('networkidle');

  await trigger(page).click();
  await input(page).fill('vignette');
  await expect(panel(page).getByRole('option').first()).toBeVisible();

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    .disableRules(['color-contrast'])
    .analyze();

  if (results.violations.length > 0) {
    console.log('axe violations:', JSON.stringify(results.violations, null, 2));
  }
  expect(results.violations).toEqual([]);
});

test('the shortcut path fits a short landscape viewport', async ({ page }) => {
  await page.setViewportSize({ width: 640, height: 320 });
  await page.goto('/components/aurora');
  await page.waitForLoadState('networkidle');

  await page.keyboard.press('ControlOrMeta+k');
  await input(page).fill('vignette');

  const row = panel(page).getByRole('option').first();

  await expect(row).toBeVisible();

  const [panelBox, rowBox] = await Promise.all([panel(page).boundingBox(), row.boundingBox()]);

  if (!panelBox || !rowBox) throw new Error('the short-viewport search panel has no visible box');

  expect(panelBox.y).toBeGreaterThanOrEqual(0);
  expect(rowBox.y + rowBox.height).toBeLessThanOrEqual(320);
});
