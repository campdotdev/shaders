'use client';

import type { DependencyList } from 'react';

import type { UvTransform } from '../../context/shader-context.js';
import { useResample } from '../use-resample/use-resample.js';

/**
 * Register a UV warp with the enclosing <ShaderScene>. `transform` receives
 * the 0..1 coordinate the image beneath this Effect is about to be sampled
 * at and returns a replacement, such as a coordinate snapped to a grid. A
 * color-only usePostProcessPass cannot move a sample. The hook registers the
 * resample that samples the image beneath once, at the warped coordinate.
 * UV warps stack in mount order, and the last-mounted one moves the screen
 * coordinate first, so it acts as the top layer. They bend only what Sources
 * drew. Other Effects' own contributions, such as a vignette's shape or
 * grain's speckle, stay at native resolution. `deps` works like an effect
 * dependency list, so list every non-uniform value the transform closes over.
 */
export function useBasePassUv(transform: UvTransform, deps: DependencyList): void {
  useResample((sampleBeneath) => (coordinate) => sampleBeneath(transform(coordinate)), deps);
}
