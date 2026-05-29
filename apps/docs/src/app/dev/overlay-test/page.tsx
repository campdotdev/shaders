'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'

import type { FilmGrainMode } from '@matter/registry/film-grain'

const MatterScene = dynamic(() => import('@lovo/matter-react').then((m) => m.MatterScene), {
  ssr: false,
})
const MeshGradient = dynamic(
  () => import('@matter/registry/mesh-gradient').then((m) => m.MeshGradient),
  { ssr: false },
)
// FilmGrain imports `three/tsl` at module load, which Next's webpack alias
// resolves to `three.webgpu.js` — a bundle that references `self` at parse
// time and cannot SSR (CLAUDE.md gotcha #10). Load client-only.
const FilmGrain = dynamic(() => import('@matter/registry/film-grain').then((m) => m.FilmGrain), {
  ssr: false,
})

export default function OverlayTestPage() {
  const [intensity, setIntensity] = useState(0.3)
  const [speed, setSpeed] = useState(1)
  const [mode, setMode] = useState<FilmGrainMode>('additive')

  return (
    <div
      style={{
        padding: '1rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
      }}
    >
      <h1>Overlay test (dev only)</h1>
      <p style={{ color: 'var(--fg-muted)' }}>
        Validation page for the overlay registration pipeline. FilmGrain should appear as a layer of
        noise on top of MeshGradient. Drag intensity to confirm the uniform reads through; drag
        speed to feel the shutter-rate quantization (low speed = chunky 24Hz cadence). Toggle mode
        to compare additive (brightness-preserving, half pixels brighten) vs. subtractive
        (silver-emulsion, only darkens).
      </p>
      <div
        style={{
          display: 'flex',
          gap: '1rem',
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        <label>
          Intensity: {intensity.toFixed(2)}{' '}
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={intensity}
            onChange={(e) => setIntensity(Number(e.target.value))}
          />
        </label>
        <label>
          Speed: {speed.toFixed(2)}{' '}
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
          />
        </label>
        <button onClick={() => setMode((m) => (m === 'additive' ? 'subtractive' : 'additive'))}>
          Mode: {mode}
        </button>
      </div>
      <div style={{ position: 'relative', width: '100%', height: '400px' }}>
        <MatterScene>
          <MeshGradient />
          <FilmGrain intensity={intensity} speed={speed} mode={mode} />
        </MatterScene>
      </div>
    </div>
  )
}
