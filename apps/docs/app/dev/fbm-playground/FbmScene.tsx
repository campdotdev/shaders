'use client'

// Heavy client-only scene + tweakpane controls. Split out from the page so
// the page module can `dynamic({ ssr: false })` import this whole subtree —
// its top-level imports of `three/webgpu` (directly and transitively via
// `@lovo/matter` and `@lovo/matter-react`) reference `self` at module load
// and break Next's prerender pass (CLAUDE.md gotcha #10).

import { useEffect, useMemo, useRef, useState } from 'react'
import { Pane } from 'tweakpane'
import { Mesh, PlaneGeometry } from 'three'
import { MeshBasicNodeMaterial } from 'three/webgpu'
import { vec2, vec3, uv, time, uniform } from '@lovo/matter'
import { colorRamp, type ColorRampStop } from '@lovo/matter'
import { fbm } from '@lovo/matter'
import { MatterScene, useMatterContext } from '@lovo/matter-react'

interface Params {
  octaves: number
  lacunarity: number
  gain: number
  scale: number
  timeSpeed: number
}

const INITIAL: Params = {
  octaves: 4,
  lacunarity: 2.0,
  gain: 0.5,
  scale: 3.0,
  timeSpeed: 0.2,
}

const STOPS: ColorRampStop[] = [
  { color: vec3(0, 0, 0), position: 0 },
  { color: vec3(1, 1, 1), position: 1 },
]

// Inner mesh — must run inside <MatterScene> so the context is available.
function FbmMesh({
  octaves,
  lacunarity,
  gain,
  scaleUniform,
  timeSpeedUniform,
}: {
  octaves: number
  lacunarity: number
  gain: number
  scaleUniform: ReturnType<typeof uniform>
  timeSpeedUniform: ReturnType<typeof uniform>
}) {
  const ctx = useMatterContext()

  useEffect(() => {
    if (!ctx) return

    // p = uv() * scale + time * timeSpeed (broadcast time scalar to vec2)
    const animatedUv = uv()
      .mul(scaleUniform as unknown as number)
      .add(vec2(time.mul(timeSpeedUniform as unknown as number), time.mul(timeSpeedUniform as unknown as number)))
    const t = fbm(animatedUv, { octaves, lacunarity, gain })
    // Normalize fbm's [-1..1]-ish range into [0..1] for colorRamp.
    const tNorm = (t as unknown as { add(n: number): { mul(n: number): unknown } }).add(1).mul(0.5)

    const material = new MeshBasicNodeMaterial()
    material.colorNode = colorRamp(tNorm as never, STOPS) as never
    const mesh = new Mesh(new PlaneGeometry(2, 2), material)
    ctx.scene.add(mesh)
    return () => {
      ctx.scene.remove(mesh)
      try { material.dispose() } catch { /* gotcha #13-adjacent benign race */ }
      try { mesh.geometry.dispose() } catch { /* same */ }
    }
  }, [ctx, octaves, lacunarity, gain, scaleUniform, timeSpeedUniform])

  return null
}

export default function FbmPlayground() {
  const paneContainerRef = useRef<HTMLDivElement>(null)
  const [params, setParams] = useState<Params>(INITIAL)
  // Remount the inner mesh when octaves/lacunarity/gain change because they
  // bake into the TSL fragment at material-build time.
  const [instanceKey, setInstanceKey] = useState(0)

  // Live uniforms for the parameters that survive on the GPU as uniforms.
  const scaleUniform = useMemo(() => uniform(INITIAL.scale), [])
  const timeSpeedUniform = useMemo(() => uniform(INITIAL.timeSpeed), [])

  useEffect(() => {
    const container = paneContainerRef.current
    if (!container) return

    const local = { ...INITIAL }
    const pane = new Pane({ container, title: 'FBM playground' })

    pane.addBinding(local, 'octaves', { min: 1, max: 8, step: 1 })
    pane.addBinding(local, 'lacunarity', { min: 1, max: 4, step: 0.05 })
    pane.addBinding(local, 'gain', { min: 0, max: 1, step: 0.01 })
    pane.addBlade({ view: 'separator' })
    pane.addBinding(local, 'scale', { min: 0.5, max: 10, step: 0.1 })
    pane.addBinding(local, 'timeSpeed', { label: 'time speed', min: 0, max: 2, step: 0.01 })
    pane.addBlade({ view: 'separator' })
    pane.addButton({ title: 'Apply octaves / lacunarity / gain' }).on('click', () => {
      setParams({ ...local })
      setInstanceKey((k) => k + 1)
    })

    pane.on('change', (ev) => {
      const key = (ev.target as { key?: keyof Params }).key
      if (key === 'scale') {
        ;(scaleUniform as unknown as { value: number }).value = local.scale
      } else if (key === 'timeSpeed') {
        ;(timeSpeedUniform as unknown as { value: number }).value = local.timeSpeed
      }
      // octaves/lacunarity/gain wait for the Apply button.
    })

    return () => {
      pane.dispose()
    }
  }, [scaleUniform, timeSpeedUniform])

  return (
    <main style={{ minHeight: '100vh', position: 'relative' }}>
      <div style={{ position: 'relative', height: '70vh' }}>
        <MatterScene key={instanceKey}>
          <FbmMesh
            octaves={params.octaves}
            lacunarity={params.lacunarity}
            gain={params.gain}
            scaleUniform={scaleUniform}
            timeSpeedUniform={timeSpeedUniform}
          />
        </MatterScene>
      </div>
      <div
        ref={paneContainerRef}
        style={{ position: 'fixed', top: '1rem', right: '1rem', zIndex: 10, width: '320px' }}
      />
      <section style={{ padding: '2rem', maxWidth: '60ch', margin: '0 auto' }}>
        <h1 style={{ marginTop: 0 }}>FBM playground</h1>
        <p>
          Internal Matter dev surface — not part of the public component catalog. Use this to
          feel out good defaults for <code>octaves</code>, <code>lacunarity</code>, and{' '}
          <code>gain</code> before <code>&lt;NoiseField&gt;</code> locks the prop API in 3.1.b.
        </p>
      </section>
    </main>
  )
}
