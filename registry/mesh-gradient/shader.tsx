'use client'

import { useEffect, useMemo } from 'react'
import { Mesh, MeshBasicNodeMaterial, PlaneGeometry, Vector2, Vector3 } from 'three/webgpu'
import type { Node } from 'three/webgpu'
import {
  uv,
  vec2,
  vec4,
  mix,
  sign,
  abs,
  pow,
  sin,
  cos,
  smoothstep,
  uniform,
  floor,
  type ShaderNodeObject,
} from 'three/tsl'

import { time, noise, filmGrain } from '@lovo/matter'
import {
  useMatterContext,
  useResize,
  useAnimatableUniform,
  type AnimatableProp,
} from '@lovo/matter-react'

import { parseHex } from '../utils/color'

export interface MeshGradientShaderProps {
  /** Global animation rate. Multiplies the time the warp uses. */
  speed: AnimatableProp<number>
  /** Sine warp frequency. Higher = more wobbles per gradient. */
  frequency: AnimatableProp<number>
  /** Sine warp amplitude divisor. Higher = subtler wobble. */
  amplitude: AnimatableProp<number>
  /** Palette A ↔ B crossfade rate. 0 = freeze, higher = faster. */
  cycleSpeed: AnimatableProp<number>
  /** Crossfade shape. <1 = linger at extremes, 1 = pure sine, >1 = linger at midpoint. Default 0.6. */
  cycleEase: AnimatableProp<number>
  /** Light palette: 4 hex strings. */
  paletteA: [string, string, string, string]
  /** Dark palette: 4 hex strings. */
  paletteB: [string, string, string, string]
  /** Film grain intensity (0..1). 0 = clean, 1 = heavy static. Default 0.08. */
  grain: AnimatableProp<number>
  /** Grain twinkle rate. 0 = static, 1 = default twinkle, higher = faster. */
  grainSpeed: AnimatableProp<number>
}

// -5° in radians; baked into the layer-x sample rotation. Could be promoted
// to a prop later, but is fine as a stylistic constant for now.
const LAYER_ROT_RAD = (-5 * Math.PI) / 180

function useColorUniform(hex: string) {
  const vec = useMemo(() => {
    const [r, g, b] = parseHex(hex)
    return new Vector3(r, g, b)
  }, [hex])

  const node = useMemo(() => uniform(vec), [vec])

  useEffect(() => {
    const [r, g, b] = parseHex(hex)
    vec.set(r, g, b)
  }, [hex, vec])

  return node
}

export function MeshGradientShader({
  speed,
  frequency,
  amplitude,
  cycleSpeed,
  cycleEase,
  grain,
  grainSpeed,
  paletteA,
  paletteB,
}: MeshGradientShaderProps) {
  const ctx = useMatterContext()
  const resize = useResize()

  const cycleSpeedU = useAnimatableUniform<number>(cycleSpeed)
  const cycleEaseU = useAnimatableUniform<number>(cycleEase)

  const a0 = useColorUniform(paletteA[0])
  const a1 = useColorUniform(paletteA[1])
  const a2 = useColorUniform(paletteA[2])
  const a3 = useColorUniform(paletteA[3])
  const b0 = useColorUniform(paletteB[0])
  const b1 = useColorUniform(paletteB[1])
  const b2 = useColorUniform(paletteB[2])
  const b3 = useColorUniform(paletteB[3])

  const speedU = useAnimatableUniform<number>(speed)
  const frequencyU = useAnimatableUniform<number>(frequency)
  const amplitudeU = useAnimatableUniform<number>(amplitude)
  const grainU = useAnimatableUniform<number>(grain)
  const grainSpeedU = useAnimatableUniform<number>(grainSpeed)

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
    const warpY = sin(tuvRotated.x.mul(frequencyU).mul(1.5).add(tspeed)).div(amplitudeU).mul(2)
    const tuv = vec2(tuvRotated.x.add(warpX), tuvRotated.y.add(warpY))

    // ---- Time-cycling palette ----------------------------------------
    // c = sin(time * cycleSpeed)        smooth oscillator in [-1, 1]
    // eased = (sign(c) * |c|^cycleEase + 1) / 2
    //                                   S-curve in [0, 1]. cycleEase < 1
    //                                   lingers at ±1 (palettes A and B);
    //                                   cycleEase = 1 is a pure sine;
    //                                   cycleEase > 1 lingers at the
    //                                   midpoint.
    const cycleTime = time.mul(cycleSpeedU)
    const cycle = sin(cycleTime)
    const eased = sign(cycle)
      .mul(pow(abs(cycle), cycleEaseU))
      .add(1)
      .mul(0.5)

    const color0 = mix(a0, b0, eased)
    const color1 = mix(a1, b1, eased)
    const color2 = mix(a2, b2, eased)
    const color3 = mix(a3, b3, eased)

    // ---- Two-layer smoothstep blend ---------------------------------
    // Sample tuv through a small additional rotation (-5°) and use the
    // resulting x to pick a smooth horizontal gradient per "layer". The
    // vertical blend uses un-rotated tuv.y. Reversed smoothstep edges
    // (0.5 -> -0.3) flip the direction so top of canvas reads layer1.
    const lc = Math.cos(LAYER_ROT_RAD)
    const ls = Math.sin(LAYER_ROT_RAD)
    const layerX = tuv.x.mul(lc).sub(tuv.y.mul(ls))

    const hMix = smoothstep(-0.3, 0.2, layerX)
    const layer1 = color2.mul(hMix.oneMinus()).add(color1.mul(hMix))
    const layer2 = color3.mul(hMix.oneMinus()).add(color0.mul(hMix))

    const vMix = smoothstep(0.5, -0.3, tuv.y)
    const color = layer1.mul(vMix.oneMinus()).add(layer2.mul(vMix))

    // ---- Film grain ---------------------------------------------------
    // The `filmGrain` primitive owns the hash math + centering. We still
    // own the time quantization here because shutter rate is a per-shader
    // aesthetic decision — `filmGrain` accepts any time-offset node and
    // doesn't bake in a default rate. Quantizing via floor(time*rate)
    // makes each integer tick re-randomize the grain (real film exposes
    // at a discrete shutter rate, not continuously). At grainSpeed=1 the
    // rate is 60Hz ≈ per-frame; at 0.4 you get ~24Hz film cadence;
    // at 0 the grain freezes entirely.
    const grainTime = floor(time.mul(grainSpeedU).mul(60))
    const grainScalar = filmGrain(uv(), grainU, grainTime)
    const colorWithGrain = color.add(grainScalar)

    const material = new MeshBasicNodeMaterial()
    material.colorNode = vec4(colorWithGrain, 1)

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
  }, [
    ctx,
    resNode,
    speedU,
    frequencyU,
    amplitudeU,
    cycleSpeedU,
    cycleEaseU,
    grainU,
    grainSpeedU,
    a0,
    a1,
    a2,
    a3,
    b0,
    b1,
    b2,
    b3,
  ])

  return null
}
