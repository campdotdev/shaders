'use client'

import { useEffect, useRef, useState } from 'react'
import { Pane } from 'tweakpane'
import dynamic from 'next/dynamic'

// LinearGradient pulls in three/webgpu, which references `self` at module
// load time and breaks Next's SSR. Load it client-only.
const LinearGradient = dynamic(
  () => import('@matter/registry/linear-gradient').then((m) => m.LinearGradient),
  { ssr: false },
)

interface Params {
  color0: string
  color1: string
  color2: string
  useThirdColor: boolean
  angle: number
  speed: number
  variant: 'linear' | 'radial'
  focalX: number
  focalY: number
  interactive: boolean
}

const INITIAL: Params = {
  color0: '#ff7b72',
  color1: '#7b9cff',
  color2: '#7bffd0',
  useThirdColor: false,
  angle: 45,
  speed: 0.2,
  variant: 'linear',
  focalX: 0.5,
  focalY: 0.5,
  interactive: true,
}

export default function LinearGradientPage() {
  const paneContainerRef = useRef<HTMLDivElement>(null)
  const [params, setParams] = useState<Params>(INITIAL)
  // Bumping `instanceKey` forces <LinearGradient> to remount, since several
  // of its props (angle/speed/focal/variant) are snapshotted into the TSL
  // material at mount time in M1 (full live AnimatableProp wiring is M3).
  const [instanceKey, setInstanceKey] = useState(0)

  useEffect(() => {
    const container = paneContainerRef.current
    if (!container) return

    const local = { ...INITIAL }
    const pane = new Pane({ container, title: '<LinearGradient>' })

    pane.addBinding(local, 'color0', { label: 'color 0' })
    pane.addBinding(local, 'color1', { label: 'color 1' })
    pane.addBinding(local, 'useThirdColor', { label: '+ 3rd color' })
    pane.addBinding(local, 'color2', { label: 'color 2' })
    pane.addBlade({ view: 'separator' })
    pane.addBinding(local, 'variant', {
      label: 'variant',
      options: { linear: 'linear', radial: 'radial' },
    })
    pane.addBinding(local, 'angle', { label: 'angle (deg)', min: 0, max: 360, step: 1 })
    pane.addBinding(local, 'speed', { label: 'speed', min: 0, max: 2, step: 0.01 })
    pane.addBlade({ view: 'separator' })
    pane.addBinding(local, 'focalX', { label: 'focal x', min: 0, max: 1, step: 0.01 })
    pane.addBinding(local, 'focalY', { label: 'focal y', min: 0, max: 1, step: 0.01 })
    pane.addBlade({ view: 'separator' })
    pane.addBinding(local, 'interactive', { label: 'interactive (cursor)' })

    pane.on('change', () => {
      setParams({ ...local })
      // Most uniforms are read at material-build time; remount to apply.
      setInstanceKey((k) => k + 1)
    })

    return () => {
      pane.dispose()
    }
  }, [])

  const colors = params.useThirdColor
    ? [params.color0, params.color1, params.color2]
    : [params.color0, params.color1]

  return (
    <main style={{ minHeight: '100vh', position: 'relative' }}>
      <div style={{ position: 'relative', height: '70vh' }}>
        <LinearGradient
          key={instanceKey}
          colors={colors}
          angle={params.angle}
          speed={params.speed}
          variant={params.variant}
          focalPoint={[params.focalX, params.focalY]}
          interactive={params.interactive}
        />
      </div>
      <div
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
        <h1 style={{ marginTop: 0 }}>&lt;LinearGradient /&gt;</h1>
        <p>
          Animated linear or radial gradient with optional cursor parallax. The simplest,
          foundational Matter component — proves the architecture end-to-end.
        </p>
        <p style={{ opacity: 0.7, fontSize: '0.9rem' }}>
          The panel in the top-right is live. Tweak the values and the canvas above
          remounts with the new props. (In M3, AnimatableProp uniforms become fully
          live — no remount needed.)
        </p>
        <h2>Usage</h2>
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
{`import { LinearGradient } from '@/components/matter/linear-gradient'

<LinearGradient
  colors={['#ff7b72', '#7b9cff']}
  angle={45}
  speed={0.2}
  interactive
/>`}
        </pre>
        <p style={{ opacity: 0.8 }}>
          (In Milestone 2, the CLI will copy <code>linear-gradient.tsx</code> into your
          project so you own and can edit the source.)
        </p>
      </section>
    </main>
  )
}
