/**
 * The seeds that put a prop the All props fields can't edit as written into
 * a shape they can, without changing what the component renders.
 */
import { describe, expect, it } from 'vitest';

import { seedCrossSection } from './fluted-glass/cross-section';
import { seedLineColors } from './wave-lines/line-colors';

describe('seedCrossSection', () => {
  it('turns a named cross-section into its dial value', () => {
    expect(seedCrossSection({ crossSection: 'round' })).toEqual({ crossSection: 0.5 });
    expect(seedCrossSection({ crossSection: 'flat' })).toEqual({ crossSection: 1 });
  });

  it('leaves a dial value alone', () => {
    expect(seedCrossSection({ crossSection: 0.3 })).toEqual({ crossSection: 0.3 });
  });
});

describe('seedLineColors', () => {
  it('turns a single or omitted line color into a one-stop list', () => {
    expect(seedLineColors({ lines: [{ color: '#ffffff' }, {}] })).toEqual({
      lines: [{ color: ['#ffffff'] }, { color: ['#ff6f6a'] }],
    });
  });

  it('leaves a list of stops alone', () => {
    const lines = [{ color: ['#000000', '#ffffff'] }];

    expect(seedLineColors({ lines })).toEqual({ lines });
  });
});
