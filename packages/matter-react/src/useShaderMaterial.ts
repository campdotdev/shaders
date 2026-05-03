'use client'

import { useEffect, useMemo } from 'react'
import { MeshBasicNodeMaterial } from 'three/webgpu'
import type { Node } from 'three/webgpu'
import type { ShaderNodeObject } from 'three/tsl'

/** A TSL fragment that produces a color. Accept any Node or TSL-wrapped node. */
export type ColorTSL = Node | ShaderNodeObject<Node>

/**
 * Bind a TSL color expression to a NodeMaterial. Returns the material;
 * caller is responsible for adding it to a mesh and disposing when done.
 *
 * The TSL fragment is computed once via `useMemo` and re-applied if the
 * factory function changes. For dynamic uniforms, mutate `.value` on the
 * uniform nodes — don't recreate the TSL fragment per render.
 */
export function useShaderMaterial(build: () => ColorTSL): MeshBasicNodeMaterial {
  const material = useMemo(() => {
    const m = new MeshBasicNodeMaterial()
    m.colorNode = build() as Node
    return m
  }, [build])

  useEffect(() => {
    return () => material.dispose()
  }, [material])

  return material
}
