'use client'

import { useEffect, useMemo } from 'react'
import { Mesh, MeshBasicNodeMaterial, PlaneGeometry, Vector2 } from 'three/webgpu'
import type { Node } from 'three/webgpu'
import { uv, vec2, vec3, vec4, sin, cos, uniform, type ShaderNodeObject } from 'three/tsl'

import { time, noise } from '@lovo/matter'
import {
  useMatterContext,
  useResize,
  useAnimatableUniform,
  type AnimatableProp,
} from '@lovo/matter-react'

export interface MeshGradientShaderProps {
  /** Global animation rate. Multiplies the time the warp uses. */
  speed: AnimatableProp<number>
  /** Sine warp frequency. Higher = more wobbles per gradient. */
  frequency: AnimatableProp<number>
  /** Sine warp amplitude divisor. Higher = subtler wobble. */
  amplitude: AnimatableProp<number>
}

// Four hardcoded debug colors — one per rotated-UV quadrant. Replaced by the
// two-layer smoothstep blend in Phase 4.
const DEBUG_COLORS = {
  tl: vec3(0.96, 0.73, 0.54), // amberYellow
  tr: vec3(0.19, 0.38, 0.93), // deepBlue
  br: vec3(0.96, 0.57, 0.57), // pink
  bl: vec3(0.35, 0.71, 0.95), // blue
} as const

export function MeshGradientShader(props: MeshGradientShaderProps) {
  const ctx = useMatterContext()
  const resize = useResize()

  const speedU = useAnimatableUniform<number>(props.speed)
  const frequencyU = useAnimatableUniform<number>(props.frequency)
  const amplitudeU = useAnimatableUniform<number>(props.amplitude)

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
    const tuvRaw = uv().sub(vec2(0.5, 0.5))

    // ---- Noise-driven rotation angle ----------------------------------
    // ShaderToy uses noise(vec2(time*0.05, tuv.x*tuv.y)) which is per-pixel
    // (rotation varies across the screen). Engine noise returns ~[-1, 1];
    // remap to [0, 1] to match the source.
    const tSlow = time.mul(0.05)
    const noiseInput = vec2(tSlow, tuvRaw.x.mul(tuvRaw.y))
    const degree01 = noise(noiseInput).mul(0.5).add(0.5) // [0, 1]
    // angle = (degree01 - 0.5) * (720° in radians) + 180° in radians
    //       = (degree01 - 0.5) * 4π + π
    const TWO_TURNS_RAD = Math.PI * 4
    const ROT_BIAS_RAD = Math.PI
    const angle = degree01.sub(0.5).mul(TWO_TURNS_RAD).add(ROT_BIAS_RAD)

    // ---- Aspect-corrected rotation -----------------------------------
    // Pre-divide y by aspect so the rotation operates in unit space, then
    // restore y after. (CLAUDE.md gotcha #12: `.x` produces a fresh node
    // derived from the resNode uniform, which then safely participates
    // in further chains.)
    const aspect = resNode.x.div(resNode.y)
    const ty = tuvRaw.y.div(aspect)
    const c = cos(angle)
    const s = sin(angle)
    // Componentwise rotation: (x', y') = (c*x - s*y, s*x + c*y).
    const rx = tuvRaw.x.mul(c).sub(ty.mul(s))
    const ryUnit = tuvRaw.x.mul(s).add(ty.mul(c))
    const ry = ryUnit.mul(aspect)
    const tuvRotated = vec2(rx, ry)

    // ---- Sine domain warp --------------------------------------------
    // Push each pixel by a sine of its own coordinates. The y-axis uses
    // 1.5x frequency and 2x amplitude (relative to x) to de-correlate the
    // two warps so the result doesn't look like a single shear.
    const tspeed = time.mul(speedU)
    const warpX = sin(tuvRotated.y.mul(frequencyU).add(tspeed)).div(amplitudeU)
    const warpY = sin(tuvRotated.x.mul(frequencyU).mul(1.5).add(tspeed))
      .div(amplitudeU)
      .mul(2)
    const tuv = vec2(tuvRotated.x.add(warpX), tuvRotated.y.add(warpY))

    // ---- Quadrant color picking --------------------------------------
    // tuv is now rotated-and-centered. Pick a color by sign of x and y so
    // we can see the rotation visually. Each `step` returns 0 or 1; we use
    // them as mix factors. (smoothstep on a zero-width edge ≡ step.)
    // Lerp horizontally between left & right colors per row, then vertically.
    const isRight = tuv.x.step(0)
    const isTop = tuv.y.step(0)
    const topRow = DEBUG_COLORS.tl.mul(isRight.oneMinus()).add(DEBUG_COLORS.tr.mul(isRight))
    const bottomRow = DEBUG_COLORS.bl.mul(isRight.oneMinus()).add(DEBUG_COLORS.br.mul(isRight))
    const color = bottomRow.mul(isTop.oneMinus()).add(topRow.mul(isTop))

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
  }, [ctx, resNode, speedU, frequencyU, amplitudeU])

  return null
}
