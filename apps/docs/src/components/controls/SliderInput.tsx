'use client';

/**
 * A number prop: a draggable track plus an editable readout. Base UI's Slider
 * handles pointer capture, arrow-key stepping, Page Up/Down (largeStep), and
 * the ARIA value attributes; NumberField handles typed entry and clamping.
 * onValueChange fires continuously through a drag, which is fine here — numeric
 * props travel through stable uniform nodes on the GPU side and cost nothing per frame.
 */
import { NumberField } from '@base-ui/react/number-field';
import { Slider } from '@base-ui/react/slider';

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
  /** Decimal places in the readout. Defaults to what `step` implies. */
  decimals?: number;
}

/** 0.05 -> 2, 1 -> 0. Matches the readout's decimal places to what `step` implies. */
const decimalsForStep = (step: number) =>
  step >= 1 ? 0 : Math.min(4, Math.ceil(-Math.log10(step)));

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

  const fractionDigits = decimals ?? decimalsForStep(step);
  const format: Intl.NumberFormatOptions = {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  };

  const commit = (next: number) => {
    setProp(path, Math.min(max, Math.max(min, next)));
  };

  return (
    <div className="controls-field">
      <Slider.Root
        className="slider-root"
        format={format}
        largeStep={largeStep ?? step * 10}
        max={max}
        min={min}
        onValueChange={commit}
        step={step}
        value={value}
      >
        <Slider.Label className="controls-field-label">{label}</Slider.Label>
        <Slider.Control className="slider-control">
          <Slider.Track className="slider-track">
            <Slider.Indicator className="slider-indicator" />
            <Slider.Thumb className="slider-thumb" />
          </Slider.Track>
        </Slider.Control>
      </Slider.Root>
      <NumberField.Root
        format={format}
        max={max}
        min={min}
        onValueChange={(next) => {
          if (next !== null) commit(next);
        }}
        step={step}
        value={value}
      >
        <NumberField.Group>
          <NumberField.Input aria-label={`${label} value`} className="number-input" />
        </NumberField.Group>
      </NumberField.Root>
    </div>
  );
}
