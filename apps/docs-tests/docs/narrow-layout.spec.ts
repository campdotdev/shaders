import { expect, test } from '@playwright/test';

/**
 * The docs shell's narrow layout (SHA-126). Under 48rem the sidebar gives
 * way to a dropdown at the top of the main column, and under 40rem the
 * header's links give way to a hamburger that opens a full-screen nav.
 * Neither page may scroll sideways at a phone width.
 */

test.use({ viewport: { width: 390, height: 844 } });

const routes = ['/components/aurora', '/getting-started'];

for (const route of routes) {
  test(`${route} has no horizontal scroll at 390px`, async ({ page }) => {
    await page.goto(route);
    await page.waitForLoadState('networkidle');

    const [scrollWidth, clientWidth] = await page.evaluate(() => [
      document.documentElement.scrollWidth,
      document.documentElement.clientWidth,
    ]);

    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
  });
}

// The banner's shader box is a fixed height sized to the header block, and the
// band under it shrinks on a phone. Anchoring the box to the band's bottom is
// what keeps the two in step; before that it ran 32px past and painted over the
// dropdown's top edge, which read as a collapsed margin (Gate 5, 2026-09-16).
test('the banner shader stops at the band, clear of the dropdown', async ({ page }) => {
  await page.goto('/components/aurora');
  await page.waitForLoadState('networkidle');

  const { sceneBottom, bandBottom, dropdownTop } = await page.evaluate(() => {
    const scene = document.querySelector('div[class*="section-banner_scene"]')!;
    const band = document
      .querySelector('div[class*="section-banner_inner"]')!
      .closest('div[class*="section-banner_banner"]')!;
    const dropdown = document.querySelector('div[class*="docs-nav-dropdown_root"]')!;

    return {
      sceneBottom: scene.getBoundingClientRect().bottom,
      bandBottom: band.getBoundingClientRect().bottom,
      dropdownTop: dropdown.getBoundingClientRect().top,
    };
  });

  expect(sceneBottom).toBeCloseTo(bandBottom, 0);
  expect(sceneBottom).toBeLessThanOrEqual(dropdownTop);
});

test('the dropdown replaces the sidebar and closes on navigation', async ({ page }) => {
  await page.goto('/components/aurora');
  await page.waitForLoadState('networkidle');

  await expect(page.locator('nav[aria-label="Docs"]')).toBeHidden();

  const trigger = page.getByRole('button', { name: 'Aurora' });

  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await trigger.click();
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');

  const row = page.locator('nav[aria-label="Docs menu"] a', { hasText: 'Vignette' });

  await expect(row).toBeVisible();
  await row.click();
  await expect(page).toHaveURL('/components/vignette');
  await expect(page.getByRole('button', { name: 'Vignette' })).toHaveAttribute(
    'aria-expanded',
    'false',
  );
});

test('the hamburger opens the site nav, and Escape and a link close it', async ({ page }) => {
  await page.goto('/components/aurora');
  await page.waitForLoadState('networkidle');

  await expect(page.locator('header nav[aria-label="Site"]')).toBeHidden();

  const open = page.getByRole('button', { name: 'Open site navigation' });
  const dialog = page.getByRole('dialog', { name: 'Site navigation' });

  await open.click();
  await expect(dialog).toBeVisible();
  // The header stays on top of the overlay and its trigger toggles. It is
  // aria-hidden while the nav is open, so a role query cannot see it; a CSS
  // locator on the header's dialog trigger can. (Gate 4 revision: there is no
  // Close inside the row any more, only the visually hidden one for AT.)
  await expect(dialog.getByRole('button', { name: 'Close' })).toHaveAttribute('tabindex', '-1');
  await page.locator('header button[aria-haspopup="dialog"]').click();
  await expect(dialog).toBeHidden();

  await open.click();
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();

  await open.click();
  await dialog.getByRole('link', { name: 'Docs' }).click();
  await expect(page).toHaveURL('/components');
  await expect(dialog).toBeHidden();
});
