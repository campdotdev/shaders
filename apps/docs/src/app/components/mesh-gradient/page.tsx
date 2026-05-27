// apps/docs/app/components/mesh-gradient/page.tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { Pane } from 'tweakpane'
import dynamic from 'next/dynamic'
import { VisualTestPause } from '@/lib/visualTestHooks'

const MatterScene = dynamic(() => import('@lovo/matter-react').then((m) => m.MatterScene), {
  ssr: false,
})
const MeshGradient = dynamic(
  () => import('@matter/registry/mesh-gradient').then((m) => m.MeshGradient),
  { ssr: false },
)

interface Params {
  speed: number
  frequency: number
  amplitude: number
}

const INITIAL: Params = { speed: 2, frequency: 5, amplitude: 30 }

export default function MeshGradientPage() {
  const paneContainerRef = useRef<HTMLDivElement>(null)
  const [params, setParams] = useState<Params>(INITIAL)

  useEffect(() => {
    const container = paneContainerRef.current
    if (!container) return
    const local: Params = { ...INITIAL }
    const pane = new Pane({ container, title: '<MeshGradient>' })
    pane.addBinding(local, 'speed', { min: 0, max: 5, step: 0.01 })
    pane.addBinding(local, 'frequency', { min: 0.5, max: 20, step: 0.1 })
    pane.addBinding(local, 'amplitude', { min: 5, max: 100, step: 0.5 })
    pane.on('change', () => setParams({ ...local }))
    return () => pane.dispose()
  }, [])

  return (
    <main style={{ minHeight: '100vh', position: 'relative' }}>
      <div style={{ position: 'relative', height: '70vh' }}>
        <MatterScene>
          <MeshGradient
            speed={params.speed}
            frequency={params.frequency}
            amplitude={params.amplitude}
          />
          <VisualTestPause />
        </MatterScene>
        {/* Tweakpane manages its own DOM without ARIA labels. `aria-hidden`
            hides the pane from screen readers; the axe test excludes the
            `.tp-dfwv` subtree so the unlabeled internal controls don't trip
            aria-hidden-focus. The page content in <section> below is the
            accessible surface. */}
        <div
          ref={paneContainerRef}
          data-tweakpane-host
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: '1rem',
            right: '1rem',
            zIndex: 10,
            width: '320px',
          }}
        />
      </div>
      <section style={{ padding: '2rem', maxWidth: '60ch', margin: '0 auto' }}>
        <h1 style={{ marginTop: 0 }}>&lt;MeshGradient /&gt;</h1>
        <p>Phase 3 — sine domain warp. Palette + grain return in later phases.</p>
      </section>
    </main>
  )
}
