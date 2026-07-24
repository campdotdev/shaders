import { useContext } from 'react';

import { ShaderContext, type ShaderContextValue } from '../../context/shader-context.js';

/**
 * The enclosing <ShaderScene>'s plumbing (renderer, scene, scheduler, ...),
 * or null outside one — callers treat null as "not mounted in a scene" and
 * fall back to stub behavior.
 */
export function useShaderContext(): ShaderContextValue | null {
  return useContext(ShaderContext);
}
