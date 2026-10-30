/**
 * The state behind a composition's Customize panel. It is the demo pages'
 * control store, shaped `{ [entryId]: props }`, plus the name of the loaded
 * preset, which the picker shows. Each entry's props start from the library
 * defaults that props.ts reads, with the stack's props on top, and a preset
 * adds its override on top of those. Pure and three-free, so the docs' Node
 * vitest covers it.
 */
import { type ControlStore, createControlStore } from '@/components/controls/store';

import type { Composition, EntryProps } from './define';

/** The picker's first choice: the stack's own props, with no preset applied. */
export const DEFAULT_PRESET = 'Default';

/** Each entry's props, keyed by entry id. */
export type CompositionState = Record<string, Record<string, unknown>>;

/** The library defaults for each entry's component, keyed by entry id. */
export type CompositionDefaults = Readonly<Record<string, EntryProps>>;

/**
 * Every entry's props under one preset: the library defaults, then the
 * stack's props, then the preset's override. Built from scratch each time,
 * so loading a preset never keeps an earlier edit.
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
      { ...defaults[entry.id], ...entry.props, ...preset?.props[entry.id] },
    ]),
  );
}

export interface CompositionStore extends ControlStore<CompositionState> {
  /** The name of the loaded preset. An edit doesn't change it. */
  getPreset: () => string;
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

export function createCompositionStore(
  composition: Composition,
  defaults: CompositionDefaults,
): CompositionStore {
  const store = createControlStore(presetProps(composition, defaults, DEFAULT_PRESET));
  let preset = DEFAULT_PRESET;

  return {
    ...store,
    getPreset: () => preset,
    loadPreset: (presetName) => {
      const next = presetProps(composition, defaults, presetName);

      // Set before load() notifies, so a subscriber reading both sees them agree.
      preset = presetName;
      store.load(next);
    },
  };
}
