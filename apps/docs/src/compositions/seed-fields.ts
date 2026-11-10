/**
 * The seed a composition's store runs on each entry's props, keyed by the
 * entry's component, and the printer that turns the seeded shape back into
 * what the document wrote for the copied file. The store runs the seeds and
 * the generator runs the printers, on the composition page and in
 * golden.test.ts alike, so the golden files match what Copy React hands out.
 * Three-free, so the docs' Node vitest can load it.
 */
import { printCrossSection, seedCrossSection } from '@/app/components/fluted-glass/cross-section';
import { seedStyleDials } from '@/app/components/fractal-noise/style-dials';
import { seedLineColors } from '@/app/components/wave-lines/line-colors';

import type { ComponentName, StackEntry } from './define';
import type { SeedFields } from './store';

/**
 * Turns the props an entry prints from the shape the store holds into the
 * shape the document writes them in, such as FlutedGlass's dial value back
 * into its name. The generator runs it on the props it has chosen to print.
 */
export type PrintFields = (
  entry: StackEntry,
  props: Record<string, unknown>,
) => Record<string, unknown>;

type FieldsTransform = (props: Record<string, unknown>) => Record<string, unknown>;

const SEEDS: Partial<Record<ComponentName, FieldsTransform>> = {
  FlutedGlass: seedCrossSection,
  FractalNoise: seedStyleDials,
  WaveLines: seedLineColors,
};

const PRINTERS: Partial<Record<ComponentName, FieldsTransform>> = {
  FlutedGlass: printCrossSection,
};

export const seedFields: SeedFields = (entry, props) => SEEDS[entry.component]?.(props) ?? props;

export const printFields: PrintFields = (entry, props) =>
  PRINTERS[entry.component]?.(props) ?? props;
