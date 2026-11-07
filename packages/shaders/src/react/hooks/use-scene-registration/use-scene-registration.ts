'use client';

// How an Effect joins its <ShaderScene> and leaves it again. usePostProcessPass
// and useResample each pick which list the Effect joins, and this hook owns
// the rest: register on mount, unregister on unmount, swap registrations when
// a dependency changes, and ask for a frame after each so a parked scene shows
// the change. A change to that lifecycle lands here once.
import { type DependencyList, useEffect, useState } from 'react';

import type { ShaderContextValue, Slot } from '../../context/shader-context.js';
import { useShaderContext } from '../use-shader-context/use-shader-context.js';

/**
 * Run `register` against the enclosing scene, and call the unregister
 * function it returns on unmount and before each re-register. It registers
 * again whenever a value in `deps` changes, under the same slot, so the
 * Effect keeps its place in the stack. Each change asks the scene for a frame.
 * Outside a mounted <ShaderScene> it does nothing.
 */
export function useSceneRegistration(
  register: (shaderContext: ShaderContextValue, slot: Slot) => () => void,
  deps: DependencyList,
): void {
  const shaderContext = useShaderContext();
  // This Effect's place in the scene's list, held for as long as it stays
  // mounted.
  const [slot] = useState<Slot>(() => ({}));

  useEffect(() => {
    if (!shaderContext) return;

    const { scheduler } = shaderContext;
    const unregister = register(shaderContext, slot);

    // Registering and unregistering each rebuild the output material, the
    // shader that draws the finished image to the canvas, and draw nothing. A
    // parked scene would keep showing the old image: the bare-uniform-write
    // gotcha in `docs/agents/tsl.md`, set off by a rebuild. requestRender
    // returns at once unless the scene is idle.
    scheduler.requestRender();

    return () => {
      unregister();
      scheduler.requestRender();
    };
    // `register` is a new closure on every render, so listing it would
    // re-register every render. `deps` decides when the Effect registers again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shaderContext, slot, ...deps]);
}
