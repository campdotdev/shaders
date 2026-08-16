// File export and import — the two doors a preset takes on and off a disk.
// (URL sharing was pulled pending a backend; its Linear issue records the
// removal.) Import drives the real hidden file input via setInputFiles, so
// the whole parsePreset -> applyPreset path runs exactly as a user's file
// pick would, without a native chooser dialog.
import { expect, test } from '@playwright/test';

import { card, openEditor, STARTER_CARDS } from './helpers';

test('export, reload, import round-trips the graph', async ({ page }) => {
  await openEditor(page);
  const cards = page.locator('.react-flow__node');

  // Make the graph distinctive so the reimport assertion can't pass on the
  // starter graph alone.
  await page.getByRole('button', { name: '+ generate', exact: true }).click();
  // No menu-role scoping: the flyout is a plain disclosure group, and the
  // button's accessible name is unique on the page.
  await page.getByRole('button', { name: 'Voronoi' }).click();
  await expect(cards).toHaveCount(STARTER_CARDS + 1);

  const downloadPromise = page.waitForEvent('download');

  await page.getByRole('button', { name: 'export' }).click();

  const download = await downloadPromise;

  expect(download.suggestedFilename()).toBe('matter-graph.json');

  const downloadPath = await download.path();

  // A reload drops back to the starter graph — nothing persists by design.
  await openEditor(page);

  await page.getByRole('button', { name: 'import' }).click();
  await page.getByLabel('import preset file').setInputFiles(downloadPath);
  await expect(cards).toHaveCount(STARTER_CARDS + 1);
  await expect(card(page, 'Voronoi')).toBeVisible();

  // The import records one undo step, so Cmd+Z steps back to the starter set.
  await page.keyboard.press('ControlOrMeta+z');
  await expect(cards).toHaveCount(STARTER_CARDS);
});

test('the exported file is valid preset JSON', async ({ page }) => {
  await openEditor(page);

  const downloadPromise = page.waitForEvent('download');

  await page.getByRole('button', { name: 'export' }).click();

  const download = await downloadPromise;
  const { readFile } = await import('node:fs/promises');
  const parsed = JSON.parse(await readFile(await download.path(), 'utf8')) as {
    version: number;
    nodes: Array<{ spec: string }>;
    edges: unknown[];
  };

  expect(parsed.version).toBe(1);
  expect(parsed.nodes).toHaveLength(STARTER_CARDS);
  expect(parsed.edges).toHaveLength(6);
});

test('view code reveals the generated component and tracks edits', async ({ page }) => {
  await openEditor(page);

  // The panel lives in the same top-right actions stack as export/import.
  await page.getByRole('button', { name: 'view code' }).click();
  await expect(page.getByText('export function GeneratedShader')).toBeVisible();
  // Starter-graph fan-out: the noise helper appears once, by name.
  await expect(page.getByText('const noiseField =')).toBeVisible();

  // The source tracks the live graph — but only the subgraph feeding Output:
  // deleting the wired Noise card drops its helper from the emitted code.
  // (An UNWIRED card never appears at all; the walk starts at Output.)
  await card(page, 'Noise').click({ position: { x: 40, y: 10 } });
  await page.keyboard.press('Backspace');
  await expect(page.getByText('const noiseField =')).toHaveCount(0);

  await page.getByRole('button', { name: 'hide code' }).click();
  await expect(page.getByText('export function GeneratedShader')).toHaveCount(0);
});

test('importing a non-preset file toasts and leaves the graph alone', async ({ page }) => {
  await openEditor(page);
  const cards = page.locator('.react-flow__node');

  await page.getByRole('button', { name: 'import' }).click();
  await page.getByLabel('import preset file').setInputFiles({
    name: 'not-a-preset.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"hello": "world"}'),
  });

  await expect(page.getByText('Preset version must be an integer', { exact: false })).toBeVisible();
  await expect(cards).toHaveCount(STARTER_CARDS);
});
