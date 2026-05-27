'use client'

import { useEffect, useMemo } from 'react'
import { Mesh, MeshBasicNodeMaterial, PlaneGeometry, Vector2 } from 'three/webgpu'
import type { Node } from 'three/webgpu'
import { uv, vec2, vec3, vec4, sin, cos, uniform, type ShaderNodeObject } from 'three/tsl'

import { time, noise } from '@lovo/matter'
import { useMatterContext, useResize } from '@lovo/matter-react'

export interface MeshGradientShaderProps {
  // Props grow in later phases.
}

// Four hardcoded debug colors — one per rotated-UV quadrant. Replaced by the
// two-layer smoothstep blend in Phase 4.
const DEBUG_COLORS = {
  tl: vec3(0.96, 0.73, 0.54), // amberYellow
  tr: vec3(0.19, 0.38, 0.93), // deepBlue
  br: vec3(0.96, 0.57, 0.57), // pink
  bl: vec3(0.35, 0.71, 0.95), // blue
} as const

export function MeshGradientShader(_props: MeshGradientShaderProps) {
  const ctx = useMatterContext()
  const resize = useResize()

  // Resolution uniform — drives aspect correction. Seed with a sane large
  // default so the first frame doesn't see (1, 1). Pattern from Aurora.
  const resVec = useMemo(() => new Vector2(1920, 1080), [])
  const resNode = useMemo(() => uniform(resVec) as unknown as ShaderNodeObject<Node>, [resVec])
  useEffect(() => {
    const [w, h] = resize.get()
    if (w > 0 && h > 0) resVec.set(w, h)
    return resize.on('change', ([w2, h2]) => resVec.set(w2, h2))
  }, [resize, resVec])

  useEffect(() => {
    if (!ctx) return

    // ---- Centered UVs --------------------------------------------------
    // tuv = uv - 0.5  puts (0,0) at the center, range [-0.5, 0.5].
    const tuvRaw = uv().sub(vec2(0.5, 0.5)) as ShaderNodeObject<Node>

    // ---- Noise-driven rotation angle ----------------------------------
    // ShaderToy uses noise(vec2(time*0.05, tuv.x*tuv.y)) which is per-pixel
    // (rotation varies across the screen). Engine noise returns ~[-1, 1];
    // remap to [0, 1] to match the source.
    const tSlow = (time as ShaderNodeObject<Node>).mul(0.05)
    const noiseInput = vec2(tSlow, (tuvRaw as ShaderNodeObject<Node>).x.mul(tuvRaw.y))
    const degree01 = noise(noiseInput).mul(0.5).add(0.5) // [0, 1]
    // angle = (degree01 - 0.5) * (720° in radians) + 180° in radians
    //       = (degree01 - 0.5) * 4π + π
    const TWO_TURNS_RAD = Math.PI * 4
    const ROT_BIAS_RAD = Math.PI
    const angle = degree01.sub(0.5).mul(TWO_TURNS_RAD).add(ROT_BIAS_RAD) as ShaderNodeObject<Node>

    // ---- Aspect-corrected rotation -----------------------------------
    // Pre-divide y by aspect so the rotation operates in unit space, then
    // restore y after. (CLAUDE.md gotcha #12: build chains from tuvRaw
    // literals; resNode appears only as the argument of .div().)
    const aspect = resNode.x.div(resNode.y)
    const ty = tuvRaw.y.div(aspect)
    const c = cos(angle)
    const s = sin(angle)
    // Componentwise rotation: (x', y') = (c*x - s*y, s*x + c*y).
    const rx = tuvRaw.x.mul(c).sub(ty.mul(s))
    const ryUnit = tuvRaw.x.mul(s).add(ty.mul(c))
    const ry = ryUnit.mul(aspect)
    const tuv = vec2(rx, ry) as ShaderNodeObject<Node>

    // ---- Quadrant color picking --------------------------------------
    // tuv is now rotated-and-centered. Pick a color by sign of x and y so
    // we can see the rotation visually. Each `step` returns 0 or 1; we use
    // them as mix factors. (smoothstep on a zero-width edge ≡ step.)
    // Lerp horizontally between left & right colors per row, then vertically.
    const isRight = tuv.x.greaterThan(0).select(1, 0) as ShaderNodeObject<Node>
    const isTop = tuv.y.greaterThan(0).select(1, 0) as ShaderNodeObject<Node>
    const topRow = DEBUG_COLORS.tl.mul(isRight.oneMinus()).add(DEBUG_COLORS.tr.mul(isRight))
    const bottomRow = DEBUG_COLORS.bl.mul(isRight.oneMinus()).add(DEBUG_COLORS.br.mul(isRight))
    const color = bottomRow.mul(isTop.oneMinus()).add(topRow.mul(isTop)) as ShaderNodeObject<Node>

    const material = new MeshBasicNodeMaterial()
    material.colorNode = vec4(color, 1)

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
  }, [ctx, resNode])

  return null
}
