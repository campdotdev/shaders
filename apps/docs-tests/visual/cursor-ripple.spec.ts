import { expect, test } from './fixtures';
import { waitForShader } from './helpers';

// CursorRipple's shader half (SHA-161) over the wave-field probe's seeded
// field: one fixed stroke stepped a fixed count, so the frame does not
// depend on a pointer or on frame timing. The Source is a flat single
// color, so refraction has nothing to bend and the wake shows through shine
// alone. `reducedMotion=off` keeps the "paused" policy VisualTestPause would
// otherwise set out of the seeding; see the raw-field spec next door.
const PROBE_URL = '/dev/wave-field-probe?visualTest=1&reducedMotion=off&effect=cursor-ripple';

test('CursorRipple — wake over a flat color', async ({ page }) => {
  await page.goto(PROBE_URL);
  await page.locator('canvas').first().waitFor();
  await waitForShader(page);

  await expect(page.locator('canvas').first()).toHaveScreenshot('cursor-ripple-probe.png');
});

// A regenerated baseline of an inert ripple would be a flat canvas that
// passes its own screenshot, so this checks the highlight is there at all.
// Shine takes the lit flanks of the ring from about 102 luminance to white
// on the WebGL2 fallback; 60 above the flat color is far below that and
// far above any precision drift.
test('CursorRipple — shine lights the wake over a flat color', async ({ page }) => {
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
    const pixels = context.getImageData(0, 0, bitmap.width, bitmap.height).data;
    const at = (index: number) =>
      ((pixels[index] ?? 0) + (pixels[index + 1] ?? 0) + (pixels[index + 2] ?? 0)) / 3;

    let brightest = 0;

    for (let index = 0; index < pixels.length; index += 4) {
      brightest = Math.max(brightest, at(index));
    }

    // A corner well clear of the ring reads the flat color.
    const corner =
      (Math.floor(bitmap.height * 0.05) * bitmap.width + Math.floor(bitmap.width * 0.05)) * 4;

    return { flat: at(corner), brightest };
  }, shot.toString('base64'));

  const detail = JSON.stringify(luminance);

  expect(luminance.brightest, `highlight missing: ${detail}`).toBeGreaterThan(luminance.flat + 60);
});
