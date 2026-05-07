// apps/docs/app/components/aurora/page.tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { Pane } from 'tweakpane'
import dynamic from 'next/dynamic'

// Aurora pulls in three/webgpu, which references `self` at module load time
// and breaks Next's SSR. Load it client-only.
const Aurora = dynamic(
  () => import('@matter/registry/aurora').then((m) => m.Aurora),
  { ssr: false },
)

interface Params {
  c0: string
  c1: string
  c2: string
  speed: number
  intensity: number
  cursorStrength: number
  interactive: boolean
}

const INITIAL: Params = {
  c0: '#7b61ff',
  c1: '#5fc7ff',
  c2: '#ff61a6',
  speed: 0.4,
  intensity: 1,
  cursorStrength: 1,
  interactive: false,
}

export default function AuroraPage() {
  const paneContainerRef = useRef<HTMLDivElement>(null)
  const [params, setParams] = useState<Params>(INITIAL)

  useEffect(() => {
    const container = paneContainerRef.current
    if (!container) return
    const local = { ...INITIAL }
    const pane = new Pane({ container, title: '<Aurora>' })
    pane.addBinding(local, 'c0', { label: 'color 0' })
    pane.addBinding(local, 'c1', { label: 'color 1' })
    pane.addBinding(local, 'c2', { label: 'color 2' })
    pane.addBlade({ view: 'separator' })
    pane.addBinding(local, 'speed', { min: 0, max: 2, step: 0.01 })
    pane.addBinding(local, 'intensity', { min: 0, max: 3, step: 0.01 })
    pane.addBlade({ view: 'separator' })
    pane.addBinding(local, 'interactive', { label: 'interactive (cursor warps flow)' })
    pane.addBinding(local, 'cursorStrength', {
      label: 'cursor strength',
      min: 0,
      max: 3,
      step: 0.01,
    })
    pane.on('change', () => {
      setParams({ ...local })
    })
    return () => {
      pane.dispose()
    }
  }, [])

  return (
    <main style={{ minHeight: '100vh', position: 'relative' }}>
      <div style={{ position: 'relative', height: '70vh', background: '#0a0a14' }}>
        <Aurora
          colors={[params.c0, params.c1, params.c2]}
          speed={params.speed}
          intensity={params.intensity}
          cursorStrength={params.cursorStrength}
          interactive={params.interactive}
        />
      </div>
      <div
        ref={paneContainerRef}
        style={{ position: 'fixed', top: '1rem', right: '1rem', zIndex: 10, width: '320px' }}
      />
      <section style={{ padding: '2rem', maxWidth: '60ch', margin: '0 auto' }}>
        <h1 style={{ marginTop: 0 }}>&lt;Aurora /&gt;</h1>
        <pre
          style={{
            background: '#1a1a2a',
            color: '#e0e0f0',
            padding: '1rem',
            borderRadius: '0.5rem',
            fontSize: '0.85rem',
          }}
        >
{`<Aurora colors={['#7b61ff','#5fc7ff','#ff61a6']} speed={0.4} intensity={1} />`}
        </pre>
      </section>
    </main>
  )
}
