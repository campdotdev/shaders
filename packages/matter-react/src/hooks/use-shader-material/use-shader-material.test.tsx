import { renderHook } from '@testing-library/react'
import { vec3 } from 'three/tsl'
import { describe, expect, it } from 'vitest'

import { useShaderMaterial } from './use-shader-material.js'

describe('useShaderMaterial', () => {
  it('returns a MeshBasicNodeMaterial with colorNode set', () => {
    const { result } = renderHook(() => useShaderMaterial(() => vec3(1, 0, 0)))

    expect(result.current).toBeDefined()
    expect((result.current as unknown as { isMaterial: boolean }).isMaterial).toBe(true)
    expect(result.current.colorNode).toBeDefined()
  })

  it('disposes the material on unmount', () => {
    const { result, unmount } = renderHook(() => useShaderMaterial(() => vec3(1, 0, 0)))
    const material = result.current
    let disposed = false
    const original = material.dispose.bind(material)

    material.dispose = () => {
      disposed = true
      original()
    }
    unmount()
    expect(disposed).toBe(true)
  })

  it('rebuilds the material when the build function reference changes', () => {
    const { result, rerender } = renderHook(({ build }) => useShaderMaterial(build), {
      initialProps: { build: () => vec3(1, 0, 0) },
    })
    const first = result.current

    rerender({ build: () => vec3(0, 1, 0) })
    expect(result.current).not.toBe(first)
  })
})
