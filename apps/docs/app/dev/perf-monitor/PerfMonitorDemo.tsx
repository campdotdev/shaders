'use client'

import { useState } from 'react'
import { LinearGradient } from '@matter/registry/linear-gradient'
import { MatterMonitor } from '@lovo/matter-react'

export function PerfMonitorDemo() {
  const [speed, setSpeed] = useState(0.5)
  return (
    <div>
      <label style={{ display: 'block', marginBottom: 12 }}>
        speed:{' '}
        <input
          type="range"
          min={0}
          max={2}
          step={0.1}
          value={speed}
          onChange={(e) => setSpeed(+e.target.value)}
        />
        <code style={{ marginLeft: 8 }}>{speed.toFixed(1)}</code>
      </label>
      <div style={{ position: 'relative', width: 600, height: 400 }}>
        <LinearGradient colors={['#ff7b72', '#7b9cff']} angle={45} speed={speed}>
          <MatterMonitor anchor="top-right" />
        </LinearGradient>
      </div>
      <p style={{ marginTop: 12, color: '#666' }}>
        Set <code>speed</code> to 0 &mdash; fps should drop to 0 after one final flush tick
        (render-on-demand). Switch tabs &mdash; fps should drop to 0 (visibility pause). Scroll the
        canvas off-screen &mdash; fps should drop to 0 (intersection pause).
      </p>
    </div>
  )
}
