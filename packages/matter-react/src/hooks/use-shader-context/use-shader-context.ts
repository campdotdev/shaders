import { useContext } from 'react'

import { ShaderContext, type ShaderContextValue } from '../../context/shader-context.js'

export function useShaderContext(): ShaderContextValue | null {
  return useContext(ShaderContext)
}
