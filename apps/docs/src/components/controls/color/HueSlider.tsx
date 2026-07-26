'use client';

/**
 * Hue, 0-360 degrees. The track is a CSS gradient built from the color's own
 * lightness and chroma, so it previews the actual hues reachable at the current
 * settings rather than a fixed rainbow. Stops are oklch() strings, so the track
 * is wide-gamut on a P3 display for free.
 */
import { Slider } from '@base-ui/react/slider';

import type { OklchColor } from './oklch';

const HUE_STOP_COUNT = 12;

const trackGradient = ({ lightness, chroma }: OklchColor) => {
  const stops = Array.from({ length: HUE_STOP_COUNT + 1 }, (_unused, index) => {
    const hue = (index / HUE_STOP_COUNT) * 360;

    return `oklch(${lightness} ${chroma} ${hue}) ${(index / HUE_STOP_COUNT) * 100}%`;
  });

  return `linear-gradient(to right, ${stops.join(', ')})`;
};

export function HueSlider({
  color,
  onPreview,
  onCommit,
}: {
  color: OklchColor;
  onPreview: (next: OklchColor) => void;
  onCommit: () => void;
}) {
  return (
    <Slider.Root
      max={360}
      min={0}
      onValueChange={(next) => onPreview({ ...color, hue: next })}
      onValueCommitted={onCommit}
      step={1}
      value={color.hue}
    >
      <Slider.Control className="slider-control">
        <Slider.Track className="slider-track" style={{ background: trackGradient(color) }}>
          <Slider.Thumb aria-label="Hue" className="slider-thumb" />
        </Slider.Track>
      </Slider.Control>
    </Slider.Root>
  );
}
