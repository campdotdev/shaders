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

/** Selects a card by clicking its name row (the top of the card). Plain
    clicks select again now that the name row is text rather than a button —
    an interactive element there used to swallow the selection. See
    cards.spec.ts. */
async function selectCard(card: Locator) {
  await card.click({ position: { x: 40, y: 10 } });
  await expect(card).toHaveClass(/selected/);
}

/** A card's always-visible params disclosure row. */
function settingsRow(card: Locator) {
  return card.getByRole('button', { name: 'settings' });
}

test('undo removes an added card, redo restores it', async ({ page }) => {
  await openEditor(page);
  const cards = page.locator('.react-flow__node');

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
