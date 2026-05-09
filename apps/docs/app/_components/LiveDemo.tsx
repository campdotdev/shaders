'use client'

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'

interface LiveDemoProps {
  children: ReactNode
  height?: string
  background?: string
  className?: string
  style?: CSSProperties
}

// Frames a shader child with a fixed-height container, a dark default
// background (so the shader has a sane backdrop pre-init), and a fullscreen
// toggle button. Play/pause is intentionally not wired in 4.1 — that's an M5
// concern once MatterScheduler exposes a control surface.
export function LiveDemo({
  children,
  height = '70vh',
  background = '#0a0a14',
  className,
  style,
}: LiveDemoProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)

  // Single useEffect owns the listener for the lifetime of the mounted
  // component; React Strict Mode's mount/cleanup/mount pattern is fine here
  // because the listener is just observation — no heavy resource to dispose.
  useEffect(() => {
    const handler = () => {
      setIsFullscreen(document.fullscreenElement === ref.current)
    }
    document.addEventListener('fullscreenchange', handler)
    return () => {
      document.removeEventListener('fullscreenchange', handler)
    }
  }, [])

  const toggleFullscreen = () => {
    if (document.fullscreenElement === ref.current) {
      void document.exitFullscreen()
    } else {
      void ref.current?.requestFullscreen()
    }
  }

  return (
    <div
      ref={ref}
      className={className}
      style={{
        position: 'relative',
        height: isFullscreen ? '100vh' : height,
        background,
        borderRadius: isFullscreen ? 0 : 8,
        overflow: 'hidden',
        border: isFullscreen ? 'none' : '1px solid var(--border)',
        ...style,
      }}
    >
      {/* The shader canvas is purely decorative — hide it from the a11y tree
          so screen readers don't attempt to describe raw pixel output. The
          fullscreen button is kept outside this subtree so it remains
          keyboard-accessible. */}
      <div
        aria-hidden="true"
        role="presentation"
        style={{ position: 'absolute', inset: 0 }}
      >
        {children}
      </div>
      <button
        onClick={toggleFullscreen}
        aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
        style={{
          position: 'absolute',
          top: '0.5rem',
          right: '0.5rem',
          zIndex: 5,
          width: 32,
          height: 32,
          border: 'none',
          borderRadius: 6,
          background: 'rgba(0, 0, 0, 0.4)',
          color: '#fff',
          cursor: 'pointer',
          fontSize: '0.85rem',
        }}
      >
        {isFullscreen ? '×' : '⛶'}
      </button>
    </div>
  )
}
