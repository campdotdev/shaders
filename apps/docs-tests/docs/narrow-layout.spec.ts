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
  await row.dispatchEvent('click', { metaKey: true });
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
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

// The fourth close path, and the one that actually broke. The overlay's
// .popup is pointer-events: none, with auto taken back on .link and
// .iconLink alone, so a press anywhere else reaches .backdrop, which is what
// Base UI dismisses on. The press to make is the one level with a link and
// clear of it: .links stretches to the popup's full content width, and while
// it carried pointer-events: auto it swallowed every press either side of
// its right-aligned rows (98f44dc6). A press in the popup's empty middle is
// the wrong probe, because that area was pointer-events: none before the fix
// too and dismissed either way. Hence the left edge at the Docs link's own
// height, read off the box rather than hardcoded, so the point stays on that
// row whatever the layout above it does.
test('a press beside the links dismisses the site nav', async ({ page }) => {
  await page.goto('/components/aurora');
  await page.waitForLoadState('networkidle');

  const dialog = page.getByRole('dialog', { name: 'Site navigation' });

  await page.getByRole('button', { name: 'Open site navigation' }).click();
  await expect(dialog).toBeVisible();

  const docsLink = await dialog.getByRole('link', { name: 'Docs' }).boundingBox();

  if (!docsLink) throw new Error('the site nav has no Docs link to aim beside');

  await page.mouse.click(40, docsLink.y + docsLink.height / 2);

  await expect(dialog).toBeHidden();
});

test('widening past the site-nav breakpoint closes the dialog', async ({ page }) => {
  await page.goto('/components/aurora');
  await page.waitForLoadState('networkidle');

  const dialog = page.getByRole('dialog', { name: 'Site navigation' });

  await page.getByRole('button', { name: 'Open site navigation' }).click();
  await expect(dialog).toBeVisible();

  await page.setViewportSize({ width: 700, height: 844 });

  await expect(dialog).toBeHidden();
  await expect(page.locator('header nav[aria-label="Site"]')).toBeVisible();
});

/**
 * The two bands between this branch's three thresholds. Nothing else covers
 * them: the tests above run at 390px, and the a11y and visual suites run at
 * 1280px, so 640px to 768px and 768px to the stack were left to the eye.
 * Both assert structure rather than pixel values, so a restyle cannot break
 * them. Each sets its own viewport instead of moving into a describe block,
 * because the file's one test.use stays the default for everything else.
 *
 * The dropdown is asserted through its trigger, not nav[aria-label="Docs
 * menu"]: Base UI renders the Collapsible's panel only while it is open, so
 * the tree is hidden at both widths and would prove nothing about the
 * layout. The trigger is the part CSS shows and hides.
 */
test('at 700px the sidebar is gone and the header keeps its links', async ({ page }) => {
  await page.setViewportSize({ width: 700, height: 844 });
  await page.goto('/components/aurora');
  await page.waitForLoadState('networkidle');

  await expect(page.locator('nav[aria-label="Docs"]')).toBeHidden();

  const trigger = page.getByRole('button', { name: 'Aurora' });

  await expect(trigger).toBeVisible();
  await trigger.click();
  await expect(page.locator('nav[aria-label="Docs menu"]')).toBeVisible();

  // The point of this band: 700px is over 40rem, so the header still shows
  // its links and the hamburger has not taken over.
  await expect(page.locator('header nav[aria-label="Site"]')).toBeVisible();
});

test('at 1100px the sidebar is back and the demo grid is stacked', async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 844 });
  await page.goto('/components/aurora');
  await page.waitForLoadState('networkidle');

  await expect(page.locator('nav[aria-label="Docs"]')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Aurora' })).toBeHidden();

  // Stacked means one grid track, so the shader and the control panel share
  // a left edge and the panel starts below the shader. Beside each other
  // they would sit at two different x's. Read off the two boxes rather than
  // the computed grid-template-columns, which would need a class-hash
  // locator for .layout; [data-shader-demo] and the panel's group role are
  // both named by the app.
  const shader = await page.locator('[data-shader-demo]').first().boundingBox();
  const controls = await page.getByRole('group', { name: 'Shader controls' }).boundingBox();

  if (!shader || !controls) throw new Error('the demo grid is missing a shader or a control panel');

  expect(controls.x).toBeCloseTo(shader.x, 0);
  expect(controls.y).toBeGreaterThan(shader.y + shader.height);
});
