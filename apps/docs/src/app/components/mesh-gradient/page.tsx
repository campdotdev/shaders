// apps/docs/app/components/mesh-gradient/page.tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { Pane } from 'tweakpane'
import dynamic from 'next/dynamic'
import { VisualTestPause } from '@/lib/visualTestHooks'

// Both MatterScene and MeshGradient pull in three/webgpu (via createRenderer),
// which references `self` at module load time and breaks Next's SSR. Load
// both client-only.
const MatterScene = dynamic(
  () => import('@lovo/matter-react').then((m) => m.MatterScene),
  { ssr: false },
)
const MeshGradient = dynamic(
  () => import('@matter/registry/mesh-gradient').then((m) => m.MeshGradient),
  { ssr: false },
)

interface Params {
  c0: string
  c1: string
  c2: string
  c3: string
  blur: number
  speed: number
  strength: number
  interactive: boolean
}

const INITIAL: Params = {
  c0: '#ff61a6',
  c1: '#61a6ff',
  c2: '#61ffa6',
  c3: '#ffd861',
  blur: 0.4,
  speed: 0.3,
  strength: 0.15,
  interactive: false,
}

export default function MeshGradientPage() {
  const paneContainerRef = useRef<HTMLDivElement>(null)
  const [params, setParams] = useState<Params>(INITIAL)

  useEffect(() => {
    const container = paneContainerRef.current
    if (!container) return
    const local = { ...INITIAL }
    const pane = new Pane({ container, title: '<MeshGradient>' })
    pane.addBinding(local, 'c0', { label: 'color 0' })
    pane.addBinding(local, 'c1', { label: 'color 1' })
    pane.addBinding(local, 'c2', { label: 'color 2' })
    pane.addBinding(local, 'c3', { label: 'color 3' })
    pane.addBlade({ view: 'separator' })
    // blur slider min matches the TSL-side floor (`max(blurUniform, 0.05)`).
    // Below 0.05 the floor would just clip silently — practical UI limit.
    pane.addBinding(local, 'blur', { min: 0.05, max: 2, step: 0.01 })
    pane.addBinding(local, 'speed', { min: 0, max: 2, step: 0.01 })
    pane.addBinding(local, 'strength', {
      label: 'cursor pull',
      min: 0,
      max: 1,
      step: 0.01,
    })
    pane.addBlade({ view: 'separator' })
    pane.addBinding(local, 'interactive', { label: 'interactive (cursor pull)' })
    // No Apply button: speed and blur flow through live uniforms; colors and
    // interactive trigger material rebuild via dep changes (acceptable churn
    // for v1 — M4 polish handles color-as-uniform).
    pane.on('change', () => {
      setParams({ ...local })
    })
    return () => {
      pane.dispose()
    }
  }, [])

  return (
    <main style={{ minHeight: '100vh', position: 'relative' }}>
      <div style={{ position: 'relative', height: '70vh' }}>
        <MatterScene>
          <MeshGradient
            colors={[params.c0, params.c1, params.c2, params.c3]}
            blur={params.blur}
            speed={params.speed}
            strength={params.strength}
            interactive={params.interactive}
          />
          <VisualTestPause />
        </MatterScene>
      </div>
      {/* Tweakpane manages its own DOM without ARIA labels. `aria-hidden`
          hides the pane from screen readers; the axe test excludes the
          `.tp-dfwv` subtree so the unlabeled internal controls don't trip
          aria-hidden-focus. The page content in <section> below is the
          accessible surface. (`inert` would have blocked mouse input too —
          regression noted 2026-05-13.) */}
      <div
        ref={paneContainerRef}
        data-tweakpane-host
        aria-hidden="true"
        style={{ position: 'fixed', top: '1rem', right: '1rem', zIndex: 10, width: '320px' }}
      />
      <section style={{ padding: '2rem', maxWidth: '60ch', margin: '0 auto' }}>
        <h1 style={{ marginTop: 0 }}>&lt;MeshGradient /&gt;</h1>
        <pre
          style={{
            background: '#1a1a2a',
            color: '#e0e0f0',
            padding: '1rem',
            borderRadius: '0.5rem',
            fontSize: '0.85rem',
          }}
        >
          {`<MatterScene>
  <MeshGradient colors={['#ff61a6','#61a6ff','#61ffa6','#ffd861']} blur={0.4} speed={0.3} strength={0.15} interactive />
</MatterScene>`}
        </pre>
      </section>
    </main>
  )
}
