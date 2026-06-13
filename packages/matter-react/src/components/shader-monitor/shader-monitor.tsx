'use client';

import { type CSSProperties, useContext, useEffect, useRef, useState } from 'react';

import { ShaderContext } from '../../context/shader-context.js';

export type ShaderMonitorAnchor = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

const anchorStyle: Record<ShaderMonitorAnchor, CSSProperties> = {
  'top-left': { top: 8, left: 8 },
  'top-right': { top: 8, right: 8 },
  'bottom-left': { bottom: 8, left: 8 },
  'bottom-right': { bottom: 8, right: 8 },
};

const baseStyle: CSSProperties = {
  position: 'absolute',
  zIndex: 10,
  padding: '6px 8px',
  borderRadius: 6,
  background: 'rgba(0, 0, 0, 0.6)',
  color: '#fff',
  font: '11px ui-monospace, monospace',
  lineHeight: 1.4,
  pointerEvents: 'none',
  whiteSpace: 'pre',
};

export interface ShaderMonitorProps {
  anchor?: ShaderMonitorAnchor;
}

export function ShaderMonitor({ anchor = 'top-right' }: ShaderMonitorProps) {
  const shaderContext = useContext(ShaderContext);
  const [stats, setStats] = useState({ fps: 0, ticks: 0, frames: 0 });
  const ticksRef = useRef(0);
  const fpsAccumRef = useRef({ frames: 0, lastSampleAt: 0, fps: 0 });

  useEffect(() => {
    if (!shaderContext) return;
    const schedulerTickHandler = (tick: { now: number }) => {
      ticksRef.current += 1;
      const fpsAccumulator = fpsAccumRef.current;

      fpsAccumulator.frames += 1;
      if (fpsAccumulator.lastSampleAt === 0) fpsAccumulator.lastSampleAt = tick.now;
      const deltaTimeSinceLastSample = tick.now - fpsAccumulator.lastSampleAt;

      if (deltaTimeSinceLastSample >= 500) {
        fpsAccumulator.fps = Math.round((fpsAccumulator.frames * 1000) / deltaTimeSinceLastSample);
        fpsAccumulator.frames = 0;
        fpsAccumulator.lastSampleAt = tick.now;
      }
      setStats({ fps: fpsAccumulator.fps, ticks: ticksRef.current, frames: fpsAccumulator.frames });
    };

    shaderContext.scheduler.add(schedulerTickHandler);

    return () => shaderContext.scheduler.remove(schedulerTickHandler);
  }, [shaderContext]);

  if (!shaderContext) {
    return (
      <div data-testid="matter-monitor" style={{ ...baseStyle, ...anchorStyle[anchor] }}>
        no scene
      </div>
    );
  }

  return (
    <div data-testid="matter-monitor" style={{ ...baseStyle, ...anchorStyle[anchor] }}>
      <span data-testid="matter-monitor-fps">fps: {stats.fps || '—'}</span>
      {'\n'}
      <span data-testid="matter-monitor-ticks">ticks: {stats.ticks}</span>
    </div>
  );
}
