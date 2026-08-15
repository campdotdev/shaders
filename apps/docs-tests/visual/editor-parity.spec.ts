// The eject-parity gate, pixel half: the editor's live compiler
// (/parity/runtime) and the checked-in emitter output (/parity/generated)
// render the starter graph to the SAME snapshot name — the shared baseline
// IS the assertion, within the suite's toHaveScreenshot tolerance. The
// source half (generated.gen.tsx can't drift from the emitter) lives in
// apps/editor/src/editor/parity.test.ts.
//
// Runs under the `editor` Playwright project (visual/editor*.spec.ts), so
// baselines capture whatever backend that browser run negotiates — both
// routes in the same run, which is what makes per-backend hash() divergence
// irrelevant here.
import { expect } from '@playwright/test';

import { test } from './fixtures';
import { waitForShader } from './helpers';

for (const route of ['/parity/runtime', '/parity/generated']) {
  test(`eject parity: ${route} matches the shared baseline`, async ({ page }) => {
    await page.goto(`${route}?visualTest=1`);
    await waitForShader(page);
    await expect(page.locator('canvas').first()).toHaveScreenshot('eject-parity.png');
  });
}
