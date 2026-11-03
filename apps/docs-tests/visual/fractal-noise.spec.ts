import { expect, test } from './fixtures';
import { waitForShader } from './helpers';

test('FractalNoise — default story', async ({ page }) => {
  await page.goto('/components/fractal-noise?visualTest=1');
  await waitForShader(page);
  await expect(page.locator('canvas').first()).toHaveScreenshot('fractal-noise-default.png');
});

// The default story sits at angle 0 and stretch 1, where the transform does
// nothing. The probe turns the field 30 degrees and stretches it 4 times on
// the 16:9 viewport, so a reversed turn, a lost stretch, or a wrong aspect
// correction changes this baseline.
test('FractalNoise — angle and stretch', async ({ page }) => {
  await page.goto('/dev/fractal-noise-probe?visualTest=1');
  await page.locator('canvas').first().waitFor();
  await waitForShader(page);
  await expect(page.locator('canvas').first()).toHaveScreenshot('fractal-noise-angle-stretch.png');
});
