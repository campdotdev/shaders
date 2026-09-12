import { expect, test } from '@playwright/test';

/**
 * The header menu's two markdown rows and the files they read. The copy
 * row has to hold the export before it is clicked, because the clipboard
 * write cannot wait on a fetch, and the view row is a plain link to the
 * same file. The last test reads the files directly, so a broken route
 * fails here rather than as a mysterious disabled row.
 */

test.beforeEach(async ({ context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
});

test('the rows point at the page export and copy it', async ({ page }) => {
  await page.goto('/components/aurora');
  await page.waitForLoadState('networkidle');

  await page.getByRole('button', { name: 'More copy options' }).click();

  const view = page.getByRole('menuitem', { name: 'View as markdown' });

  await expect(view).toHaveAttribute('href', '/md/components/aurora.md');
  await expect(view).toHaveAttribute('target', '_blank');

  // The row enables once the prefetch that the menu's open started lands.
  const copy = page.getByRole('menuitem', { name: 'Copy as markdown' });

  await expect(copy).not.toHaveAttribute('aria-disabled', 'true');
  await copy.click();

  const copied = await page.evaluate(() => navigator.clipboard.readText());

  expect(copied.startsWith('# Aurora\n')).toBe(true);
  expect(copied).toContain("import { Aurora, ShaderScene } from '@camp-dev/shaders'");
  expect(copied).toContain('| Prop | Type | Default | Description |');
});

test('a markdown copy does not light up the Copy React button', async ({ page }) => {
  await page.goto('/components/aurora');
  await page.waitForLoadState('networkidle');

  await page.getByRole('button', { name: 'More copy options' }).click();

  // Wait for the row to enable, or a disabled row ignores the click and the
  // assertion below passes without a copy having happened.
  const copy = page.getByRole('menuitem', { name: 'Copy as markdown' });

  await expect(copy).not.toHaveAttribute('aria-disabled', 'true');
  await copy.click();

  await expect(page.getByRole('button', { name: 'Copy React' })).not.toHaveAttribute(
    'data-copied',
    'true',
  );
});

test('the export is served for a component page and a prose page', async ({ request }) => {
  const component = await request.get('/md/components/aurora.md');

  expect(component.ok()).toBe(true);
  expect(await component.text()).toContain('[Live demo](/components/aurora)');

  const prose = await request.get('/md/getting-started.md');

  expect(prose.ok()).toBe(true);
  expect((await prose.text()).startsWith('# Get Started\n')).toBe(true);
});
