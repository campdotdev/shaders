// apps/docs/app/components/dot-field/page.tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { Pane } from 'tweakpane'
import dynamic from 'next/dynamic'
import { VisualTestPause } from '@/lib/visualTestHooks'

// Both MatterScene and DotField pull in three/webgpu (via createRenderer),
// which references `self` at module load time and breaks Next's SSR. Load
// both client-only.
const MatterScene = dynamic(() => import('@lovo/matter-react').then((m) => m.MatterScene), {
  ssr: false,
})
const DotField = dynamic(() => import('@matter/registry/dot-field').then((m) => m.DotField), {
  ssr: false,
})

interface Params {
  color: string
  spacing: number
  dotSize: number
  reach: number
  strength: number
  interactive: boolean
}

const INITIAL: Params = {
  color: '#888888',
  spacing: 30,
  dotSize: 2,
  reach: 100,
  strength: 1,
  interactive: true,
}

export default function DotFieldPage() {
  const paneContainerRef = useRef<HTMLDivElement>(null)
  const [params, setParams] = useState<Params>(INITIAL)

  useEffect(() => {
    const container = paneContainerRef.current
    if (!container) return
    const local = { ...INITIAL }
    const pane = new Pane({ container, title: '<DotField>' })
    pane.addBinding(local, 'color')
    pane.addBlade({ view: 'separator' })
    pane.addBinding(local, 'spacing', { min: 8, max: 80, step: 1 })
    pane.addBinding(local, 'dotSize', { label: 'dot size', min: 1, max: 8, step: 0.5 })
    pane.addBlade({ view: 'separator' })
    pane.addBinding(local, 'reach', { min: 10, max: 400, step: 5 })
    pane.addBinding(local, 'strength', { min: 0, max: 3, step: 0.05 })
    pane.addBlade({ view: 'separator' })
    pane.addBinding(local, 'interactive', { label: 'interactive (cursor)' })
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
        <MatterScene>
          <DotField
            color={params.color}
            spacing={params.spacing}
            dotSize={params.dotSize}
            reach={params.reach}
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
        <h1 style={{ marginTop: 0 }}>&lt;DotField /&gt;</h1>
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
  <DotField spacing={30} dotSize={2} color="#888" reach={100} strength={1} />
</MatterScene>`}
        </pre>
      </section>
    </main>
  )
}
