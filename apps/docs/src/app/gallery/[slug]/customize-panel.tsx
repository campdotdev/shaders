'use client';

/**
 * A composition's Customize panel: the preset picker and the curated controls.
 * Every control writes `<entry>.<path>` in the composition's store and
 * subscribes to its own leaf, per the demo-store gotcha in
 * docs/agents/docs-site.md.
 */
import { useMemo, useSyncExternalStore } from 'react';

import {
  ColorInput,
  ControlPanel,
  NumberInput,
  Section,
  SelectInput,
  SliderInput,
} from '@/components/controls';
import { PathPrefixProvider } from '@/components/controls/context';
import { SelectField } from '@/components/controls/SelectInput';
import { normalizePath } from '@/components/controls/store';
import type { Composition, CompositionControl } from '@/compositions/define';
import { type CompositionStore, presetNames } from '@/compositions/store';

import { useLoadedPreset } from './use-loaded-preset';

export function CustomizePanel({
  composition,
  store,
}: {
  composition: Composition;
  store: CompositionStore;
}) {
  return (
    <ControlPanel title="Customize">
      <PresetPicker composition={composition} store={store} />
      {composition.controls.length === 0 ? null : (
        <Section title="Controls">
          {composition.controls.map((control) => (
            <CuratedControl
              control={control}
              key={JSON.stringify([control.entry, control.path])}
              store={store}
            />
          ))}
        </Section>
      )}
    </ControlPanel>
  );
}

// ----------------------------------------------------------------------------
// The preset picker
// ----------------------------------------------------------------------------
// It shows the loaded preset, not whether the props still match it: after an
// edit it keeps the preset's name, and Reset goes back to that preset.

function PresetPicker({
  composition,
  store,
}: {
  composition: Composition;
  store: CompositionStore;
}) {
  const preset = useLoadedPreset(store);
  const options = presetNames(composition).map((name) => ({
    label: name,
    value: name,
  }));

  return (
    <SelectField label="Preset" onValueChange={store.loadPreset} options={options} value={preset} />
  );
}

// ----------------------------------------------------------------------------
// Curated controls
// ----------------------------------------------------------------------------

/**
 * One curated control, under its entry's id as a single path segment, so an
 * id with a dot in it stays one key. It mounts only while its target exists:
 * a preset can load fewer stops than a control edits, a position set to
 * `'cursor'` has no coordinates to read, and a control that reads a missing
 * path throws.
 */
function CuratedControl({
  control,
  store,
}: {
  control: CompositionControl;
  store: CompositionStore;
}) {
  const target = useMemo(
    () => [control.entry, ...normalizePath(control.path)],
    [control.entry, control.path],
  );
  const read = () => {
    try {
      store.getAtPath(target);

      return true;
    } catch {
      return false;
    }
  };
  const present = useSyncExternalStore(store.subscribe, read, read);

  if (!present) return null;

  return (
    <PathPrefixProvider segments={[control.entry]}>
      <CuratedInput control={control} />
    </PathPrefixProvider>
  );
}

function CuratedInput({ control }: { control: CompositionControl }) {
  const { path } = control;

  switch (control.kind) {
    case 'slider':
      return (
        <SliderInput
          label={control.label}
          max={control.max}
          min={control.min}
          path={path}
          step={control.step}
        />
      );
    case 'number':
      return (
        <NumberInput
          label={control.label}
          max={control.max}
          min={control.min}
          path={path}
          step={control.step}
        />
      );
    case 'select':
      return <SelectInput label={control.label} options={control.options} path={path} />;
    case 'color':
      return <ColorInput label={control.label} path={path} />;
  }
}
