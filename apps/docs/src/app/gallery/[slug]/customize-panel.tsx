'use client';

/**
 * A composition's Customize panel: the preset picker at the top, then the
 * document's curated controls, then a Copy React button for the generated
 * component file. Each control writes `<entry>.<path>` in the composition's
 * store, so a control on the 'base' entry's speed writes base.speed. Every
 * control subscribes to its own leaf, per the demo-store gotcha in
 * docs/agents/docs-site.md.
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
import { CheckIcon } from '@/components/icons/check';
import { CopyIcon } from '@/components/icons/copy';
import textButtonStyles from '@/components/text-button/text-button.module.css';
import visuallyHiddenStyles from '@/components/visually-hidden/visually-hidden.module.css';
import type { Composition, CompositionControl } from '@/compositions/define';
import { generateFromStore } from '@/compositions/generate';
import {
  type CompositionDefaults,
  type CompositionStore,
  DEFAULT_PRESET,
} from '@/compositions/store';
import { COPY_ANNOUNCEMENTS, useClipboardCopy } from '@/lib/use-clipboard-copy';

import styles from './customize-panel.module.css';

export function CustomizePanel({
  composition,
  defaults,
  store,
}: {
  composition: Composition;
  defaults: CompositionDefaults;
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
      <CopyReact composition={composition} defaults={defaults} store={store} />
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

// ----------------------------------------------------------------------------
// Copy React
// ----------------------------------------------------------------------------
// Reads the store at click time rather than subscribing, the way the page
// header's Copy React does, so a drag never re-renders the button.

// The copy glyph's 16px box, the size the header's button draws it at.
const COPY_ICON_SIZE = 16;

function CopyReact({
  composition,
  defaults,
  store,
}: {
  composition: Composition;
  defaults: CompositionDefaults;
  store: CompositionStore;
}) {
  const { status, copy } = useClipboardCopy();

  return (
    <div className={styles.copyRow}>
      <button
        className={`${textButtonStyles.box} ${textButtonStyles.button} ${styles.copyButton}`}
        onClick={() => copy(generateFromStore(composition, defaults, store))}
        type="button"
      >
        {status === 'copied' ? (
          <CheckIcon />
        ) : (
          <CopyIcon height={COPY_ICON_SIZE} width={COPY_ICON_SIZE} />
        )}
        Copy React
      </button>
      <span aria-live="polite" className={visuallyHiddenStyles.srOnly}>
        {COPY_ANNOUNCEMENTS[status]}
      </span>
    </div>
  );
}
