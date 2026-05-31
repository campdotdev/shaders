'use client'

import dynamic from 'next/dynamic'
import { useState } from 'react'

const MatterScene = dynamic(() => import('@lovo/matter-react').then((m) => m.MatterScene), {
  ssr: false,
})
const Aurora = dynamic(() => import('@matter/registry/aurora').then((m) => m.Aurora), {
  ssr: false,
})

const OLD_LAYERS = [
  { hex: '#09e24b', speed: 0.07, intensity: 0.6, variation: 0 },
  { hex: '#1837e6', speed: 0.1, intensity: 0, variation: 5 },
  { hex: '#661acc', speed: 0.15, intensity: 0.3, variation: 11 },
  { hex: '#cc1a99', speed: 0.07, intensity: 0, variation: 17 },
] as const

const OLD_HORIZON = '#040009'
const OLD_SKY = '#146389'

export function AuroraCompare() {
  const [mode, setMode] = useState<'old' | 'new'>('new')

  const btn = (label: string, value: 'old' | 'new') => (
    <button
      onClick={() => setMode(value)}
      style={{
        background: mode === value ? '#A3C100' : 'transparent',
        color: mode === value ? '#0B0F0D' : '#E7E9E7',
        border: '1px solid #535A55',
        borderRadius: 6,
        padding: '8px 16px',
        cursor: 'pointer',
        fontSize: 13,
        fontWeight: 600,
      }}
    >
      {label}
    </button>
  )

  return (
    <main style={{ background: '#0B0F0D', color: '#E7E9E7', minHeight: '100vh', padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 4px' }}>
            Aurora — old vs new defaults
          </h1>
          <p style={{ fontSize: 13, color: '#8B918C', margin: 0 }}>
            Toggle between original Shadertoy-inspired colors and the new with-depth palette
            picks. Same MatterScene, same Aurora component — only the color props differ.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>{btn('Old defaults', 'old')}{btn('New defaults', 'new')}</div>
      </div>

      <div style={{ position: 'relative', height: '78vh', borderRadius: 8, overflow: 'hidden' }}>
        {mode === 'old' ? (
          <MatterScene key="old">
            <Aurora
              horizonColor={OLD_HORIZON}
              skyColor={OLD_SKY}
              layers={[...OLD_LAYERS]}
            />
          </MatterScene>
        ) : (
          <MatterScene key="new">
            <Aurora />
          </MatterScene>
        )}
      </div>

      <div
        style={{
          fontFamily: 'ui-monospace, monospace',
          fontSize: 11,
          color: '#8B918C',
          marginTop: 12,
          lineHeight: 1.7,
        }}
      >
        {mode === 'old' ? (
          <>
            horizon <span style={{ color: '#E7E9E7' }}>#040009</span> · sky{' '}
            <span style={{ color: '#E7E9E7' }}>#146389</span>
            <br />
            layers <span style={{ color: '#09e24b' }}>#09e24b</span> ·{' '}
            <span style={{ color: '#1837e6' }}>#1837e6</span> ·{' '}
            <span style={{ color: '#661acc' }}>#661acc</span> ·{' '}
            <span style={{ color: '#cc1a99' }}>#cc1a99</span>
          </>
        ) : (
          <>
            horizon palette.black <span style={{ color: '#E7E9E7' }}>#0B0F0D</span> · sky
            palette.blue.dark <span style={{ color: '#E7E9E7' }}>#003569</span>
            <br />
            layers palette.lime[9] <span style={{ color: '#A3C100' }}>#A3C100</span> ·
            palette.blue.mid <span style={{ color: '#359bff' }}>#359bff</span> ·
            palette.violet.mid <span style={{ color: '#a581fa' }}>#a581fa</span> ·
            palette.pink.mid <span style={{ color: '#e36ab9' }}>#e36ab9</span>
          </>
        )}
      </div>
    </main>
  )
}
