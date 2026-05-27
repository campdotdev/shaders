'use client'

import { MeshGradientShader } from './shader'

export interface MeshGradientProps {
  // Phases 2+ will add props here; defaults forward to MeshGradientShader.
}

export function MeshGradient(_props: MeshGradientProps = {}) {
  return <MeshGradientShader />
}
