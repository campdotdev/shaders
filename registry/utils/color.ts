import type { ColorRampStop } from '@lovo/matter';
import { vec3 } from 'three/tsl';

export const parseHex = (hex: string): [number, number, number] => {
  const cleanedHex = hex.replace('#', '');

  return [
    parseInt(cleanedHex.slice(0, 2), 16) / 255,
    parseInt(cleanedHex.slice(2, 4), 16) / 255,
    parseInt(cleanedHex.slice(4, 6), 16) / 255,
  ];
};

/**
 * A single color stop in a gradient ramp. `position` is optional; when omitted,
 * stops are spaced evenly across the [0, 1] range in array order.
 */
export interface ColorStop {
  color: string;
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
    const [redChannel, greenChannel, blueChannel] = parseHex(stop.color);
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
