'use client';

import { useState } from 'react';

import { ShaderMonitor, ShaderScene } from '@lovo/matter-react';
import { LinearGradient } from '@matter/registry/linear-gradient';

export function PerfMonitorDemo() {
  const [speed, setSpeed] = useState(0.5);

  return (
    <div>
      <label style={{ display: 'block', marginBottom: 12 }}>
        speed:{' '}
        <input
          max={2}
          min={0}
          onChange={(e) => setSpeed(+e.target.value)}
          step={0.1}
          type="range"
          value={speed}
        />
        <code style={{ marginLeft: 8 }}>{speed.toFixed(1)}</code>
      </label>
      <div style={{ position: 'relative', width: 600, height: 400 }}>
        <ShaderScene>
          <LinearGradient
            angle={45}
            speed={speed}
            stops={[{ color: '#ff7b72' }, { color: '#7b9cff' }]}
          />
          <ShaderMonitor anchor="top-right" />
        </ShaderScene>
      </div>
      <p style={{ marginTop: 12, color: '#666' }}>
        Set <code>speed</code> to 0 &mdash; fps should drop to 0 after one final flush tick
        (render-on-demand). Switch tabs &mdash; fps should drop to 0 (visibility pause). Scroll the
        canvas off-screen &mdash; fps should drop to 0 (intersection pause).
      </p>
    </div>
  );
}
