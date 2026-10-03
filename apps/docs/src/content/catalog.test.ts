import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { getComponentsCatalog } from './catalog';

const POSTERS_DIR = fileURLToPath(new URL('../../public/posters', import.meta.url));

// The sidebar label derives from the slug, which prints "Led Wall" for
// led-wall. An entry can override it, and the JSX tag name must stay the
// slug's PascalCase either way, because it names the real export.
describe('getComponentsCatalog', () => {
  it('prints the label override where one exists and the prettified slug elsewhere', async () => {
    const catalog = await getComponentsCatalog();
    const ledWall = catalog.find((record) => record.url === '/components/led-wall');
    const dotField = catalog.find((record) => record.url === '/components/dot-field');

    expect(ledWall?.label).toBe('LED Wall');
    expect(ledWall?.componentName).toBe('LedWall');
    expect(dotField?.label).toBe('Dot Field');
  });

  // Each component page shows its poster before the scene's first frame, and
  // scripts/build-posters.sh writes it as a JPEG or a PNG. A component with
  // no poster file would ship a broken image.
  it('has a poster file for every component', async () => {
    const catalog = await getComponentsCatalog();
    const missing = catalog
      .map((record) => record.url.replace('/components/', ''))
      .filter(
        (slug) =>
          !existsSync(`${POSTERS_DIR}/${slug}.jpg`) && !existsSync(`${POSTERS_DIR}/${slug}.png`),
      );

    expect(missing).toEqual([]);
  });
});
