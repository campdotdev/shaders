'use client'

import {
  colorRamp,
  type ColorRampStop,
  cursorRipple,
  displace,
  fbm,
  noise,
  quantize,
  sdfCircle,
  time,
  voronoi,
} from '@lovo/matter'
import { MatterScene, useMatterContext } from '@lovo/matter-react'
import { useEffect, useMemo } from 'react'
import type { ShaderNodeObject } from 'three/tsl'
import { mix, sin, smoothstep, uniform, uv, vec2, vec3, vec4 } from 'three/tsl'
import { Mesh, MeshBasicNodeMaterial, PlaneGeometry, Vector2 } from 'three/webgpu'
import type { Node } from 'three/webgpu'

import type { PropsState } from './PropsPlayground'

interface PrimitiveSceneProps {
  slug: string
  params: PropsState
}

// Structural key for PrimitiveMesh: param values are read directly into the
// TSL chain at build time (instead of being plumbed through uniforms with the
// useAnimatableUniform hook), so the chain has to rebuild when any of them
// change. Per-control AnimatableProp hooks would require conditional hook
// calls — illegal under the rules of hooks. Remount-on-key is the simpler,
// gotcha-#12-safe answer for the prototype demo.
const buildStructuralKey = (slug: string, params: PropsState): string => {
  const keys = Object.keys(params).sort()

  return `${slug}|${keys.map((k) => `${k}=${String(params[k])}`).join('|')}`
}

export function PrimitiveScene({ slug, params }: PrimitiveSceneProps) {
  const remountKey = buildStructuralKey(slug, params)

  return (
    <MatterScene>
      <PrimitiveMesh key={remountKey} params={params} slug={slug} />
    </MatterScene>
  )
}

function PrimitiveMesh({ slug, params }: PrimitiveSceneProps) {
  const ctx = useMatterContext()

  // Static cursor uniform for the cursor-ripple demo. Hardcoded to (0.5, 0.5)
  // so the ripple emits from the center — pulling in real cursor tracking
  // (useCursor + plumbing to a uniform) would balloon this prototype with
  // wiring orthogonal to "show the primitive's signature." Kept stable across
  // renders so the chain references the same uniform identity.
  const staticCursorVec = useMemo(() => new Vector2(0.5, 0.5), [])
  const staticCursor = useMemo(() => uniform(staticCursorVec), [staticCursorVec])

  useEffect(() => {
    if (!ctx) return

    let colorNode: ShaderNodeObject<Node>

    switch (slug) {
      case 'color-ramp': {
        // Sample a fixed 3-stop ramp at a position the user controls.
        // colorRamp's `t` is a TSL node, but here we feed a uniform-wrapped
        // scalar — built by adding to a vec2(0).x literal so the chain stays
        // rooted on a TSL-built node, not a raw uniform receiver (gotcha #12).
        const position = (params.position as number | undefined) ?? 0.5
        const stops: ColorRampStop[] = [
          { color: vec3(1, 0.4, 0.4), position: 0 },
          { color: vec3(0.4, 1, 0.4), position: 0.5 },
          { color: vec3(0.4, 0.4, 1), position: 1 },
        ]
        // Vary t across the canvas so the user can SEE the gradient AND scrub
        // a "cursor" (the visualized sample line) by moving the position
        // slider. We render the full ramp (uv.x) underneath, then overlay a
        // brighter readout where uv.x ≈ position.
        const baseColor = colorRamp(uv().x, stops)
        const distFromMarker = uv().x.sub(position).abs()
        const marker = smoothstep(0.01, 0, distFromMarker) as ShaderNodeObject<Node>
        // Brighten the band at the marker position so the user can see the
        // sampled color "pin" against the background ramp.
        const lit = mix(baseColor, vec3(1, 1, 1), marker.mul(0.6)) as ShaderNodeObject<Node>

        colorNode = vec4(lit, 1)
        break
      }

      case 'noise': {
        const scale = (params.scale as number | undefined) ?? 3
        const speed = (params.speed as number | undefined) ?? 0.3
        const t = time.mul(speed)
        const p = (uv() as ShaderNodeObject<Node>)
          .mul(scale)
          .add(vec2(t, t)) as ShaderNodeObject<Node>
        const n = noise(p)
        // noise returns ~[-1, 1]; map to [0, 1] grayscale.
        const g = (n.mul(0.5).add(0.5) as ShaderNodeObject<Node>).clamp(0, 1)

        colorNode = vec4(g, g, g, 1)
        break
      }

      case 'fbm': {
        const scale = (params.scale as number | undefined) ?? 3
        const octaves = (params.octaves as number | undefined) ?? 4
        const lacunarity = (params.lacunarity as number | undefined) ?? 2
        const gain = (params.gain as number | undefined) ?? 0.5
        const speed = (params.speed as number | undefined) ?? 0.3

        const t = time.mul(speed)
        const p = (uv() as ShaderNodeObject<Node>)
          .mul(scale)
          .add(vec2(t, t)) as ShaderNodeObject<Node>
        const f = fbm(p, { octaves, lacunarity, gain })
        const g = (f.mul(0.5).add(0.5) as ShaderNodeObject<Node>).clamp(0, 1)

        colorNode = vec4(g, g, g, 1)
        break
      }

      case 'voronoi': {
        const scale = (params.scale as number | undefined) ?? 4
        const speed = (params.speed as number | undefined) ?? 0.2
        const t = time.mul(speed)
        const p = (uv() as ShaderNodeObject<Node>)
          .mul(scale)
          .add(vec2(t, t)) as ShaderNodeObject<Node>
        const v = voronoi(p)
        // voronoi (mx_worley_noise_float) is roughly [0, 1]; clamp to be safe.
        const g = v.clamp(0, 1)

        colorNode = vec4(g, g, g, 1)
        break
      }

      case 'quantize': {
        // bins is an integer — we read it directly as a JS number. Source uv.x
        // through quantize(...) to show discrete bands. Color via a fixed
        // 3-stop ramp so the bins read as colors, not just gray strips.
        const bins = Math.max(2, Math.round((params.bins as number | undefined) ?? 4))
        const q = quantize(uv().x, bins)
        const stops: ColorRampStop[] = [
          { color: vec3(0.15, 0.2, 0.4), position: 0 },
          { color: vec3(0.6, 0.4, 0.9), position: 0.5 },
          { color: vec3(1, 0.7, 0.4), position: 1 },
        ]
        const c = colorRamp(q, stops)

        colorNode = vec4(c, 1)
        break
      }

      case 'sdf-circle': {
        const radius = (params.radius as number | undefined) ?? 0.25
        const cx = (params.cx as number | undefined) ?? 0.5
        const cy = (params.cy as number | undefined) ?? 0.5
        // SDF translation: rendering at +center evaluates at (p - center).
        // p is uv()-derived, center is a JS-number vec2 baked into the chain.
        const p = (uv() as ShaderNodeObject<Node>).sub(vec2(cx, cy)) as ShaderNodeObject<Node>
        const sdf = sdfCircle(p, radius)
        // Soft-edged disk via smoothstep across [+aa, -aa].
        const aa = 0.005
        const mask = smoothstep(aa, -aa, sdf) as ShaderNodeObject<Node>
        // Render disk in white, background in dark blue.
        const c = mix(vec3(0.05, 0.05, 0.1), vec3(1, 1, 1), mask) as ShaderNodeObject<Node>

        colorNode = vec4(c, 1)
        break
      }

      case 'displace': {
        // displace has no inherent visual without something to sample at the
        // displaced point. We sample noise(uv * 4 + animated_t) at the
        // displaced UV so the user can SEE the offset shift the noise field.
        // The animated_t keeps it visually alive even at zero displacement.
        const x = (params.x as number | undefined) ?? 0.1
        const y = (params.y as number | undefined) ?? 0.05
        const t = time.mul(0.2)
        const dUv = displace(uv(), vec2(x, y))
        const samplePoint = dUv.mul(4).add(vec2(t, t)) as ShaderNodeObject<Node>
        const n = noise(samplePoint)
        const g = (n.mul(0.5).add(0.5) as ShaderNodeObject<Node>).clamp(0, 1)

        colorNode = vec4(g, g, g, 1)
        break
      }

      case 'cursor-ripple': {
        // Hardcoded cursor at (0.5, 0.5) — see staticCursor at the top of the
        // hook. Real cursor wiring is orthogonal to demonstrating the
        // primitive's shape; we just need to show the ripple pattern.
        const amplitude = (params.amplitude as number | undefined) ?? 0.05
        const falloff = (params.falloff as number | undefined) ?? 4
        const speed = (params.speed as number | undefined) ?? 1
        // Map 'falloff' (1..10, higher=sharper) onto cursorRipple's `reach`
        // (radius beyond which ripple decays) and `frequency` (ring spacing).
        // High falloff → small reach + high frequency = many tight rings.
        const reach = 1 / falloff
        const frequency = falloff * 8
        const ripple = cursorRipple(uv(), staticCursor, {
          amplitude,
          frequency,
          reach,
          speed: speed * 6,
        })
        // ripple is in roughly [-amplitude, +amplitude]; map to [0, 1] gray.
        const g = (ripple.div(amplitude * 2 + 0.0001).add(0.5) as ShaderNodeObject<Node>).clamp(
          0,
          1,
        )

        colorNode = vec4(g, g, g, 1)
        break
      }

      case 'time': {
        // No controls. sin(time * 2) → [-1, 1] → grayscale pulse.
        const v = (sin(time.mul(2)) as ShaderNodeObject<Node>)
          .mul(0.5)
          .add(0.5) as ShaderNodeObject<Node>

        colorNode = vec4(v, v, v, 1)
        break
      }

      default:
        // Magenta = error sentinel. If you see this, the slug list in
        // primitives.ts and the switch here have drifted apart.
        colorNode = vec4(1, 0, 1, 1)
    }

    const material = new MeshBasicNodeMaterial()

    material.colorNode = colorNode

    const mesh = new Mesh(new PlaneGeometry(2, 2), material)

    ctx.scene.add(mesh)

    return () => {
      ctx.scene.remove(mesh)
      // three's WebGPURenderer can throw inside `material.dispose()` during
      // rapid rebuilds (Nodes bookkeeping race). Mirror the registry pattern:
      // swallow the dispose error, GPU resources reap on renderer dispose.
      try {
        material.dispose()
      } catch {
        /* benign during rebuild */
      }
      try {
        mesh.geometry.dispose()
      } catch {
        /* same */
      }
    }
  }, [ctx, slug, params, staticCursor])

  return null
}
