import { expect, test } from './fixtures';
import { waitForShader } from './helpers';

test('Aurora — default story', async ({ page }) => {
  await page.goto('/components/aurora?visualTest=1');
  await waitForShader(page);
  await expect(page.locator('canvas').first()).toHaveScreenshot('aurora-default.png');
});

// Aurora reads its field from a texture the field pass draws each frame
// (SHA-208). A regenerated baseline of a broken field would pass its own
// screenshot, so this checks the curtains are there at all. When the pass
// never draws, or the patch mapping is never set and every read clamps to
// the texture's corner, each step of every pixel reads the same value, and
// each row of the canvas comes out one flat color: under 1 luminance unit
// from its darkest pixel to its brightest. Curtains spread each row across
// 45 to 90 units on the WebGL2 fallback. A black canvas is flat too. A
// field read at the wrong scale or with swapped axes still varies, so only
// the approved screenshot catches that.
test('Aurora — the curtains are not flat', async ({ page }) => {
  await page.goto('/components/aurora?visualTest=1');
  await waitForShader(page);

  const shot = await page.locator('canvas').first().screenshot();
  const spreads = await page.evaluate(async (pngBase64) => {
    const response = await fetch(`data:image/png;base64,${pngBase64}`);
    const bitmap = await createImageBitmap(await response.blob());
    const canvas = document.createElement('canvas');

    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext('2d')!;

    context.drawImage(bitmap, 0, 0);

    // How far one row's luminance runs, darkest to brightest, over 201
    // pixels across it. Luminance here is the plain average of the channels.
    const spreadAcross = (yFraction: number) => {
      const y = Math.min(bitmap.height - 1, Math.floor(bitmap.height * yFraction));
      const row = context.getImageData(0, y, bitmap.width, 1).data;
      let darkest = Number.POSITIVE_INFINITY;
      let brightest = Number.NEGATIVE_INFINITY;

      for (let step = 0; step <= 200; step += 1) {
        const x = Math.min(bitmap.width - 1, Math.floor((bitmap.width * step) / 200));
        const luminance = ((row[x * 4] ?? 0) + (row[x * 4 + 1] ?? 0) + (row[x * 4 + 2] ?? 0)) / 3;

        darkest = Math.min(darkest, luminance);
        brightest = Math.max(brightest, luminance);
      }

      return brightest - darkest;
    };

    return [0.25, 0.5, 0.75].map(spreadAcross);
  }, shot.toString('base64'));

  for (const spread of spreads) {
    expect(spread, `row spreads: ${JSON.stringify(spreads)}`).toBeGreaterThan(20);
  }
});
