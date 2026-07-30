import { expect, test } from './fixtures';
import { waitForShader } from './helpers';

test('RadialGradient — default story', async ({ page }) => {
  await page.goto('/components/radial-gradient?visualTest=1');
  await waitForShader(page);
  const canvas = page.locator('canvas').first();

  await expect(canvas).toHaveScreenshot('radial-gradient-default.png');
});

test('RadialGradient — reduced motion paused', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await ctx.newPage();

  await page.goto('/components/radial-gradient?visualTest=1&reducedMotion=paused');
  await waitForShader(page);

  const buf1 = await page.locator('canvas').first().screenshot();

  await page.waitForTimeout(1000);
  const buf2 = await page.locator('canvas').first().screenshot();

  expect(buf1.compare(buf2)).toBe(0);
  await ctx.close();
});
