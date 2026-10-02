'use client';

// How an Effect joins its <ShaderScene> and leaves it again. usePostProcessPass
// and useBasePassUv each pick which list the Effect joins, and this hook owns
// the rest: register on mount, unregister on unmount, and swap registrations
// when a dependency changes. A change to that lifecycle lands here once.
import { type DependencyList, useEffect } from 'react';

import type { ShaderContextValue } from '../../context/shader-context.js';
import { useShaderContext } from '../use-shader-context/use-shader-context.js';

/**
 * Run `register` against the enclosing scene, and call the unregister
 * function it returns on unmount and before each re-register. It registers
 * again whenever a value in `deps` changes. Outside a mounted <ShaderScene>
 * it does nothing.
 */
export function useSceneRegistration(
  register: (shaderContext: ShaderContextValue) => () => void,
  deps: DependencyList,
): void {
  const shaderContext = useShaderContext();

  useEffect(() => {
    if (!shaderContext) return;

    return register(shaderContext);
    // `register` is a new closure on every render, so listing it would
    // re-register every render. `deps` decides when the Effect registers again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shaderContext, ...deps]);
}
