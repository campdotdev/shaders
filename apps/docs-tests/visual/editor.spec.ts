// Visual baselines for the editor's card language: the DOM is the subject
// (stage tints, typed wires, selection chrome, port glow), plus one canvas
// shot for the Output card's live face. Element screenshots throughout;
// per-platform snapshots absorb the macOS/Linux font delta because snap.sh
// generates both.
//
// Every case loads with ?visualTest=1: VisualTestPause (mounted inside
// OutputPreview's ShaderScene) freezes the preview canvas after two
// deterministic frames, and that canvas sits INSIDE the viewport element the
// wider shots capture — an animated corner would make every baseline flaky.
import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

import { test } from './fixtures';
import { waitForShader } from './helpers';

const STARTER_CARDS = 6;

async function openEditor(page: Page) {
  await page.goto('/?visualTest=1');
  await expect(page.locator('.react-flow__node')).toHaveCount(STARTER_CARDS);
  await waitForShader(page);
}

test('editor — starter graph', async ({ page }) => {
  await openEditor(page);

  // The whole React Flow root, panels included: stage tints, typed wires,
  // the toolbar, the legend, and the actions cluster in one baseline.
  await expect(page.locator('.react-flow')).toHaveScreenshot('starter-graph.png');
});

test('editor — selected card chrome', async ({ page }) => {
  await openEditor(page);

  const warp = page.locator('.react-flow__node').filter({ hasText: 'Warp' }).first();

  await warp.click({ position: { x: 40, y: 10 } });
  await expect(warp).toHaveClass(/selected/);

  // Just the card: the violet selection ring over the amber effects wash.
  await expect(warp).toHaveScreenshot('card-selected.png');
});

test('editor — port glow during a connection drag', async ({ page }) => {
  await openEditor(page);

  // Start a wire drag from Noise's out port and HOLD: compatible field
  // ports glow, incompatible (color) ports fade. The held connection line
  // is part of the picture.
  const outHandle = page.locator('[data-nodeid="noise-1"][data-handleid="out"]');
  const box = await outHandle.boundingBox();

  if (box === null) throw new Error('noise out handle has no bounding box');

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 40, box.y + box.height / 2 - 20, { steps: 5 });

  await expect(page.locator('.react-flow')).toHaveScreenshot('glow-on-drag.png');

  await page.mouse.up();
});

test('editor — output card face', async ({ page }) => {
  await openEditor(page);

  // The live preview canvas, frozen on its deterministic second frame.
  await expect(page.locator('canvas').first()).toHaveScreenshot('output-card.png');
});
