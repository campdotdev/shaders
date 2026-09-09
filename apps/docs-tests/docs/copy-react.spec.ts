import { expect, test } from '@playwright/test';

/**
 * The component page header's Copy React button and its menu. The button
 * reads the demo's control store through the copy source bridge, so the
 * copied snippet has to carry the current params, and the menu has to line
 * up with the button box rather than the chevron inside it.
 */

// Wide enough that the shader column reaches the 4xl cap the header shares,
// so the button box, the menu, and the shader all end on one edge.
test.use({ viewport: { width: 1728, height: 1000 } });

test.beforeEach(async ({ context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
});

test('Copy React copies the demo with its current params', async ({ page }) => {
  await page.goto('/components/vignette');
  await page.waitForLoadState('networkidle');

  const button = page.getByRole('button', { name: 'Copy React' });

  await expect(button).toBeEnabled();

  // A slider write lands in the store immediately, so the copied snippet
  // has to show the new value rather than the page's initial one.
  const intensity = page.getByRole('slider', { name: 'Intensity' });

  await intensity.focus();
  await page.keyboard.press('End');

  await button.click();

  await expect(button).toHaveAttribute('data-copied', 'true');
  await expect(page.getByText('Copied', { exact: true })).toBeAttached();

  const copied = await page.evaluate(() => navigator.clipboard.readText());

  expect(copied).toContain(
    "import { LinearGradient, ShaderScene, Vignette } from '@camp-dev/shaders'",
  );
  expect(copied).toContain('<LinearGradient />');
  expect(copied).toContain('intensity={1}');

  // The feedback clears on its own.
  await expect(button).not.toHaveAttribute('data-copied', 'true', { timeout: 3000 });
});

test('the menu lines up with the button box', async ({ page }) => {
  await page.goto('/components/aurora');
  await page.waitForLoadState('networkidle');

  const chevron = page.getByRole('button', { name: 'More copy options' });

  await chevron.click();

  const menu = page.getByRole('menu');

  await expect(menu).toBeVisible();

  const [boxRight, menuRight, shaderRight] = await Promise.all([
    chevron.evaluate((element) => element.parentElement!.getBoundingClientRect().right),
    menu.evaluate((element) => element.getBoundingClientRect().right),
    page.locator('[data-shader-demo]').evaluate((element) => element.getBoundingClientRect().right),
  ]);

  expect(menuRight).toBe(boxRight);
  expect(shaderRight).toBe(boxRight);

  // The left half of the button is Copy React, so the menu holds only the
  // markdown rows, both disabled until the export ships.
  const rows = page.getByRole('menuitem');

  await expect(rows).toHaveText(['Copy as markdown', 'View as markdown']);
  await expect(rows.first()).toHaveAttribute('aria-disabled', 'true');
  await expect(rows.last()).toHaveAttribute('aria-disabled', 'true');
});
