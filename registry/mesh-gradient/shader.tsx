'use client'

import { useEffect } from 'react'
import { Mesh, MeshBasicNodeMaterial, PlaneGeometry } from 'three/webgpu'
import { vec4 } from 'three/tsl'

import { useMatterContext } from '@lovo/matter-react'

export interface MeshGradientShaderProps {
  // Phases 2+ will add props here; Phase 1 renders a hardcoded solid color.
}

export function MeshGradientShader(_props: MeshGradientShaderProps) {
  const ctx = useMatterContext()

  useEffect(() => {
    if (!ctx) return
    const material = new MeshBasicNodeMaterial()
    material.colorNode = vec4(0.1, 0.1, 0.2, 1)
    const mesh = new Mesh(new PlaneGeometry(2, 2), material)
    ctx.scene.add(mesh)
    return () => {
      ctx.scene.remove(mesh)
      try {
        material.dispose()
      } catch {
        // three/webgpu can throw during dispose under Strict Mode double-invoke
      }
      try {
        mesh.geometry.dispose()
      } catch {
        // same
      }
    }
  }, [ctx])

  return null
}
