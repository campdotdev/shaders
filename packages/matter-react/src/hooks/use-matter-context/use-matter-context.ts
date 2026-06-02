import { useContext } from 'react'

import { ShaderContext, type ShaderContextValue } from '../../context/matter-context.js'

/**
 * Read the shader scene context. Returns null when called outside a
 * <ShaderScene>; useShaderMaterial and similar hooks check this.
 */
export function useShaderContext(): ShaderContextValue | null {
  return useContext(ShaderContext)
}

/** @deprecated Use useShaderContext — alias removed in 0.5.0 */
export const useMatterContext = useShaderContext
