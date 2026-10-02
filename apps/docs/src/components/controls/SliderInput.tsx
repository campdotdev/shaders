'use client';

/**
 * A number prop: a draggable bar plus an editable readout. Base UI's Slider
 * handles pointer capture, arrow-key stepping, Page Up/Down (largeStep), and
 * the ARIA value attributes; NumberReadout handles typed entry and clamping.
 * onValueChange fires continuously through a drag, which is fine here: numeric
 * props travel through stable uniform nodes on the GPU side and cost nothing
 * per frame. Inside a list row the visible label drops away, since the row
 * already names the control.
 */
import { Slider } from '@base-ui/react/slider';

import visuallyHiddenStyles from '@/components/visually-hidden/visually-hidden.module.css';

import { useListRowTrail } from './context';
import styles from './controls.module.css';
import { decimalsForStep } from './decimals';
import { NumberReadout } from './NumberReadout';
import type { PathInput } from './store';
import { usePropValue, useSetProp } from './useControl';

export interface SliderInputProps {
  /** Where this control reads and writes in the page's params. */
  path: PathInput;
  /** Visible label, in everyday words. */
  label: string;
  min: number;
  max: number;
  step: number;
  /** Jump size for Page Up/Down. Defaults to ten steps. */
  largeStep?: number;
  /** Most decimal places the readout shows. Defaults to what `step` implies. */
  decimals?: number;
}

export function SliderInput({
  path,
  label,
  min,
  max,
  step,
  largeStep,
  decimals,
}: SliderInputProps) {
  const value = usePropValue<number>(path);
  const setProp = useSetProp();
  const trail = useListRowTrail();
  const inRow = trail.length > 0;

  // "Speed for line 2" rather than a bare "Speed" repeated on every row, so
  // a screen reader can tell the fields apart.
  const name = inRow ? `${label} for ${trail.join(' > ')}` : label;
  const fractionDigits = decimals ?? decimalsForStep(step);
  const format: Intl.NumberFormatOptions = { maximumFractionDigits: fractionDigits };

  const commit = (next: number) => {
    setProp(path, Math.min(max, Math.max(min, next)));
  };

  return (
    <div className={styles.field}>
      <Slider.Root
        className={styles.sliderRoot}
        format={format}
        largeStep={largeStep ?? step * 10}
        max={max}
        min={min}
        onValueChange={commit}
        step={step}
        // Keeps the whole 4px thumb inside the track at 0 and at max, instead
        // of centering it on the edge where half of it would be clipped.
        thumbAlignment="edge"
        value={value}
      >
        <Slider.Label className={inRow ? visuallyHiddenStyles.srOnly : styles.fieldLabel}>
          {name}
        </Slider.Label>
        <Slider.Control className={styles.sliderControl}>
          <Slider.Track className={styles.sliderTrack}>
            <Slider.Indicator className={styles.sliderIndicator} />
            <Slider.Thumb className={styles.sliderThumb} />
          </Slider.Track>
        </Slider.Control>
      </Slider.Root>
      <NumberReadout
        ariaLabel={`${name} value`}
        decimals={fractionDigits}
        largeStep={largeStep ?? step * 10}
        max={max}
        min={min}
        onCommit={commit}
        step={step}
        value={value}
      />
    </div>
  );
}
