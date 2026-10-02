'use client';

/**
 * A number prop as a typed box with no track: the mock's percent field on a
 * gradient stop, where a position is something you read and type more than
 * something you sweep. `scale` and `unit` present a 0..1 value in the store
 * as "35 %" without changing what the store holds. Inside a list row the
 * visible label drops away, since the row already names the control.
 */
import visuallyHiddenStyles from '@/components/visually-hidden/visually-hidden.module.css';

import { useListRowTrail } from './context';
import styles from './controls.module.css';
import { decimalsForStep } from './decimals';
import { NumberReadout } from './NumberReadout';
import type { PathInput } from './store';
import { usePropValue, useSetProp } from './useControl';

export interface NumberInputProps {
  /** Where this control reads and writes in the page's params. */
  path: PathInput;
  /** Visible label, in everyday words. */
  label: string;
  /** Bounds and step in the store's units, not the displayed ones. */
  min: number;
  max: number;
  step: number;
  /** Jump size for Page Up/Down, in the store's units. Defaults to ten steps. */
  largeStep?: number;
  /** Most decimal places in the readout. Defaults to what the displayed `step` implies. */
  decimals?: number;
  /** Text after the digits, e.g. "%". */
  unit?: string;
  /** Multiplier from the store's value to the displayed one: 100 shows 0.35 as 35. Defaults to 1. */
  scale?: number;
}

export function NumberInput({
  path,
  label,
  min,
  max,
  step,
  largeStep,
  decimals,
  unit,
  scale = 1,
}: NumberInputProps) {
  const value = usePropValue<number>(path);
  const setProp = useSetProp();
  const trail = useListRowTrail();
  const inRow = trail.length > 0;

  // "Position for stop 2" rather than a bare "Position" repeated on every
  // row, so a screen reader can tell the fields apart.
  const name = inRow ? `${label} for ${trail.join(' > ')}` : `${label} value`;
  const displayStep = step * scale;

  const commit = (next: number) => {
    setProp(path, Math.min(max, Math.max(min, next / scale)));
  };

  return (
    <div className={styles.field}>
      <span className={inRow ? visuallyHiddenStyles.srOnly : styles.fieldLabel}>{label}</span>
      <NumberReadout
        ariaLabel={name}
        decimals={decimals ?? decimalsForStep(displayStep)}
        largeStep={(largeStep ?? step * 10) * scale}
        max={max * scale}
        min={min * scale}
        onCommit={commit}
        step={displayStep}
        unit={unit}
        value={value * scale}
      />
    </div>
  );
}
