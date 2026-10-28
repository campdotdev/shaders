'use client';

import type { DependencyList } from 'react';

import type { Resample } from '../../context/shader-context.js';
import { useSceneRegistration } from '../use-scene-registration/use-scene-registration.js';

/**
 * Register a resample with the enclosing <ShaderScene>. `resample` receives
 * the sampler for everything mounted beneath this Effect and returns the
 * sampler that replaces it. The new sampler can call the one beneath more
 * than once, such as three times for a color split. Each call reruns every
 * resample beneath it, so sample counts multiply down the stack. Resamples
 * stack in mount order, and the last-mounted one acts as the top layer.
 * They read only what Sources drew, because color transforms such as Grain
 * run after every resample. `deps` works like an effect dependency list, so
 * list every non-uniform value the resample closes over.
 */
export function useResample(resample: Resample, deps: DependencyList): void {
  useSceneRegistration((shaderContext) => shaderContext.registerResample(resample), deps);
}
