// apps/docs/app/components/mesh-gradient/page.tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { Pane } from 'tweakpane'
import dynamic from 'next/dynamic'
import { palette } from '@/lib/palette'
import { VisualTestPause } from '@/lib/visualTestHooks'

const MatterScene = dynamic(() => import('@lovo/matter-react').then((m) => m.MatterScene), {
  ssr: false,
})
const MeshGradient = dynamic(
  () => import('@matter/registry/mesh-gradient').then((m) => m.MeshGradient),
  { ssr: false },
)
const FilmGrain = dynamic(() => import('@matter/registry/film-grain').then((m) => m.FilmGrain), {
  ssr: false,
})

interface Params {
  speed: number
  frequency: number
  amplitude: number
  cycleSpeed: number
  cycleEase: number
  grain: number
  grainSpeed: number
  a0: string
  a1: string
  a2: string
  a3: string
  b0: string
  b1: string
  b2: string
  b3: string
}

const INITIAL: Params = {
  speed: 2,
  frequency: 5,
  amplitude: 30,
  cycleSpeed: 0.5,
  cycleEase: 0.6,
  grain: 0.08,
  grainSpeed: 1,
  a0: palette.amber.base,
  a1: palette.blue.base,
  a2: palette.magenta.base,
  a3: palette.lime.base,
  b0: palette.violet.dark,
  b1: palette.gray[1],
  b2: palette.magenta.base,
  b3: palette.amber.dark,
}

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
    pane.addBinding(local, 'cycleSpeed', {
      label: 'palette cycle',
      min: 0,
      max: 2,
      step: 0.01,
    })
    pane.addBinding(local, 'cycleEase', {
      label: 'cycle ease',
      min: 0.1,
      max: 3,
      step: 0.01,
    })
    pane.addBlade({ view: 'separator' })

    const grainFolder = pane.addFolder({ title: 'FilmGrain overlay' })
    grainFolder.addBinding(local, 'grain', { label: 'intensity', min: 0, max: 1, step: 0.01 })
    grainFolder.addBinding(local, 'grainSpeed', {
      label: 'speed',
      min: 0,
      max: 5,
      step: 0.01,
    })

    const aFolder = pane.addFolder({ title: 'Palette A', expanded: false })
    aFolder.addBinding(local, 'a0', { label: 'color 0' })
    aFolder.addBinding(local, 'a1', { label: 'color 1' })
    aFolder.addBinding(local, 'a2', { label: 'color 2' })
    aFolder.addBinding(local, 'a3', { label: 'color 3' })

    const bFolder = pane.addFolder({ title: 'Palette B', expanded: false })
    bFolder.addBinding(local, 'b0', { label: 'color 0' })
    bFolder.addBinding(local, 'b1', { label: 'color 1' })
    bFolder.addBinding(local, 'b2', { label: 'color 2' })
    bFolder.addBinding(local, 'b3', { label: 'color 3' })

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
            cycleSpeed={params.cycleSpeed}
            cycleEase={params.cycleEase}
            paletteA={[params.a0, params.a1, params.a2, params.a3]}
            paletteB={[params.b0, params.b1, params.b2, params.b3]}
          />
          <FilmGrain intensity={params.grain} speed={params.grainSpeed} />
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
        <p>
          Animated four-color mesh gradient with a time-cycling palette crossfade and a sine domain
          warp for organic motion. Pure gradient — grain is supplied separately by{' '}
          <code>&lt;FilmGrain&gt;</code>, stacked inside the same <code>&lt;MatterScene&gt;</code>.
          Drag grain to <code>0</code> in the panel to see the gradient on its own.
        </p>
        <pre
          style={{
            background: '#1a1a2a',
            color: '#e0e0f0',
            padding: '1rem',
            borderRadius: '0.5rem',
            fontSize: '0.85rem',
            whiteSpace: 'pre-wrap',
          }}
        >
          {`<MatterScene>
  <MeshGradient />
  <FilmGrain intensity={0.08} speed={1} />
</MatterScene>`}
        </pre>
      </section>
    </main>
  )
}
