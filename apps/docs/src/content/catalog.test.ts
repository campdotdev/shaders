import { describe, expect, it } from 'vitest';

import { getComponentsCatalog } from './catalog';

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
});
