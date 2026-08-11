// Scalar helpers for the primitive demo pages: turning a control schema into
// its initial state, and validating raw playground state into the typed
// per-primitive params PrimitiveScene renders from. Kept out of the component
// files on purpose — PrimitiveDemo loads PrimitiveScene via next/dynamic
// (ssr: false) because three/webgpu cannot run during server rendering, and a
// static import of these helpers from PrimitiveScene would drag the whole
// three graph back into the server bundle. This module is three-free, and
// keeping component files component-only also lets Fast Refresh preserve
// their state across edits.
import type { PropSchema, PropsState } from './PropsPlayground';

export type PrimitiveParams =
  | { slug: 'color-ramp'; position: number }
  | { slug: 'mix-color'; t: number }
  | { slug: 'noise'; scale: number; speed: number }
  | {
      slug: 'fbm';
      scale: number;
      speed: number;
      octaves: number;
      lacunarity: number;
      gain: number;
    }
  | { slug: 'voronoi'; scale: number; speed: number }
  | { slug: 'quantize'; bins: number }
  | { slug: 'sdf-circle'; radius: number; cx: number; cy: number }
  | { slug: 'displace'; x: number; y: number }
  | { slug: 'cursor-ripple'; amplitude: number; falloff: number; speed: number }
  | { slug: 'time' };

export function initialStateFromSchema(schema: PropSchema): PropsState {
  const initialState: PropsState = {};

  for (const entry of schema) {
    initialState[entry.name] = entry.type === 'colors' ? [...entry.default] : entry.default;
  }

  return initialState;
}

export function buildPrimitiveParams(slug: string, raw: PropsState): PrimitiveParams {
  const num = (key: string): number => {
    const paramValue = raw[key];

    if (typeof paramValue !== 'number') {
      throw new Error(
        `primitive '${slug}': missing or non-number param '${key}' (got ${typeof paramValue}). Check @/data/primitives.ts.`,
      );
    }

    return paramValue;
  };

  switch (slug) {
    case 'color-ramp':
      return { slug, position: num('position') };
    case 'mix-color':
      return { slug, t: num('t') };
    case 'noise':
      return { slug, scale: num('scale'), speed: num('speed') };
    case 'fbm':
      return {
        slug,
        scale: num('scale'),
        speed: num('speed'),
        octaves: num('octaves'),
        lacunarity: num('lacunarity'),
        gain: num('gain'),
      };
    case 'voronoi':
      return { slug, scale: num('scale'), speed: num('speed') };
    case 'quantize':
      return { slug, bins: num('bins') };
    case 'sdf-circle':
      return { slug, radius: num('radius'), cx: num('cx'), cy: num('cy') };
    case 'displace':
      return { slug, x: num('x'), y: num('y') };
    case 'cursor-ripple':
      return {
        slug,
        amplitude: num('amplitude'),
        falloff: num('falloff'),
        speed: num('speed'),
      };
    case 'time':
      return { slug: 'time' };
    default:
      throw new Error(`Unknown primitive slug: '${slug}'`);
  }
}
