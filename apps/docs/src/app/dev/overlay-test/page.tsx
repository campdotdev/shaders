'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'

const MatterScene = dynamic(() => import('@lovo/matter-react').then((m) => m.MatterScene), {
  ssr: false,
})
const MeshGradient = dynamic(
  () => import('@matter/registry/mesh-gradient').then((m) => m.MeshGradient),
  { ssr: false },
)
// TintOverlay imports `three/tsl` at module load, which Next's webpack alias
// resolves to `three.webgpu.js` — a bundle that references `self` at parse
// time and cannot SSR (CLAUDE.md gotcha #10). Load client-only.
const TintOverlay = dynamic(() => import('./TintOverlay').then((m) => m.TintOverlay), {
  ssr: false,
})

export default function OverlayTestPage() {
  const [tintAbove, setTintAbove] = useState(true)
  const [intensity, setIntensity] = useState(0.3)

  return (
    <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <h1>Overlay test (dev only)</h1>
      <p style={{ color: 'var(--fg-muted)' }}>
        Validation page for the overlay registration pipeline. The tint overlay should
        visibly mix MeshGradient&apos;s output toward red. Toggle the order to feel the
        stacking work.
      </p>
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
        <button onClick={() => setTintAbove((v) => !v)}>
          Order: {tintAbove ? 'gradient → tint' : 'tint → gradient (same render result)'}
        </button>
        <label>
          Intensity:{' '}
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={intensity}
            onChange={(e) => setIntensity(Number(e.target.value))}
          />
        </label>
      </div>
      <div style={{ position: 'relative', width: '100%', height: '400px' }}>
        <MatterScene>
          <MeshGradient />
          {tintAbove ? (
            <TintOverlay color="#ff0000" intensity={intensity} />
          ) : null}
        </MatterScene>
      </div>
    </div>
  )
}
