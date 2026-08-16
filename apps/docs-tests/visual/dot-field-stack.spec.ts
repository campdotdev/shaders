import { expect, test } from './fixtures';
import { waitForShader } from './helpers';

// Guards DotField's transparent stacking (MAT-93): stacked over a gradient in
// one ShaderScene, the space between dots must show the gradient beneath, not
// overwrite it. Asserts color fractions instead of a screenshot baseline so
// the check is backend-independent and needs no snapshot regeneration.
test('DotField — stacked over a gradient shows the layer beneath between dots', async ({
  page,
}) => {
  await page.goto('/dev/dot-field-stack-probe?visualTest=1');
  await page.locator('canvas').first().waitFor();
  await waitForShader(page);

  const shot = await page.locator('canvas').first().screenshot();
  const fractions = await page.evaluate(async (pngBase64) => {
    const response = await fetch(`data:image/png;base64,${pngBase64}`);
    const bitmap = await createImageBitmap(await response.blob());
    const canvas = document.createElement('canvas');

    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext('2d')!;

    context.drawImage(bitmap, 0, 0);
    const { data } = context.getImageData(0, 0, bitmap.width, bitmap.height);

    let gradientPixels = 0;
    let dotPixels = 0;
    const totalPixels = bitmap.width * bitmap.height;

    for (let i = 0; i < data.length; i += 4) {
      const red = data[i] ?? 0;
      const green = data[i + 1] ?? 0;
      const blue = data[i + 2] ?? 0;

      // White dots: all channels high. Checked first — white also satisfies
      // the warm-gradient test's red threshold, but not its red-over-blue gap.
      if (red > 230 && green > 230 && blue > 230) {
        dotPixels += 1;
      } else if (red > 140 && red > blue + 50) {
        // Warm gradient: red dominates blue by a wide margin. The black page
        // background (a broken stack shows it through the canvas's zero-alpha
        // pixels) fails the red threshold.
        gradientPixels += 1;
      }
    }

    return { gradient: gradientPixels / totalPixels, dots: dotPixels / totalPixels };
  }, shot.toString('base64'));

  // Dots are ~4px in 30px cells (~1.5% coverage), so a working stack is
  // nearly all gradient. A broken stack is nearly all black: gradient ~0.
  expect(fractions.gradient, `fractions: ${JSON.stringify(fractions)}`).toBeGreaterThan(0.8);

  // The dots themselves must still render — a DotField that vanished entirely
  // would otherwise pass the gradient check. The upper bound only guards a
  // canvas gone all-white; measured dot coverage sits near 0.09.
  expect(fractions.dots, `fractions: ${JSON.stringify(fractions)}`).toBeGreaterThan(0.0005);
  expect(fractions.dots, `fractions: ${JSON.stringify(fractions)}`).toBeLessThan(0.3);
});
