/**
 * The state behind a composition's Customize panel. It is the demo pages'
 * control store, shaped `{ [entryId]: props }`, plus the name of the loaded
 * preset, which the picker shows. Each entry's props start from the library
 * defaults that props.ts reads, with the stack's props on top, and a preset
 * adds its override on top of those. Pure and three-free, so the docs' Node
 * vitest covers it.
 */
import { type ControlStore, createControlStore } from '@/components/controls/store';

import type { ComponentName, Composition, EntryProps, StackEntry } from './define';

/** The picker's first choice: the stack's own props, with no preset applied. */
export const DEFAULT_PRESET = 'Default';

/** Every preset the picker offers, Default first. Each also gets a golden file. */
export function presetNames(composition: Composition): string[] {
  return [DEFAULT_PRESET, ...composition.presets.map(({ name }) => name)];
}

/** Each entry's props, keyed by entry id. */
export type CompositionState = Record<string, Record<string, unknown>>;

/** The library defaults for each entry's component, keyed by entry id. */
export type CompositionDefaults = Readonly<Record<string, EntryProps>>;

// ----------------------------------------------------------------------------
// The shape the fields edit
// ----------------------------------------------------------------------------
// The All props section mounts each component's demo fields, which edit every
// color stop's position. The library's default stops for the gradients leave
// positions out and space them evenly, so those stops get the positions the
// library would give them: index / (count - 1), as toColorRampStops in
// packages/shaders/src/components/shared/color.ts spaces them. The picture
// doesn't change, and the generator compares against the same shape.

/** The components whose demo fields edit a stop's position. demo-fields.test.ts keeps it current. */
export const POSITIONED_STOP_COMPONENTS: ReadonlySet<ComponentName> = new Set([
  'Aurora',
  'ConicGradient',
  'LinearGradient',
  'LiquidGradient',
  'RadialGradient',
]);

/** A component's props with each color stop's position written out. */
export function withStopPositions(
  component: ComponentName,
  props: EntryProps,
): Record<string, unknown> {
  const { stops } = props;

  if (!POSITIONED_STOP_COMPONENTS.has(component) || !Array.isArray(stops)) return { ...props };

  const lastIndex = Math.max(stops.length - 1, 1);

  return {
    ...props,
    stops: stops.map((stop: unknown, index) =>
      isRecord(stop) && typeof stop.position !== 'number'
        ? { ...stop, position: index / lastIndex }
        : stop,
    ),
  };
}

/** Whether a value is a plain object, as a literal prop's objects are. */
export function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

// ----------------------------------------------------------------------------
// Presets
// ----------------------------------------------------------------------------

/**
 * Every entry's props under one preset: the library defaults, then the
 * stack's props, then the preset's override, with stop positions written
 * out. Built from scratch each time, so loading a preset never keeps an
 * earlier edit.
 */
export function presetProps(
  composition: Composition,
  defaults: CompositionDefaults,
  presetName: string,
): CompositionState {
  const preset =
    presetName === DEFAULT_PRESET
      ? undefined
      : composition.presets.find(({ name }) => name === presetName);

  if (presetName !== DEFAULT_PRESET && preset === undefined) {
    throw new Error(`${composition.title} has no preset named "${presetName}".`);
  }

  return Object.fromEntries(
    composition.stack.map((entry) => [
      entry.id,
      withStopPositions(entry.component, {
        ...defaults[entry.id],
        ...entry.props,
        ...preset?.props[entry.id],
      }),
    ]),
  );
}

// ----------------------------------------------------------------------------
// The store
// ----------------------------------------------------------------------------

export interface CompositionStore extends ControlStore<CompositionState> {
  /** The name of the loaded preset. An edit doesn't change it. */
  getPreset: () => string;
  /** What the store runs on each entry's props when it loads them. The generator runs it too. */
  seed: SeedFields;
  /** Loads a preset, which also makes it what Reset returns to. */
  loadPreset: (presetName: string) => void;
}

/**
 * Whether a published control store is a composition's. The page header
 * reads the island's store through the copy source, which only knows it as a
 * control store.
 */
export function isCompositionStore(store: ControlStore<object>): store is CompositionStore {
  return 'getPreset' in store && 'loadPreset' in store;
}

/**
 * Fills in what an entry's fields need beyond the library defaults, such as
 * FractalNoise's contrast and balance, whose defaults follow its style, and
 * puts a prop the fields can't edit as written, such as FlutedGlass's named
 * cross-section, into a shape they can. The page supplies it from the demo
 * registry, because some of those values live in the package root, which the
 * docs' Node vitest can't load.
 */
export type SeedFields = (
  entry: StackEntry,
  props: Record<string, unknown>,
) => Record<string, unknown>;

export function createCompositionStore(
  composition: Composition,
  defaults: CompositionDefaults,
  seed: SeedFields = (_entry, props) => props,
): CompositionStore {
  const loadedProps = (presetName: string): CompositionState => {
    const state = presetProps(composition, defaults, presetName);

    return Object.fromEntries(
      composition.stack.map((entry) => [entry.id, seed(entry, state[entry.id] ?? {})]),
    );
  };

  let preset = DEFAULT_PRESET;
  const store = createControlStore(loadedProps(DEFAULT_PRESET));

  return {
    ...store,
    getPreset: () => preset,
    seed,
    loadPreset: (presetName) => {
      const loaded = loadedProps(presetName);

      // Set before load() notifies, so a subscriber reading it sees it agree
      // with the snapshot.
      preset = presetName;
      store.load(loaded);
    },
  };
}
