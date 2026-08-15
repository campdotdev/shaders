// Delete affordances and multi-select. Cards die by Backspace or their own
// x control; wires die by Backspace, their midpoint x, or being torn off a
// port (that last one is covered manually — headless drag-to-empty-canvas is
// too flaky to pin CI on). Output is the one immortal card: the graph always
// needs a home for its result, so every delete path must refuse it.
import { expect, test } from '@playwright/test';

import { card, openEditor, selectCard, STARTER_CARDS } from './helpers';

test('backspace and the card delete control both remove cards; output is exempt', async ({
  page,
}) => {
  await openEditor(page);
  const cards = page.locator('.react-flow__node');

  await selectCard(card(page, 'Gradient'));
  await page.keyboard.press('Backspace');
  await expect(cards).toHaveCount(STARTER_CARDS - 1);

  // The x control appears on selection — the mouse-only path to the same end.
  await selectCard(card(page, 'Noise'));
  await page.getByRole('button', { name: 'delete Noise' }).click();
  await expect(cards).toHaveCount(STARTER_CARDS - 2);

  // Output: no x control even while selected, and Backspace bounces off
  // (`deletable: false` on the node — see makeNode in flow-preset.ts).
  await selectCard(card(page, 'Output'));
  await expect(page.getByRole('button', { name: 'delete Output' })).toHaveCount(0);
  await page.keyboard.press('Backspace');
  await expect(card(page, 'Output')).toBeVisible();
  await expect(cards).toHaveCount(STARTER_CARDS - 2);
});

test('a selected wire exposes a delete control', async ({ page }) => {
  await openEditor(page);
  const wires = page.locator('.react-flow__edge');
  const initial = await wires.count();

  await wires.first().click();
  await page.getByRole('button', { name: 'delete wire' }).click();
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
