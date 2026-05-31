'use client'

import { useAnimatableUniform, useOverlayPass } from '@lovo/matter-react'
import { useMemo } from 'react'
import { Color } from 'three'
import { mix as tslMix, vec4 } from 'three/tsl'

export interface TintOverlayProps {
  color: string
  intensity: number
}

/**
 * Dev-only validation overlay. NOT exported from the registry.
 * Mixes the input color toward `color` by `intensity`.
 */
export function TintOverlay({ color, intensity }: TintOverlayProps) {
  const tintColor = useMemo(() => {
    const c = new Color(color)

    return vec4(c.r, c.g, c.b, 1)
  }, [color])
  const intensityU = useAnimatableUniform<number>(intensity)

  useOverlayPass((input) => tslMix(input, tintColor, intensityU), [tintColor, intensityU])

  return null
}
