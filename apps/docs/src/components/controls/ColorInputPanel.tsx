'use client';

/**
 * A color prop. The swatch button opens a popover holding the chroma/lightness
 * plane, a hue slider, keyboard-reachable lightness and chroma sliders, and a
 * text field that accepts any color string the engine parses.
 *
 * Colors commit on release, not continuously. LinearGradient, SimplexNoise, and
 * WaveLines rebuild their NodeMaterial whenever colors change, because colorRamp
 * bakes color literals into the compiled shader — so a continuous drag would
 * recompile the shader every frame. Everything inside the popover updates from
 * local draft state; only pointer release, Enter, or blur reaches the store.
 * Numeric props have no such problem and do update live (see SliderInput).
 */
import { type ChangeEvent, useState } from 'react';

import { Popover } from '@base-ui/react/popover';
import { Slider } from '@base-ui/react/slider';

import { ColorArea } from './color/ColorArea';
import { HueSlider } from './color/HueSlider';
import { formatOklch, MAX_CHROMA, type OklchColor, parseToOklch } from './color/oklch';
import type { PathInput } from './store';
import { usePropValue, useSetProp } from './useControl';

export interface ColorInputProps {
  path: PathInput;
  label: string;
}

export function ColorInput({ path, label }: ColorInputProps) {
  const stored = usePropValue<string>(path);
  const setProp = useSetProp();

  // Non-null only while a gesture is in flight. Everything renders from
  // `color`, so the popover tracks the drag while the store stays still.
  const [draft, setDraft] = useState<OklchColor | null>(null);
  const [typed, setTyped] = useState<string | null>(null);
  const [typedIsInvalid, setTypedIsInvalid] = useState(false);

  const color = draft ?? parseToOklch(stored);
  const cssColor = formatOklch(color);

  const commit = () => {
    if (draft === null) return;

    setProp(path, formatOklch(draft));
    setDraft(null);
  };

  const commitTyped = () => {
    if (typed === null) return;

    try {
      const parsed = parseToOklch(typed);

      setProp(path, formatOklch(parsed));
      setTyped(null);
      setTypedIsInvalid(false);
    } catch {
      setTypedIsInvalid(true);
    }
  };

  const handleTyping = (event: ChangeEvent<HTMLInputElement>) => {
    setTyped(event.target.value);
    setTypedIsInvalid(false);
  };

  return (
    <div className="controls-field">
      <span className="controls-field-label">{label}</span>
      <Popover.Root onOpenChange={(open) => !open && commit()}>
        <Popover.Trigger className="color-swatch-trigger">
          <span aria-hidden="true" className="color-swatch" style={{ background: cssColor }} />
          <span className="color-swatch-value">{cssColor}</span>
          <span className="sr-only">{`Edit ${label}`}</span>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner sideOffset={6}>
            <Popover.Popup className="color-popup">
              <ColorArea color={color} onCommit={commit} onPreview={setDraft} />
              <HueSlider color={color} onCommit={commit} onPreview={setDraft} />
              <PopoverSlider
                label="Lightness"
                max={1}
                onCommit={commit}
                onPreview={(next) => setDraft({ ...color, lightness: next })}
                step={0.01}
                value={color.lightness}
              />
              <PopoverSlider
                label="Chroma"
                max={MAX_CHROMA}
                onCommit={commit}
                onPreview={(next) => setDraft({ ...color, chroma: next })}
                step={0.005}
                value={color.chroma}
              />
              <input
                aria-invalid={typedIsInvalid}
                aria-label={`${label} value`}
                className="color-text-input"
                onBlur={commitTyped}
                onChange={handleTyping}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') commitTyped();
                }}
                spellCheck={false}
                value={typed ?? cssColor}
              />
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}

function PopoverSlider({
  label,
  value,
  max,
  step,
  onPreview,
  onCommit,
}: {
  label: string;
  value: number;
  max: number;
  step: number;
  onPreview: (next: number) => void;
  onCommit: () => void;
}) {
  return (
    <Slider.Root
      max={max}
      min={0}
      onValueChange={(next) => onPreview(next)}
      onValueCommitted={onCommit}
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
  );
}
