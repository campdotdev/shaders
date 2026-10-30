'use client';

/**
 * A composition's Customize panel: the preset picker at the top, then the
 * document's curated controls. Each control writes `<entry>.<path>` in the
 * composition's store, so a control on the 'base' entry's speed writes
 * base.speed. Every control subscribes to its own leaf, per the demo-store
 * gotcha in docs/agents/docs-site.md.
 */
import { useSyncExternalStore } from 'react';

import {
  ColorInput,
  ControlPanel,
  NumberInput,
  Section,
  SelectInput,
  SliderInput,
} from '@/components/controls';
import { SelectField } from '@/components/controls/SelectInput';
import type { Composition, CompositionControl } from '@/compositions/define';
import { type CompositionStore, DEFAULT_PRESET } from '@/compositions/store';

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
            <CuratedControl control={control} key={`${control.entry}.${control.path}`} />
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
  const preset = useSyncExternalStore(store.subscribe, store.getPreset, store.getPreset);
  const options = [DEFAULT_PRESET, ...composition.presets.map(({ name }) => name)].map((name) => ({
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

function CuratedControl({ control }: { control: CompositionControl }) {
  const path = `${control.entry}.${control.path}`;

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
