/**
 * The seeds that put a prop the All props fields can't edit as written into
 * a shape they can, without changing what the component renders.
 */
import { describe, expect, it } from 'vitest';

import { seedFields } from '@/compositions/seed-fields';

import { seedCrossSection } from './fluted-glass/cross-section';
import { seedStyleDials } from './fractal-noise/style-dials';
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

describe('seedStyleDials', () => {
  it("fills in the style's contrast and balance", () => {
    expect(seedStyleDials({ style: 'veins' })).toEqual({
      style: 'veins',
      contrast: 1,
      balance: 0.8,
    });
  });

  it('keeps a contrast the props set', () => {
    expect(seedStyleDials({ style: 'veins', contrast: 3 })).toMatchObject({ contrast: 3 });
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

describe('seedFields', () => {
  it("runs the seed for the entry's component", () => {
    expect(
      seedFields({ id: 'glass', component: 'FlutedGlass', props: {} }, { crossSection: 'flat' }),
    ).toEqual({ crossSection: 1 });
  });

  it('leaves a component with no seed alone', () => {
    expect(seedFields({ id: 'base', component: 'MeshGradient', props: {} }, { speed: 1 })).toEqual({
      speed: 1,
    });
  });
});
