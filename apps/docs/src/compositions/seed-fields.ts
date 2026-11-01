/**
 * The seed a composition's store runs on each entry's props, keyed by the
 * entry's component. The Customize panel and golden.test.ts both use it, so
 * the golden files match what Copy React hands out. Three-free, so the
 * docs' Node vitest can load it.
 */
import { seedCrossSection } from '@/app/components/fluted-glass/cross-section';
import { seedStyleDials } from '@/app/components/fractal-noise/style-dials';
import { seedLineColors } from '@/app/components/wave-lines/line-colors';

import type { ComponentName } from './define';
import type { SeedFields } from './store';

const SEEDS: Partial<
  Record<ComponentName, (props: Record<string, unknown>) => Record<string, unknown>>
> = {
  FlutedGlass: seedCrossSection,
  FractalNoise: seedStyleDials,
  WaveLines: seedLineColors,
};

export const seedFields: SeedFields = (entry, props) => SEEDS[entry.component]?.(props) ?? props;
