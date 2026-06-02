import { useContext } from 'react'

import { ShaderContext, type ShaderContextValue } from '../../context/shader-context.js'

/**
 * Read the shader scene context. Returns null when called outside a
 * <ShaderScene>; useShaderMaterial and similar hooks check this.
 */
export function useShaderContext(): ShaderContextValue | null {
  return useContext(ShaderContext)
}
