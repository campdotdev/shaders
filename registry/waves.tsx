// registry/waves.tsx
'use client'

import { useEffect, useMemo, type CSSProperties, type ReactNode } from 'react'
import { Mesh, MeshBasicNodeMaterial, PlaneGeometry, Vector2 } from 'three/webgpu'
import type { Node } from 'three/webgpu'
import type { ShaderNodeObject } from 'three/tsl'
import { vec2, vec3, vec4, sin, mix, smoothstep, uv, time, uniform } from '@lovo/matter'
import { cursorRipple } from '@lovo/matter'
import {
  MatterScene,
  useMatterContext,
  useAnimatableUniform,
  useCursor,
  FallbackBoundary,
  type AnimatableProp,
  type CursorSignal,
} from '@lovo/matter-react'

export interface WavesProps {
  amplitude?: AnimatableProp<number>
  frequency?: AnimatableProp<number>
  speed?: AnimatableProp<number>
  color?: string
  layers?: number // JS-side; baked into the TSL fragment at material build.
  interactive?: boolean
  inputs?: { cursor?: CursorSignal }
  fallback?: ReactNode
  className?: string
  style?: CSSProperties
  /** Optional content rendered inside the internal MatterScene. Useful for dev overlays like MatterMonitor. */
  children?: ReactNode
}

const DEFAULTS = {
  amplitude: 0.1,
  frequency: 5,
  speed: 1,
  color: '#77eecc',
  layers: 3,
} as const

const hexToVec3 = (hex: string): readonly [number, number, number] => {
  const clean = hex.replace('#', '')
  return [
    parseInt(clean.slice(0, 2), 16) / 255,
    parseInt(clean.slice(2, 4), 16) / 255,
    parseInt(clean.slice(4, 6), 16) / 255,
  ]
}

function WavesMesh(props: WavesProps) {
  const ctx = useMatterContext()
  const cursorFromInputs = props.inputs?.cursor
  const cursorAuto = useCursor()
  const cursor = cursorFromInputs ?? (props.interactive ? cursorAuto : null)
  // Floor at 1: a non-positive `layers` would still render the always-on base
  // wave (visually identical to layers=1) but reads as "no waves please."
  // Clamping keeps the public API honest about what the visible minimum is.
  const layers = Math.max(1, props.layers ?? DEFAULTS.layers)

  const ampUniform = useAnimatableUniform<number>(props.amplitude ?? DEFAULTS.amplitude)
  const freqUniform = useAnimatableUniform<number>(props.frequency ?? DEFAULTS.frequency)
  const speedUniform = useAnimatableUniform<number>(props.speed ?? DEFAULTS.speed)

  const [cr, cg, cb] = hexToVec3(props.color ?? DEFAULTS.color)

  // Cursor uniform — UV-space, y flipped from DOM-space. useCursor()'s signal
  // is already canvas-rect-normalized centrally (matter PR 0e09e90), so we
  // only need the y-flip here.
  const cursorVec = useMemo(() => new Vector2(0.5, 0.5), [])
  const cursorUniform = useMemo(() => uniform(cursorVec), [cursorVec])
  useEffect(() => {
    if (cursor) return cursor.on('change', ([x, y]) => cursorVec.set(x, 1 - y))
    cursorVec.set(0.5, 0.5)
    return undefined
  }, [cursor, cursorVec])

  useEffect(() => {
    if (!ctx) return

    // vec2(0).x is a TSL literal scalar — chains rooted here keep
    // freqUniform / speedUniform as ARGUMENTS (not chain receivers), which
    // is the gotcha #12 fix. Hoisted outside the loop so the literal node
    // is built once.
    const zeroScalar = (vec2(0) as ShaderNodeObject<Node>).x
    const uvX = uv().x as ShaderNodeObject<Node>
    const tNode = time as ShaderNodeObject<Node>

    // Sum `layers` sine waves at increasing frequency / decreasing amplitude.
    // Each layer gets a small phase offset so peaks don't all align.
    let waveSum: ShaderNodeObject<Node> = sin(
      uvX.mul(freqUniform).add(tNode.mul(speedUniform)),
    ) as ShaderNodeObject<Node>
    let totalAmp = 1
    // Per-layer detuning: each successive layer gets a slightly higher
    // frequency, faster phase, and a phase-offset to keep peaks from aligning
    // across layers (which would just look like a louder fundamental). The
    // 0.7 / 0.4 / 1.3 magic numbers are chosen to give a "harmonic-ish but
    // not exact" stack — small enough that low-default freq=5 doesn't alias
    // at i=5, large enough that you can hear the layer count grow visually.
    for (let i = 1; i < layers; i++) {
      // Anchor the per-layer freq/speed in zeroScalar so freqUniform /
      // speedUniform appear only as arguments to .add() — never as the
      // receiver of a .mul(...) chain (gotcha #12).
      const layerFreq = zeroScalar.add(freqUniform).mul(1 + i * 0.7)
      const layerSpeed = zeroScalar.add(speedUniform).mul(1 + i * 0.4)
      const layerAmp = 1 / (i + 1)
      const phase = i * 1.3
      const layer = sin(
        uvX.mul(layerFreq).add(tNode.mul(layerSpeed).add(phase)),
      ) as ShaderNodeObject<Node>
      waveSum = waveSum.add(layer.mul(layerAmp)) as ShaderNodeObject<Node>
      totalAmp += layerAmp
    }
    const baseWave = waveSum.div(totalAmp).mul(ampUniform) as ShaderNodeObject<Node>

    // Optional cursor ripple — added on top of the base wave field. uv() and
    // cursorUniform are passed as args; cursorRipple builds its own chain
    // rooted in its `p` (uv()-derived) parameter.
    const fullWave: ShaderNodeObject<Node> = cursor
      ? (baseWave.add(
          cursorRipple(uv(), cursorUniform) as ShaderNodeObject<Node>,
        ) as ShaderNodeObject<Node>)
      : baseWave

    // Render the wave as a soft band: distance from `y - 0.5` to the wave
    // value, then a smoothstep around 0 picks the band thickness.
    const distFromBand = (uv().y as ShaderNodeObject<Node>)
      .sub(0.5)
      .sub(fullWave)
      .abs() as ShaderNodeObject<Node>
    const mask = smoothstep(0.04, 0.0, distFromBand as never) as ShaderNodeObject<Node>

    const colorVec = vec3(cr, cg, cb)
    const baseColor = vec3(0, 0, 0)
    // Compute mix() once and reuse — the prior listing rebuilt the mix tree
    // three times across .x/.y/.z fields. vec4(vec3, scalar) is supported by
    // TSL's ConvertType signature.
    const waveColor = mix(baseColor, colorVec, mask as never)

    const material = new MeshBasicNodeMaterial()
    material.colorNode = vec4(waveColor as never, mask as never) as never

    const mesh = new Mesh(new PlaneGeometry(2, 2), material)
    ctx.scene.add(mesh)
    return () => {
      ctx.scene.remove(mesh)
      // three's WebGPURenderer can throw inside `material.dispose()` when the
      // renderer's Nodes bookkeeping has already cleaned up the node tree
      // (typically during rapid rebuild cycles). Swallowing the dispose error
      // prevents a page crash; the underlying GPU resources will be reaped
      // when the parent renderer is disposed at unmount.
      try { material.dispose() } catch { /* benign during rebuild */ }
      try { mesh.geometry.dispose() } catch { /* same */ }
    }
  }, [
    ctx,
    layers,
    cr, cg, cb,
    ampUniform, freqUniform, speedUniform,
    cursor, cursorUniform,
  ])

  return null
}

function DefaultFallback({ color }: { color: string }) {
  // Static SVG sine-wave path — rough approximation of the rest pose. Per
  // spec line 519, Waves' fallback is an SVG <path> sine curve.
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
        <path
          d="M 0 50 C 12.5 35, 37.5 35, 50 50 C 62.5 65, 87.5 65, 100 50"
          stroke={color}
          strokeWidth="3"
          fill="none"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  )
}

export function Waves(props: WavesProps) {
  const fallbackColor = typeof props.color === 'string' ? props.color : DEFAULTS.color
  const { children, ...meshProps } = props
  return (
    <FallbackBoundary fallback={props.fallback ?? <DefaultFallback color={fallbackColor} />}>
      <MatterScene className={props.className} style={props.style}>
        <WavesMesh {...meshProps} />
        {children}
      </MatterScene>
    </FallbackBoundary>
  )
}
