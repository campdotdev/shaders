// apps/docs/app/components/waves/page.tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { Pane } from 'tweakpane'
import dynamic from 'next/dynamic'

// Waves pulls in three/webgpu, which references `self` at module load time
// and breaks Next's SSR. Load it client-only.
const Waves = dynamic(
  () => import('@matter/registry/waves').then((m) => m.Waves),
  { ssr: false },
)

interface Params {
  color: string
  amplitude: number
  frequency: number
  speed: number
  layers: number
  interactive: boolean
}

const INITIAL: Params = {
  color: '#77eecc',
  amplitude: 0.1,
  frequency: 5,
  speed: 1,
  layers: 3,
  interactive: true,
}

export default function WavesPage() {
  const paneContainerRef = useRef<HTMLDivElement>(null)
  const [params, setParams] = useState<Params>(INITIAL)

  useEffect(() => {
    const container = paneContainerRef.current
    if (!container) return
    const local = { ...INITIAL }
    const pane = new Pane({ container, title: '<Waves>' })
    pane.addBinding(local, 'color')
    pane.addBlade({ view: 'separator' })
    pane.addBinding(local, 'amplitude', { min: 0, max: 0.5, step: 0.005 })
    pane.addBinding(local, 'frequency', { min: 1, max: 30, step: 0.1 })
    pane.addBinding(local, 'speed', { min: 0, max: 4, step: 0.05 })
    pane.addBinding(local, 'layers', { min: 1, max: 6, step: 1 })
    pane.addBlade({ view: 'separator' })
    pane.addBinding(local, 'interactive', { label: 'interactive (cursor ripple)' })
    pane.addBlade({ view: 'separator' })
    // `layers` and `interactive` bake into the TSL fragment shape (loop length
    // and conditional ripple branch). Each change rebuilds the material via
    // the mesh effect's dep array. The Apply button defers their commit so a
    // user dragging the layers slider 1→6 doesn't trigger 5 mid-drag rebuilds;
    // they get one rebuild on click. Live-uniform props (color/amplitude/
    // frequency/speed) flow through the per-tick `change` handler below.
    pane.addButton({ title: 'Apply layers / interactive' }).on('click', () => {
      setParams({ ...local })
    })
    pane.on('change', (ev) => {
      const key = (ev.target as { key?: keyof Params }).key
      if (key === 'layers' || key === 'interactive') return
      setParams({ ...local })
    })
    return () => {
      pane.dispose()
    }
  }, [])

  return (
    <main style={{ minHeight: '100vh', position: 'relative' }}>
      <div style={{ position: 'relative', height: '70vh', background: '#0a0a14' }}>
        <Waves
          color={params.color}
          amplitude={params.amplitude}
          frequency={params.frequency}
          speed={params.speed}
          layers={params.layers}
          interactive={params.interactive}
        />
      </div>
      <div
        ref={paneContainerRef}
        style={{ position: 'fixed', top: '1rem', right: '1rem', zIndex: 10, width: '320px' }}
      />
      <section style={{ padding: '2rem', maxWidth: '60ch', margin: '0 auto' }}>
        <h1 style={{ marginTop: 0 }}>&lt;Waves /&gt;</h1>
        <pre
          style={{
            background: '#1a1a2a',
            color: '#e0e0f0',
            padding: '1rem',
            borderRadius: '0.5rem',
            fontSize: '0.85rem',
          }}
        >
{`<Waves amplitude={0.1} frequency={5} speed={1} layers={3} interactive />`}
        </pre>
      </section>
    </main>
  )
}
