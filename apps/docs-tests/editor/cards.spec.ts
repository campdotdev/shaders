// Card interaction: selecting a card, and opening its params. These two were
// entangled once -- params rendered only while the card was BOTH selected and
// open, set by two different gestures on two different parts of the card, so
// the first click on a card looked dead. Disclosure is now one bit driven by
// the settings row, and these tests pin that apart.
import { expect, test } from '@playwright/test';

import { card, openEditor, settingsRow } from './helpers';

test('clicking a card selects it', async ({ page }) => {
  await openEditor(page);
  const noise = card(page, 'Noise');

  // The name row specifically (top ~20px of the card): it used to be a button
  // that swallowed the selection, so a click there did nothing at all.
  await noise.click({ position: { x: 40, y: 10 } });
  await expect(noise).toHaveClass(/selected/);
  await expect(page.getByRole('button', { name: 'delete Noise' })).toBeVisible();
});

test('the settings row opens params on the first click', async ({ page }) => {
  await openEditor(page);
  const noise = card(page, 'Noise');
  const settings = settingsRow(noise);

  await expect(settings).toHaveAttribute('aria-expanded', 'false');
  await expect(noise.locator('input')).toHaveCount(0);

  // One click, from an unselected card, is enough — this is the whole fix.
  await settings.click();
  await expect(settings).toHaveAttribute('aria-expanded', 'true');
  await expect(noise.locator('input').first()).toBeVisible();

  // And it selects the card too, so the delete affordance appears.
  await expect(noise).toHaveClass(/selected/);

  await settings.click();
  await expect(settings).toHaveAttribute('aria-expanded', 'false');
  await expect(noise.locator('input')).toHaveCount(0);
});

test('two cards can show their params at once', async ({ page }) => {
  await openEditor(page);
  const noise = card(page, 'Noise');
  const gradient = card(page, 'Gradient');

  await settingsRow(noise).click();
  await settingsRow(gradient).click();

  // Opening the second card must not collapse the first — disclosure is
  // per-card and no longer rides selection, which only ever holds one card.
  await expect(settingsRow(noise)).toHaveAttribute('aria-expanded', 'true');
  await expect(settingsRow(gradient)).toHaveAttribute('aria-expanded', 'true');
});

test('params stay open across a card drag', async ({ page }) => {
  await openEditor(page);
  const noise = card(page, 'Noise');

  await settingsRow(noise).click();
  await expect(settingsRow(noise)).toHaveAttribute('aria-expanded', 'true');

  const box = await noise.boundingBox();

  if (box === null) throw new Error('card has no bounding box');

  // Drag by the name row, which is drag surface again now that it isn't a button.
  await page.mouse.move(box.x + box.width / 2, box.y + 10);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 60, box.y + 40, { steps: 8 });
  await page.mouse.up();

  await expect(settingsRow(noise)).toHaveAttribute('aria-expanded', 'true');
  await expect(noise.locator('input').first()).toBeVisible();
});

test('the Output card has no settings row', async ({ page }) => {
  await openEditor(page);

  await expect(settingsRow(card(page, 'Output'))).toHaveCount(0);
});
