// Copy, paste, and duplicate. The payload on the clipboard is serialized
// preset JSON — the same format files and share links use — so these tests
// exercise the real system clipboard (permissions granted below), while
// duplicate stays clipboard-free by design and needs none.
import { expect, test } from '@playwright/test';

import { card, openEditor, selectCard, STARTER_CARDS } from './helpers';

test.beforeEach(async ({ context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
});

test('copy and paste a wired pair, then undo it as one step', async ({ page }) => {
  await openEditor(page);
  const cards = page.locator('.react-flow__node');
  const wires = page.locator('.react-flow__edge');
  const initialWires = await wires.count();

  // Noise + Warp are wired to each other AND outward (Noise->Blend,
  // Warp->Blend). Only the internal noise->warp `by` wire survives the copy,
  // so exactly one wire appears — the sharpest check that edges to
  // unselected cards are dropped rather than duplicated.
  await selectCard(card(page, 'Noise'));
  await selectCard(card(page, 'Warp'), ['Shift']);
  await page.keyboard.press('ControlOrMeta+c');
  await page.keyboard.press('ControlOrMeta+v');

  await expect(cards).toHaveCount(STARTER_CARDS + 2);
  await expect(wires).toHaveCount(initialWires + 1);

  // The pasted pair takes over the selection — it's what you're now holding.
  await expect(page.locator('.react-flow__node.selected')).toHaveCount(2);

  // One paste, one undo step.
  await page.keyboard.press('ControlOrMeta+z');
  await expect(cards).toHaveCount(STARTER_CARDS);
  await expect(wires).toHaveCount(initialWires);
});

test('pasting non-preset text does nothing', async ({ page }) => {
  await openEditor(page);
  const cards = page.locator('.react-flow__node');

  await page.evaluate(() => navigator.clipboard.writeText('not a preset'));
  await page.keyboard.press('ControlOrMeta+v');

  // Nothing to await on the no-op path, so settle on a beat of wall clock
  // before asserting the count held.
  await page.waitForTimeout(300);
  await expect(cards).toHaveCount(STARTER_CARDS);
});

test('duplicate adds one card and no wires, without the clipboard', async ({ page }) => {
  await openEditor(page);
  const cards = page.locator('.react-flow__node');
  const wires = page.locator('.react-flow__edge');
  const initialWires = await wires.count();

  // Seed the clipboard so the test can prove duplicate leaves it alone.
  await page.evaluate(() => navigator.clipboard.writeText('sentinel'));

  await selectCard(card(page, 'Gradient'));
  await page.keyboard.press('ControlOrMeta+d');

  await expect(cards).toHaveCount(STARTER_CARDS + 1);
  await expect(wires).toHaveCount(initialWires);
  await expect(page.locator('.react-flow__node.selected')).toHaveCount(1);

  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('sentinel');
});

test('duplicate refuses the Output card', async ({ page }) => {
  await openEditor(page);
  const cards = page.locator('.react-flow__node');

  await selectCard(card(page, 'Output'));
  await page.keyboard.press('ControlOrMeta+d');

  await page.waitForTimeout(300);
  await expect(cards).toHaveCount(STARTER_CARDS);
});
