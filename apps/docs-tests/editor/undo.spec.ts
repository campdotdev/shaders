// Undo/redo on the editor canvas. The interesting assertion isn't that undo
// works at all -- it's the COALESCING contract: a structural edit is one step,
// and so is a whole slider drag, even though the drag fires a state write on
// every tick. See use-editor-history.ts.
import { expect, test } from '@playwright/test';

import { openEditor, selectCard, settingsRow, STARTER_CARDS } from './helpers';

test('undo removes an added card, redo restores it', async ({ page }) => {
  await openEditor(page);
  const cards = page.locator('.react-flow__node');

  await page.getByRole('button', { name: '+ generate', exact: true }).click();
  // The flyout is a plain disclosure group (no menu role — it doesn't
  // implement menu keyboard semantics); the spec button's accessible name is
  // unique on the page, since card names on the canvas aren't buttons.
  await page.getByRole('button', { name: 'Voronoi' }).click();
  await expect(cards).toHaveCount(STARTER_CARDS + 1);

  await page.keyboard.press('ControlOrMeta+z');
  await expect(cards).toHaveCount(STARTER_CARDS);
  await page.keyboard.press('ControlOrMeta+Shift+z');
  await expect(cards).toHaveCount(STARTER_CARDS + 1);
});

test('undo brings back a deleted card and its wires', async ({ page }) => {
  await openEditor(page);
  const cards = page.locator('.react-flow__node');
  const wires = page.locator('.react-flow__edge');
  const initialWires = await wires.count();

  // Noise feeds two downstream cards, so deleting it takes two wires with it —
  // which makes it the sharpest check that undo restores wiring, not just nodes.
  await selectCard(cards.filter({ hasText: 'Noise' }).first());
  await page.keyboard.press('Backspace');
  await expect(cards).toHaveCount(STARTER_CARDS - 1);
  await expect(wires).toHaveCount(initialWires - 2);

  await page.keyboard.press('ControlOrMeta+z');
  await expect(cards).toHaveCount(STARTER_CARDS);
  await expect(wires).toHaveCount(initialWires);
});

test('a whole scrub undoes as one step', async ({ page }) => {
  await openEditor(page);
  const noise = page.locator('.react-flow__node').filter({ hasText: 'Noise' }).first();

  await settingsRow(noise).click();

  const scale = noise.getByRole('textbox', { name: 'scale' });

  await expect(scale).toBeVisible();
  const before = await scale.inputValue();

  // A real pointer drag, not fill(): the value has to change many times under
  // one held pointer for the coalescing to mean anything.
  const field = await scale.boundingBox();

  if (field === null) throw new Error('scale field has no bounding box');

  const midline = field.y + field.height / 2;

  await page.mouse.move(field.x + field.width / 2, midline);
  await page.mouse.down();

  for (let step = 1; step <= 12; step += 1) {
    await page.mouse.move(field.x + field.width / 2 + step * 5, midline);
  }

  await page.mouse.up();
  await expect(scale).not.toHaveValue(before);

  // One undo, not twelve.
  await page.keyboard.press('ControlOrMeta+z');
  await expect(scale).toHaveValue(before);
});

test('a typed value undoes as one step', async ({ page }) => {
  await openEditor(page);
  const noise = page.locator('.react-flow__node').filter({ hasText: 'Noise' }).first();

  await settingsRow(noise).click();

  const scale = noise.getByRole('textbox', { name: 'scale' });
  const before = await scale.inputValue();

  // A click without travel opens the field for typing rather than scrubbing.
  await scale.click();
  await scale.fill('7.5');
  await scale.press('Enter');
  await expect(scale).toHaveValue('7.50');

  await page.keyboard.press('ControlOrMeta+z');
  await expect(scale).toHaveValue(before);
});
