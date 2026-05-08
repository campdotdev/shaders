'use client'

import { useEffect, useRef, useState, useContext, type CSSProperties } from 'react'
import { MatterContext } from './matter-context.js'

export type MonitorAnchor = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'

const anchorStyle: Record<MonitorAnchor, CSSProperties> = {
  'top-left': { top: 8, left: 8 },
  'top-right': { top: 8, right: 8 },
  'bottom-left': { bottom: 8, left: 8 },
  'bottom-right': { bottom: 8, right: 8 },
}

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
}

export interface MatterMonitorProps {
  anchor?: MonitorAnchor
}

/**
 * Dev-only overlay that displays the current scene's FPS, tick count, and
 * paused/idle state. Reads from the surrounding `<MatterScene>` via context
 * and subscribes to its scheduler. Renders nothing useful if mounted outside
 * a scene.
 */
export function MatterMonitor({ anchor = 'top-right' }: MatterMonitorProps) {
  const ctx = useContext(MatterContext)
  const [stats, setStats] = useState({ fps: 0, ticks: 0, frames: 0 })
  const ticksRef = useRef(0)
  const fpsAccumRef = useRef({ frames: 0, lastSampleAt: 0, fps: 0 })

  useEffect(() => {
    if (!ctx) return
    const client = (tick: { now: number }) => {
      ticksRef.current += 1
      const acc = fpsAccumRef.current
      acc.frames += 1
      if (acc.lastSampleAt === 0) acc.lastSampleAt = tick.now
      const dt = tick.now - acc.lastSampleAt
      if (dt >= 500) {
        acc.fps = Math.round((acc.frames * 1000) / dt)
        acc.frames = 0
        acc.lastSampleAt = tick.now
      }
      setStats({ fps: acc.fps, ticks: ticksRef.current, frames: acc.frames })
    }
    ctx.scheduler.add(client)
    return () => ctx.scheduler.remove(client)
  }, [ctx])

  if (!ctx) {
    return (
      <div data-testid="matter-monitor" style={{ ...baseStyle, ...anchorStyle[anchor] }}>
        no scene
      </div>
    )
  }

  return (
    <div data-testid="matter-monitor" style={{ ...baseStyle, ...anchorStyle[anchor] }}>
      <span data-testid="matter-monitor-fps">fps: {stats.fps || '—'}</span>
      {'\n'}
      <span data-testid="matter-monitor-ticks">ticks: {stats.ticks}</span>
    </div>
  )
}
