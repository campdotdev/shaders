'use client'

import { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { LinearGradient } from '@matter/registry/linear-gradient'
import { setReducedMotionPolicy, type ReducedMotionPolicy } from '@lovo/matter'
import { Pane } from 'tweakpane'

// Waves pulls in three/webgpu, which references `self` at module load time
// and breaks Next's SSR. Load it client-only.
const Waves = dynamic(() => import('@matter/registry/waves').then((m) => m.Waves), { ssr: false })

// Tweakpane mutates this object directly; React state tracks the display value.
const INITIAL_PARAMS: { policy: ReducedMotionPolicy } = { policy: 'auto' }

export function ReducedMotionDemo() {
  const paneRef = useRef<HTMLDivElement>(null)
  const [policy, setPolicy] = useState<ReducedMotionPolicy>('auto')

  useEffect(() => {
    if (!paneRef.current) return
    // Shallow-copy so each Strict Mode cycle gets a fresh params object.
    const params = { ...INITIAL_PARAMS }
    const pane = new Pane({ container: paneRef.current, title: 'Reduced motion' })
    pane
      .addBinding(params, 'policy', {
        options: { auto: 'auto', off: 'off', slow: 'slow', paused: 'paused' },
      })
      .on('change', (e) => {
        setPolicy(e.value as ReducedMotionPolicy)
        setReducedMotionPolicy(e.value as ReducedMotionPolicy)
      })
    return () => pane.dispose()
  }, [])

  return (
    <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        <div>
          <p style={{ margin: '0 0 0.5rem', fontSize: '0.875rem', fontWeight: 600 }}>
            LinearGradient
          </p>
          <div style={{ position: 'relative', width: 600, height: 400 }}>
            <LinearGradient
              colors={['#ff7b72', '#7b9cff', '#7bff9c']}
              angle={45}
              speed={1}
              style={{ borderRadius: 8 }}
            />
          </div>
        </div>
        <div>
          <p style={{ margin: '0 0 0.5rem', fontSize: '0.875rem', fontWeight: 600 }}>Waves</p>
          <p style={{ margin: '0 0 0.5rem', fontSize: '0.8rem', color: '#666' }}>
            Hover over the canvas to trigger the cursor ripple — it should also freeze when policy
            is paused.
          </p>
          <div style={{ position: 'relative', width: 600, height: 400 }}>
            <Waves
              color="#77eecc"
              amplitude={0.1}
              frequency={5}
              speed={1}
              layers={3}
              interactive
              style={{ borderRadius: 8 }}
            />
          </div>
        </div>
        <p style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: '#666' }}>
          Active policy: <code>{policy}</code>
        </p>
      </div>
      <div ref={paneRef} style={{ position: 'sticky', top: '1rem', width: 280 }} />
    </div>
  )
}
