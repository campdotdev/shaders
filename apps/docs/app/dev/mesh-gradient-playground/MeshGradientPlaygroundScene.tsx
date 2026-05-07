'use client'

// Heavy client-only scene + tweakpane controls. Split out from the page so
// the page module can `dynamic({ ssr: false })` import this whole subtree —
// its top-level imports of `three/webgpu` (directly and transitively via
// `@lovo/matter` and `@lovo/matter-react`) reference `self` at module load
// and break Next's prerender pass (CLAUDE.md gotcha #10).

import { useEffect, useMemo, useRef, useState } from 'react'
import { Pane } from 'tweakpane'
import { Mesh, MeshBasicNodeMaterial, PlaneGeometry } from 'three/webgpu'
import type { Node } from 'three/webgpu'
import type { ShaderNodeObject } from 'three/tsl'
import { vec2, vec3, vec4, length, uv, time, uniform } from '@lovo/matter'
import { noise } from '@lovo/matter'
import { MatterScene, useMatterContext } from '@lovo/matter-react'

interface Params {
  c0: string
  c1: string
  c2: string
  c3: string
  blur: number
  jitter: number
}

const INITIAL: Params = {
  c0: '#ff61a6',
  c1: '#61a6ff',
  c2: '#61ffa6',
  c3: '#ffd861',
  blur: 0.5,
  jitter: 0.1,
}

const hex = (s: string): readonly [number, number, number] => {
  const c = s.replace('#', '')
  return [
    parseInt(c.slice(0, 2), 16) / 255,
    parseInt(c.slice(2, 4), 16) / 255,
    parseInt(c.slice(4, 6), 16) / 255,
  ]
}

// Inner mesh — must run inside <MatterScene> so the context is available.
function PrototypeMesh({
  colors,
  blur,
  jitterUniform,
}: {
  colors: readonly [
    readonly [number, number, number],
    readonly [number, number, number],
    readonly [number, number, number],
    readonly [number, number, number],
  ]
  blur: number
  jitterUniform: ReturnType<typeof uniform>
}) {
  const ctx = useMatterContext()

  useEffect(() => {
    if (!ctx) return

    // Four hardcoded base positions, one per UV-space corner.
    const basePositions: ReadonlyArray<readonly [number, number]> = [
      [0.0, 0.0],
      [1.0, 0.0],
      [1.0, 1.0],
      [0.0, 1.0],
    ]
    // Inverse exponent for the inverse-distance weight. Negative because
    // pow(d, -invBlur) == 1 / d^invBlur. Built JS-side from `blur` — the
    // exponent bakes into the fragment at material-build time and the
    // playground gates `blur` behind an Apply button (the prototype's whole
    // job is to surface this as a feel-decision before <MeshGradient> ships).
    const negInvBlur = -1 / Math.max(blur, 0.05)

    let totalWeight: ShaderNodeObject<Node> | null = null
    let weightedSum: ShaderNodeObject<Node> | null = null

    for (let i = 0; i < basePositions.length; i++) {
      const bp = basePositions[i]!
      // Per-point drift: position += (noise(...), noise(...)) * jitter. The
      // noise calls are rooted in vec2(...) literals (gotcha #12); jitter
      // appears only as an argument to .mul(...) on a noise-rooted chain.
      const tNode = (time as ShaderNodeObject<Node>).mul(0.05)
      const nx = noise(vec2(i + 0.13, tNode)) as ShaderNodeObject<Node>
      const ny = noise(vec2(i + 0.79, tNode)) as ShaderNodeObject<Node>
      const offset = vec2(
        nx.mul(jitterUniform as unknown as number),
        ny.mul(jitterUniform as unknown as number),
      )
      const point = vec2(bp[0], bp[1]).add(offset) as ShaderNodeObject<Node>

      // d = length(uv() - point) — uv-rooted chain, `point` as argument
      // (gotcha #12). Add a small epsilon so the central pixel of each point
      // doesn't divide by zero.
      const d = length(uv().sub(point)).add(0.001) as ShaderNodeObject<Node>
      // weight = d^(-1/blur)  ==  1 / d^(1/blur).
      const weight = d.pow(negInvBlur)

      const colorVec = vec3(colors[i]![0], colors[i]![1], colors[i]![2])
      const contribution = (colorVec as ShaderNodeObject<Node>).mul(weight)

      if (totalWeight === null) {
        totalWeight = weight as ShaderNodeObject<Node>
        weightedSum = contribution as ShaderNodeObject<Node>
      } else {
        totalWeight = totalWeight.add(weight) as ShaderNodeObject<Node>
        weightedSum = (weightedSum as ShaderNodeObject<Node>).add(
          contribution,
        ) as ShaderNodeObject<Node>
      }
    }

    const finalColor = (weightedSum as ShaderNodeObject<Node>).div(
      totalWeight as ShaderNodeObject<Node>,
    ) as ShaderNodeObject<Node>

    const material = new MeshBasicNodeMaterial()
    material.colorNode = vec4(finalColor.x, finalColor.y, finalColor.z, 1) as never

    const mesh = new Mesh(new PlaneGeometry(2, 2), material)
    ctx.scene.add(mesh)
    return () => {
      ctx.scene.remove(mesh)
      try { material.dispose() } catch { /* benign during rebuild */ }
      try { mesh.geometry.dispose() } catch { /* same */ }
    }
  }, [ctx, colors, blur, jitterUniform])

  return null
}

export default function MeshGradientPlaygroundScene() {
  const paneContainerRef = useRef<HTMLDivElement>(null)
  const [params, setParams] = useState<Params>(INITIAL)

  // Live uniform — `jitter` flows on every change without rebuilding the
  // material. `blur` and the four colors gate behind the Apply button because
  // they bake into the TSL fragment at material-build time.
  const jitterUniform = useMemo(() => uniform(INITIAL.jitter), [])

  useEffect(() => {
    const container = paneContainerRef.current
    if (!container) return

    const local = { ...INITIAL }
    const pane = new Pane({ container, title: 'MeshGradient blend prototype' })

    pane.addBinding(local, 'c0', { label: 'corner TL' })
    pane.addBinding(local, 'c1', { label: 'corner TR' })
    pane.addBinding(local, 'c2', { label: 'corner BR' })
    pane.addBinding(local, 'c3', { label: 'corner BL' })
    pane.addBlade({ view: 'separator' })
    pane.addBinding(local, 'blur', { min: 0.1, max: 2, step: 0.01 })
    pane.addBinding(local, 'jitter', { min: 0, max: 0.3, step: 0.01 })
    pane.addBlade({ view: 'separator' })
    pane.addButton({ title: 'Apply blur / colors' }).on('click', () => {
      setParams({ ...local })
    })

    pane.on('change', (ev) => {
      const key = (ev.target as { key?: keyof Params }).key
      if (key === 'jitter') {
        ;(jitterUniform as unknown as { value: number }).value = local.jitter
      }
      // colors / blur wait for the Apply button.
    })

    return () => {
      pane.dispose()
    }
  }, [jitterUniform])

  const colors = useMemo(
    () =>
      [
        hex(params.c0),
        hex(params.c1),
        hex(params.c2),
        hex(params.c3),
      ] as const,
    [params.c0, params.c1, params.c2, params.c3],
  )

  return (
    <main style={{ minHeight: '100vh', position: 'relative' }}>
      <div style={{ position: 'relative', height: '70vh' }}>
        <MatterScene>
          <PrototypeMesh
            colors={colors}
            blur={params.blur}
            jitterUniform={jitterUniform}
          />
        </MatterScene>
      </div>
      <div
        ref={paneContainerRef}
        style={{ position: 'fixed', top: '1rem', right: '1rem', zIndex: 10, width: '320px' }}
      />
      <section style={{ padding: '2rem', maxWidth: '60ch', margin: '0 auto' }}>
        <h1 style={{ marginTop: 0 }}>MeshGradient blend prototype</h1>
        <p>
          Internal Matter dev surface — not part of the public component catalog. Use this
          to feel out a good <code>blur</code> exponent default before{' '}
          <code>&lt;MeshGradient&gt;</code> locks its prop API in 3.4.b. At low blur, points
          stay localized; at high blur, the whole field becomes mushy.
        </p>
      </section>
    </main>
  )
}
