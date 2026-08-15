// Delete and multi-select. Deletion is keyboard-only — Backspace, Delete, or
// x on the selection; the per-card and per-wire x buttons were tried and cut
// as clutter. Wire tear-off (dragging an end to empty canvas) is covered
// manually — headless drag-to-nowhere is too flaky to pin CI on. Output is
// the one immortal card: the graph always needs a home for its result, so
// every delete path must refuse it.
import { expect, test } from '@playwright/test';

import { card, openEditor, selectCard, STARTER_CARDS } from './helpers';

test('backspace and x both remove a selected card; output is exempt', async ({ page }) => {
  await openEditor(page);
  const cards = page.locator('.react-flow__node');

  await selectCard(card(page, 'Gradient'));
  await page.keyboard.press('Backspace');
  await expect(cards).toHaveCount(STARTER_CARDS - 1);

  // x is the Blender-style alternative (deleteKeyCode in Editor.tsx).
  await selectCard(card(page, 'Noise'));
  await page.keyboard.press('x');
  await expect(cards).toHaveCount(STARTER_CARDS - 2);

  // Output bounces every delete key (`deletable: false` on the node — see
  // makeNode in flow-preset.ts).
  await selectCard(card(page, 'Output'));
  await page.keyboard.press('Backspace');
  await page.keyboard.press('x');
  await expect(card(page, 'Output')).toBeVisible();
  await expect(cards).toHaveCount(STARTER_CARDS - 2);
});

test('a selected wire deletes from the keyboard', async ({ page }) => {
  await openEditor(page);
  const wires = page.locator('.react-flow__edge');
  const initial = await wires.count();

  await wires.first().click();
  await page.keyboard.press('Backspace');
  await expect(wires).toHaveCount(initial - 1);
});

test('shift-click multi-select deletes as a group', async ({ page }) => {
  await openEditor(page);
  const cards = page.locator('.react-flow__node');

  await selectCard(card(page, 'Gradient'));
  await selectCard(card(page, 'Noise'), ['Shift']);
  await expect(page.locator('.react-flow__node.selected')).toHaveCount(2);

  await page.keyboard.press('Backspace');
  await expect(cards).toHaveCount(STARTER_CARDS - 2);
});

test('a group delete undoes as one step', async ({ page }) => {
  await openEditor(page);
  const cards = page.locator('.react-flow__node');
  const wires = page.locator('.react-flow__edge');
  const initialWires = await wires.count();

  // Gradient + Noise take three wires with them (Gradient->Warp, Noise->Warp,
  // Noise->Blend), so the wire count is the sharpest check that the restore
  // brings back wiring, not just cards.
  await selectCard(card(page, 'Gradient'));
  await selectCard(card(page, 'Noise'), ['Shift']);
  await page.keyboard.press('Backspace');
  await expect(cards).toHaveCount(STARTER_CARDS - 2);

  // One Backspace on a two-card selection is one gesture — and one undo.
  await page.keyboard.press('ControlOrMeta+z');
  await expect(cards).toHaveCount(STARTER_CARDS);
  await expect(wires).toHaveCount(initialWires);
});

test('a rubber-band drag selects every card it touches', async ({ page }) => {
  await openEditor(page);

  // Shift+drag from empty canvas, sweeping a box that only CLIPS the two
  // left-column cards (Gradient, Noise) rather than containing them —
  // SelectionMode.Partial is what makes a grazed card count as caught.
  const gradientBox = await card(page, 'Gradient').boundingBox();
  const noiseBox = await card(page, 'Noise').boundingBox();

  if (gradientBox === null || noiseBox === null) throw new Error('cards have no bounding box');

  await page.keyboard.down('Shift');
  await page.mouse.move(gradientBox.x - 40, gradientBox.y - 40);
  await page.mouse.down();
  // End INSIDE both cards' left halves: the box overlaps them without
  // enclosing either.
  await page.mouse.move(noiseBox.x + 30, noiseBox.y + noiseBox.height / 2, { steps: 8 });
  await page.mouse.up();
  await page.keyboard.up('Shift');

  await expect(page.locator('.react-flow__node.selected')).toHaveCount(2);
});
