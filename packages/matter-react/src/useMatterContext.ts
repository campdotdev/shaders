import { useContext } from 'react'

import { MatterContext, type MatterContextValue } from './matter-context.js'

/**
 * Read the matter scene context. Returns null when called outside a
 * <MatterScene>; useShaderMaterial and similar hooks check this and
 * auto-provision a scene if missing (auto-wrap behavior).
 */
export function useMatterContext(): MatterContextValue | null {
  return useContext(MatterContext)
}
