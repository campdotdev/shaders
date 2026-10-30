'use client';

/**
 * A composition's Customize panel: the preset picker, the curated controls,
 * All props, and Copy React. Every control writes `<entry>.<path>` in the
 * composition's store and subscribes to its own leaf, per the demo-store
 * gotcha in docs/agents/docs-site.md.
 */
import { useSyncExternalStore } from 'react';

import { Collapsible } from '@base-ui/react/collapsible';

import { COMPONENT_FIELDS } from '@/app/components/demo-registry';
import {
  ColorInput,
  ControlPanel,
  NumberInput,
  Section,
  SelectInput,
  SliderInput,
} from '@/components/controls';
import { PathPrefixProvider } from '@/components/controls/context';
import controlStyles from '@/components/controls/controls.module.css';
import { SelectField } from '@/components/controls/SelectInput';
import { CaretRightIcon } from '@/components/icons/caret-right';
import { CheckIcon } from '@/components/icons/check';
import { ChevronDownIcon } from '@/components/icons/chevron-down';
import { CopyIcon } from '@/components/icons/copy';
import textButtonStyles from '@/components/text-button/text-button.module.css';
import visuallyHiddenStyles from '@/components/visually-hidden/visually-hidden.module.css';
import type { Composition, CompositionControl, StackEntry } from '@/compositions/define';
import { generateFromStore } from '@/compositions/generate';
import { type CompositionDefaults, type CompositionStore, presetNames } from '@/compositions/store';
import { COPY_ANNOUNCEMENTS, useClipboardCopy } from '@/lib/use-clipboard-copy';

import styles from './customize-panel.module.css';
import { useLoadedPreset } from './use-loaded-preset';

export function CustomizePanel({
  composition,
  defaults,
  labels,
  store,
}: {
  composition: Composition;
  defaults: CompositionDefaults;
  /** Each entry's component label, such as "Mesh Gradient", keyed by entry id. */
  labels: Readonly<Record<string, string>>;
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
      <Section title="All props">
        {composition.stack.map((entry) => (
          <EntryFields
            entry={entry}
            key={entry.id}
            label={labels[entry.id] ?? entry.component}
            store={store}
          />
        ))}
      </Section>
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
// All props
// ----------------------------------------------------------------------------
// One collapsed disclosure per stack entry, in ListInput's collapsible-row
// style, holding that component's demo fields under the entry's id. The
// fields mount when the entry opens, as ListInput's rows do: a slider that
// mounts hidden measures a zero-width track and draws nothing.

function EntryFields({
  entry,
  label,
  store,
}: {
  entry: StackEntry;
  label: string;
  store: CompositionStore;
}) {
  const { Fields } = COMPONENT_FIELDS[entry.component];
  const pointerProps = usePointerProps(store, entry.id);

  return (
    <Collapsible.Root className={controlStyles.disclosure}>
      <div className={controlStyles.disclosureHeader}>
        {/* Both glyphs render and CSS shows one, keyed off Base UI's
            data-panel-open, as ListInput's rows do. */}
        <Collapsible.Trigger className={controlStyles.disclosureTrigger}>
          <CaretRightIcon className={controlStyles.disclosureClosedIcon} height="16" width="16" />
          <ChevronDownIcon className={controlStyles.disclosureOpenIcon} />
          <span className={controlStyles.rowLabel}>{label}</span>
        </Collapsible.Trigger>
      </div>
      <Collapsible.Panel className={controlStyles.disclosurePanel}>
        <div className={styles.entryFields}>
          {pointerProps === '' ? (
            <PathPrefixProvider segments={[entry.id]}>
              <Fields />
            </PathPrefixProvider>
          ) : (
            <p className={styles.entryNote}>
              Follows the pointer through {pointerProps}, which these fields edit as a point. Set it
              to a point in the composition to edit {label} here.
            </p>
          )}
        </div>
      </Collapsible.Panel>
    </Collapsible.Root>
  );
}

/**
 * The entry's props set to `'cursor'`, the shorthand that follows the
 * pointer, joined into one string so the subscription compares a primitive.
 * A demo's fields edit a position as a point, such as `center.0`, and reading
 * a coordinate out of the string would throw, so the entry shows a note in
 * their place while any prop follows the pointer.
 */
function usePointerProps(store: CompositionStore, entryId: string): string {
  const read = () =>
    Object.entries(store.getSnapshot()[entryId] ?? {})
      .filter(([, value]) => value === 'cursor')
      .map(([name]) => name)
      .join(', ');

  return useSyncExternalStore(store.subscribe, read, read);
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
