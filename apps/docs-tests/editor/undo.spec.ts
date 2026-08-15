// Undo/redo on the editor canvas. The interesting assertion isn't that undo
// works at all -- it's the COALESCING contract: a structural edit is one step,
// and so is a whole slider drag, even though the drag fires a state write on
// every tick. See use-editor-history.ts.
import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

/** Cards in the starter graph (starter-graph.ts): gradient, noise, warp,
    blend, ramp, output. */
const STARTER_CARDS = 6;

/**
 * Opens the editor and waits for the canvas to exist. The page is
 * `ssr: false`, so `goto` resolves on an empty shell — a click sent before
 * React mounts lands on nothing, and a one-shot `count()` reads 0.
 */
async function openEditor(page: Page) {
  await page.goto('/');
  await expect(page.locator('.react-flow__node')).toHaveCount(STARTER_CARDS);
}

/**
 * Selects a card the way React Flow actually allows it to be selected.
 *
 * A plain click does NOT select: with React Flow 12's default
 * `selectNodesOnDrag`, the node wrapper's click handler defers selection to
 * the drag gesture, so selection only lands once XYDrag starts. A real mouse
 * jitters a pixel between press and release and always starts one, which is
 * why clicking a card feels like it selects; a synthetic click is
 * pixel-perfect and never does. Focus + Enter goes through React Flow's own
 * keyboard selection path instead, and — unlike a nudge-drag — it doesn't
 * move the card, so it adds no undo step of its own.
 */
async function selectCard(card: Locator) {
  await card.focus();
  await card.press('Enter');
  await expect(card).toHaveClass(/selected/);
}

/** A card's name row, which toggles its params panel. Matched exactly: the
    accessible name carries the stage tag ("Noise generate"), and a substring
    match on the card name would also hit the "delete Noise" control that
    appears once the card is selected. */
function nameRow(card: Locator, accessibleName: string) {
  return card.getByRole('button', { name: accessibleName, exact: true });
}

test('undo removes an added card, redo restores it', async ({ page }) => {
  await openEditor(page);
  const cards = page.locator('.react-flow__node');

  // Exact, because every generate-stage card's name button also ends in
  // "generate" — the stage tag sits inside the button.
  await page.getByRole('button', { name: '+ generate', exact: true }).click();
  await page.getByRole('menu').getByRole('button', { name: 'Voronoi' }).click();
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

test('a whole slider drag undoes as one step', async ({ page }) => {
  await openEditor(page);
  const noise = page.locator('.react-flow__node').filter({ hasText: 'Noise' }).first();

  await selectCard(noise);
  await nameRow(noise, 'Noise generate').click();

  const scaleRow = noise.locator('label').filter({ hasText: 'scale' });
  const readout = scaleRow.locator('span');
  const slider = scaleRow.locator('input[type=range]');

  await expect(readout).toBeVisible();
  const before = await readout.innerText();

  // A real pointer drag, not fill(): the value has to change many times under
  // one held pointer for the coalescing to mean anything.
  const track = await slider.boundingBox();

  if (track === null) throw new Error('scale slider has no bounding box');

  const midline = track.y + track.height / 2;

  await page.mouse.move(track.x + track.width * 0.15, midline);
  await page.mouse.down();

  for (let step = 1; step <= 12; step += 1) {
    await page.mouse.move(track.x + track.width * (0.15 + step * 0.05), midline);
  }

  await page.mouse.up();
  await expect(readout).not.toHaveText(before);

  // One undo, not twelve. The panel stays open across the restore, which is
  // what lets this read the value back off the card at all.
  await page.keyboard.press('ControlOrMeta+z');
  await expect(readout).toHaveText(before);
});
