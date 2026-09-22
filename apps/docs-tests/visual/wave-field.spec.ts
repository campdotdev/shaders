import { expect, test } from './fixtures';
import { waitForShader } from './helpers';

// The wave field runtime module (SHA-157) drawn raw over a flat color: one
// fixed stroke, stepped a fixed count, so the frame is deterministic before
// any Effect exists. `reducedMotion=off` matters: VisualTestPause otherwise
// sets the "paused" policy, and the field honors the shared factor, so it
// would neither step nor take the stroke and the canvas would be flat.
// Headless Chromium runs the WebGL2 fallback, which is the path that needs
// the float render-target extension.
const PROBE_URL = '/dev/wave-field-probe?visualTest=1&reducedMotion=off';

test('WaveField — ring spreading from a fixed stroke', async ({ page }) => {
  await page.goto(PROBE_URL);
  await page.locator('canvas').first().waitFor();
  await waitForShader(page);

  await expect(page.locator('canvas').first()).toHaveScreenshot('wave-field-probe.png');
});

// A regenerated baseline of a broken field would be a flat canvas that
// passes its own screenshot, so this checks the ring is there at all. The
// vertical center column crosses the two trough bands the stroke's straight
// section radiates, which sit about 29 luminance units below the flat color
// on the WebGL2 fallback. The trailing crest is under 2 units at the probe's
// gain, too faint to assert on, so only the trough is checked.
test('WaveField — the field is not flat', async ({ page }) => {
  await page.goto(PROBE_URL);
  await page.locator('canvas').first().waitFor();
  await waitForShader(page);

  const shot = await page.locator('canvas').first().screenshot();
  const luminance = await page.evaluate(async (pngBase64) => {
    const response = await fetch(`data:image/png;base64,${pngBase64}`);
    const bitmap = await createImageBitmap(await response.blob());
    const canvas = document.createElement('canvas');

    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext('2d')!;

    context.drawImage(bitmap, 0, 0);

    // Average the three channels of one pixel at fractional coordinates.
    const sample = (xFraction: number, yFraction: number) => {
      const x = Math.min(bitmap.width - 1, Math.floor(bitmap.width * xFraction));
      const y = Math.min(bitmap.height - 1, Math.floor(bitmap.height * yFraction));
      const pixel = context.getImageData(x, y, 1, 1).data;

      return ((pixel[0] ?? 0) + (pixel[1] ?? 0) + (pixel[2] ?? 0)) / 3;
    };

    // Walk the vertical center column and keep the darkest pixel.
    let darkest = Number.POSITIVE_INFINITY;

    for (let step = 0; step <= 200; step += 1) {
      darkest = Math.min(darkest, sample(0.5, step / 200));
    }

    return { flat: sample(0.05, 0.05), darkest };
  }, shot.toString('base64'));

  const detail = JSON.stringify(luminance);

  expect(luminance.darkest, `trough missing: ${detail}`).toBeLessThan(luminance.flat - 12);
});
