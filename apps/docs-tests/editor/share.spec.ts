// File export and URL sharing. Both move the same serialized Preset the
// clipboard and undo history use, so these tests focus on the doors, not the
// format: the format's round trip is unit-tested in the editor package.
//
// Import-via-file-chooser is deliberately not driven end-to-end — loading a
// hash exercises the same parsePreset -> applyPreset path, and the export
// test proves the file half writes valid preset JSON.
import { expect, test } from '@playwright/test';

import { card, openEditor, STARTER_CARDS } from './helpers';

// The share button writes the URL to the clipboard. Real Chrome auto-grants
// clipboard-write on a user gesture; headless doesn't, and a denied write
// flips the button to "failed" — grant it so the tests see the real flow.
test.beforeEach(async ({ context }) => {
  await context.grantPermissions(['clipboard-write']);
});

test('share writes a hash that reloads the same graph', async ({ page }) => {
  await openEditor(page);
  const cards = page.locator('.react-flow__node');

  // Make the graph distinctive so the reload assertion can't pass on the
  // starter graph alone.
  await page.getByRole('button', { name: '+ generate', exact: true }).click();
  await page.getByRole('menu').getByRole('button', { name: 'Voronoi' }).click();
  await expect(cards).toHaveCount(STARTER_CARDS + 1);

  await page.getByRole('button', { name: 'share' }).click();
  // The button flashing "copied" is the signal that the hash is written and
  // the URL is on the clipboard.
  await expect(page.getByRole('button', { name: 'copied' })).toBeVisible();

  const hash = await page.evaluate(() => window.location.hash);

  expect(hash.length).toBeGreaterThan(1);

  // A fresh load of the share URL rebuilds the same card set.
  await page.goto('/' + hash);
  await expect(cards).toHaveCount(STARTER_CARDS + 1);
  await expect(card(page, 'Voronoi')).toBeVisible();
  await expect(card(page, 'Output')).toBeVisible();
});

test('a damaged share link toasts and leaves the starter graph', async ({ page }) => {
  await page.goto('/#not-a-real-hash');

  // The canvas still comes up on the starter graph — a broken link never
  // takes the editor down with it.
  await expect(page.locator('.react-flow__node')).toHaveCount(STARTER_CARDS);
  await expect(page.getByText('This share link is damaged or truncated.')).toBeVisible();
});

test('export downloads valid preset JSON of the current graph', async ({ page }) => {
  await openEditor(page);

  // One extra card so the export provably reflects the LIVE graph, not the
  // starter set.
  await page.getByRole('button', { name: '+ generate', exact: true }).click();
  await page.getByRole('menu').getByRole('button', { name: 'Voronoi' }).click();
  await expect(page.locator('.react-flow__node')).toHaveCount(STARTER_CARDS + 1);

  const downloadPromise = page.waitForEvent('download');

  await page.getByRole('button', { name: 'export' }).click();

  const download = await downloadPromise;

  expect(download.suggestedFilename()).toBe('matter-graph.json');

  const path = await download.path();
  const { readFile } = await import('node:fs/promises');
  const parsed = JSON.parse(await readFile(path, 'utf8')) as {
    version: number;
    nodes: Array<{ spec: string }>;
    edges: unknown[];
  };

  expect(parsed.version).toBe(1);
  expect(parsed.nodes).toHaveLength(STARTER_CARDS + 1);
  expect(parsed.nodes.map((node) => node.spec)).toContain('voronoi');
  expect(parsed.edges).toHaveLength(6);
});

test('a loaded share link undoes back to the starter graph', async ({ page }) => {
  await openEditor(page);
  const cards = page.locator('.react-flow__node');

  await page.getByRole('button', { name: '+ generate', exact: true }).click();
  await page.getByRole('menu').getByRole('button', { name: 'Blobs' }).click();
  await page.getByRole('button', { name: 'share' }).click();
  await expect(page.getByRole('button', { name: 'copied' })).toBeVisible();

  const hash = await page.evaluate(() => window.location.hash);

  await page.goto('/' + hash);
  await expect(cards).toHaveCount(STARTER_CARDS + 1);

  // The load records one undo step, so Cmd+Z steps back to what the page
  // opened on — the starter graph.
  await page.keyboard.press('ControlOrMeta+z');
  await expect(cards).toHaveCount(STARTER_CARDS);
});
