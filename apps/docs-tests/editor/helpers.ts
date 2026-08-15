// Shared helpers for the editor specs. The gotchas these encode were each
// found the hard way (see the spec files' headers): the canvas is client-only
// so goto resolves on an empty shell, and card selection happens through a
// plain click now that the name row is text rather than a button.
import { expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

/** Cards in the starter graph (starter-graph.ts): gradient, noise, warp,
    blend, ramp, output. */
export const STARTER_CARDS = 6;

/**
 * Opens the editor and waits for the canvas to exist. The page is
 * `ssr: false`, so `goto` resolves on an empty shell — a click sent before
 * React mounts lands on nothing, and a one-shot `count()` reads 0.
 */
export async function openEditor(page: Page) {
  await page.goto('/');
  await expect(page.locator('.react-flow__node')).toHaveCount(STARTER_CARDS);
}

/** The first card whose text includes `name`. */
export function card(page: Page, name: string): Locator {
  return page.locator('.react-flow__node').filter({ hasText: name }).first();
}

/** Selects a card by clicking its name row (the top of the card). Pass
    `Shift` in `modifiers` to add to the selection instead of replacing it. */
export async function selectCard(target: Locator, modifiers?: Array<'Shift'>) {
  await target.click({ position: { x: 40, y: 10 }, modifiers });
  await expect(target).toHaveClass(/selected/);
}

/** A card's always-visible params disclosure row. */
export function settingsRow(target: Locator): Locator {
  return target.getByRole('button', { name: 'settings' });
}
