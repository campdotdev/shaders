/**
 * The seeds that put a prop a control can't edit as written into a shape it
 * can, without changing what the component renders.
 */
import { describe, expect, it } from 'vitest';

import { printFields, seedFields } from '@/compositions/seed-fields';

import { printCrossSection, seedCrossSection } from './fluted-glass/cross-section';
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

describe('printCrossSection', () => {
  it('turns a dial value on a named point back into its name', () => {
    expect(printCrossSection({ crossSection: 0 })).toEqual({ crossSection: 'prism' });
    expect(printCrossSection({ crossSection: 0.5 })).toEqual({ crossSection: 'round' });
    expect(printCrossSection({ crossSection: 1 })).toEqual({ crossSection: 'flat' });
  });

  it('reads slider float noise as the point it prints as', () => {
    expect(printCrossSection({ crossSection: 0.5000000000000001 })).toEqual({
      crossSection: 'round',
    });
  });

  it('leaves a value off the named points alone', () => {
    expect(printCrossSection({ crossSection: 0.3 })).toEqual({ crossSection: 0.3 });
    expect(printCrossSection({ dispersion: 0 })).toEqual({ dispersion: 0 });
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

describe('printFields', () => {
  it("runs the printer for the entry's component", () => {
    expect(
      printFields({ id: 'glass', component: 'FlutedGlass', props: {} }, { crossSection: 1 }),
    ).toEqual({ crossSection: 'flat' });
  });

  it('leaves a component with no printer alone', () => {
    expect(printFields({ id: 'base', component: 'MeshGradient', props: {} }, { speed: 1 })).toEqual(
      { speed: 1 },
    );
  });
});
