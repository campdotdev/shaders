// apps/docs/app/components/noise-field/page.tsx
'use client'

import dynamic from 'next/dynamic'
import { useState } from 'react'

import { palette } from '@/lib/palette'
import { useTweakpane } from '@/lib/useTweakpane'
import { VisualTestPause } from '@/lib/visualTestHooks'

const ShaderScene = dynamic(() => import('@lovo/matter-react').then((m) => m.ShaderScene), {
  ssr: false,
})
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
  color0: palette.gray[1],
  color1: palette.gray[11],
  scale: 3,
  speed: 0.4,
  octaves: 4,
  variant: 'organic',
  interactive: false,
}

export default function NoiseFieldPage() {
  const [instanceKey, setInstanceKey] = useState(0)
  const [params, paneContainerRef] = useTweakpane<Params>(
    '<NoiseField>',
    INITIAL,
    (pane, local, sync) => {
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
        sync()
        setInstanceKey((k) => k + 1)
      })

      pane.on('change', sync)
    },
  )

  return (
    <main style={{ minHeight: '100vh', position: 'relative' }}>
      <div style={{ position: 'relative', height: '70vh' }}>
        <ShaderScene>
          <NoiseField
            colors={[params.color0, params.color1]}
            interactive={params.interactive}
            key={instanceKey}
            octaves={params.octaves}
            scale={params.scale}
            speed={params.speed}
            variant={params.variant}
          />
          <VisualTestPause />
        </ShaderScene>
      </div>
      <div
        aria-hidden="true"
        data-tweakpane-host
        ref={paneContainerRef}
        style={{
          position: 'fixed',
          top: '1rem',
          right: '1rem',
          zIndex: 10,
          width: '320px',
        }}
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
          {`import { ShaderScene } from '@lovo/matter-react'
import { NoiseField } from '@/components/matter/noise-field'

<ShaderScene>
  <NoiseField
    variant="organic"
    scale={3}
    speed={0.4}
    colors={['#131614', '#E7E9E7']}
  />
</ShaderScene>`}
        </pre>
      </section>
    </main>
  )
}
