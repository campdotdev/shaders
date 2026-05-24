// apps/docs/app/components/noise-field/page.tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { Pane } from 'tweakpane'
import dynamic from 'next/dynamic'
import { VisualTestPause } from '@/lib/visualTestHooks'

// Both MatterScene and NoiseField pull in three/webgpu (via createRenderer),
// which references `self` at module load time and breaks Next's SSR. Load
// both client-only.
const MatterScene = dynamic(
  () => import('@lovo/matter-react').then((m) => m.MatterScene),
  { ssr: false },
)
const NoiseField = dynamic(() => import('@matter/registry/noise-field').then((m) => m.NoiseField), {
  ssr: false,
})

interface Params {
  color0: string
  color1: string
  scale: number
  speed: number
  octaves: number
  variant: 'organic' | 'cellular' | 'grid'
  interactive: boolean
}

const INITIAL: Params = {
  color0: '#0a0a0a',
  color1: '#f5f5f5',
  scale: 3,
  speed: 0.4,
  octaves: 4,
  variant: 'organic',
  interactive: false,
}

export default function NoiseFieldPage() {
  const paneContainerRef = useRef<HTMLDivElement>(null)
  const [params, setParams] = useState<Params>(INITIAL)
  const [instanceKey, setInstanceKey] = useState(0)

  useEffect(() => {
    const container = paneContainerRef.current
    if (!container) return

    const local = { ...INITIAL }
    const pane = new Pane({ container, title: '<NoiseField>' })

    pane.addBinding(local, 'color0', { label: 'color 0' })
    pane.addBinding(local, 'color1', { label: 'color 1' })
    pane.addBlade({ view: 'separator' })
    pane.addBinding(local, 'variant', {
      options: { organic: 'organic', cellular: 'cellular', grid: 'grid' },
    })
    pane.addBinding(local, 'scale', { min: 0.5, max: 10, step: 0.1 })
    pane.addBinding(local, 'speed', { min: 0, max: 2, step: 0.01 })
    pane.addBinding(local, 'octaves', { min: 1, max: 8, step: 1 })
    pane.addBlade({ view: 'separator' })
    pane.addBinding(local, 'interactive', { label: 'interactive (cursor)' })
    pane.addBlade({ view: 'separator' })
    pane.addButton({ title: 'Apply octaves / variant' }).on('click', () => {
      setParams({ ...local })
      setInstanceKey((k) => k + 1)
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
      <div style={{ position: 'relative', height: '70vh' }}>
        <MatterScene>
          <NoiseField
            key={instanceKey}
            colors={[params.color0, params.color1]}
            scale={params.scale}
            speed={params.speed}
            octaves={params.octaves}
            variant={params.variant}
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
        <h1 style={{ marginTop: 0 }}>&lt;NoiseField /&gt;</h1>
        <pre
          style={{
            background: '#1a1a2a',
            color: '#e0e0f0',
            padding: '1rem',
            borderRadius: '0.5rem',
            overflow: 'auto',
            fontSize: '0.85rem',
          }}
        >
          {`import { MatterScene } from '@lovo/matter-react'
import { NoiseField } from '@/components/matter/noise-field'

<MatterScene>
  <NoiseField
    variant="organic"
    scale={3}
    speed={0.4}
    colors={['#0a0a0a', '#f5f5f5']}
  />
</MatterScene>`}
        </pre>
      </section>
    </main>
  )
}
