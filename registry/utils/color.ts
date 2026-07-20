import { type ColorRampStop, parseColorString } from '@lovo/matter';
import { vec3 } from 'three/tsl';

/**
 * Parse a color string into **extended** linear-sRGB channels. Accepts `#rrggbb`,
 * `oklch(...)`, and `oklab(...)`.
 *
 * Hex is gamma-encoded sRGB and decodes into [0, 1]; oklch/oklab may land outside
 * sRGB (channels below 0 or above 1) for wide-gamut (P3) colors. Those extended
 * values survive to a P3 output and clamp per-channel on an sRGB output. The
 * renderer re-encodes linear->output on output, so solid colors render true.
 */
export const parseColor = (color: string): [number, number, number] => parseColorString(color);

/** @deprecated Use {@link parseColor}; retained so existing call sites keep working. */
export const parseHex = parseColor;

/** A color stop in a gradient ramp. */
export interface ColorStop {
  /** Stop color — hex, `oklch()`, or `oklab()`. */
  color: string;
  /** Position along the ramp, 0–1. Positions auto-space evenly when omitted. */
  position?: number;
}

/** A fixed set of four colors, used by palette-cycling components. */
export type Palette = [string, string, string, string];

/**
 * Stable string proxy for a ColorStop[] — use in `useEffect` deps so material
 * rebuilds track content changes (hex/position) rather than array identity.
 */
export const colorStopsKey = (stops: ColorStop[]): string =>
  stops.map((stop) => `${stop.color}@${stop.position ?? ''}`).join('|');

/**
 * Convert a ColorStop[] into the engine's ColorRampStop[] (parsed vec3 colors +
 * resolved positions). Stops without an explicit position are spaced evenly in
 * array order; explicit positions are clamped to [0, 1].
 */
export const toColorRampStops = (stops: ColorStop[]): ColorRampStop[] => {
  const lastIndex = Math.max(stops.length - 1, 1);

  return stops.map((stop, index) => {
    const [redChannel, greenChannel, blueChannel] = parseColor(stop.color);
    const position =
      typeof stop.position === 'number'
        ? Math.min(Math.max(stop.position, 0), 1)
        : index / lastIndex;

    return {
      color: vec3(redChannel, greenChannel, blueChannel),
      position,
    };
  });
};
