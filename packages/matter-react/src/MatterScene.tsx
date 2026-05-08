'use client'

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { Scene, OrthographicCamera } from 'three'
import { createRenderer, MatterScheduler, createVisibilityWatcher, createIntersectionWatcher } from '@lovo/matter'
import { MatterContext, type MatterContextValue } from './matter-context.js'

export interface MatterSceneProps {
  children?: ReactNode
  /** Rendered server-side and during WebGPU init. Default: empty. */
  fallback?: ReactNode
  className?: string
  style?: CSSProperties
  /** Cap on devicePixelRatio. Default: 2. */
  maxDPR?: number
}

const defaultStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  display: 'block',
  width: '100%',
  height: '100%',
}

/**
 * Owns a canvas, a Three.js renderer (WebGPU + WebGL2 fallback), an
 * orthographic camera covering the canvas, an empty Scene, and a
 * MatterScheduler. Children consume these via useMatterContext().
 */
export function MatterScene(props: MatterSceneProps) {
  const { children, fallback, className, style, maxDPR } = props
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [ctx, setCtx] = useState<MatterContextValue | null>(null)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    let cancelled = false
    let cleanup: (() => void) | null = null

    const setup = async () => {
      try {
        const renderer = await createRenderer(canvas, { maxDPR })
        if (cancelled) {
          renderer.dispose()
          return
        }
        const scene = new Scene()
        const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 10)
        camera.position.z = 1
        const scheduler = new MatterScheduler()

        scheduler.add(() => renderer.three.render(scene, camera))
        scheduler.start()

        const visibility = createVisibilityWatcher()
        const intersection = createIntersectionWatcher(canvas)

        const updatePauseState = () => {
          const shouldRun = visibility.isVisible() && intersection.isInView()
          if (shouldRun) scheduler.resume()
          else scheduler.pause()
        }
        updatePauseState()

        const unsubVisibility = visibility.subscribe(updatePauseState)
        const unsubIntersection = intersection.subscribe(updatePauseState)

        const onResize = () => renderer.resize()
        window.addEventListener('resize', onResize)

        cleanup = () => {
          unsubVisibility()
          unsubIntersection()
          visibility.dispose()
          intersection.dispose()
          window.removeEventListener('resize', onResize)
          scheduler.dispose()
          renderer.dispose()
        }

        setCtx({ renderer, scene, camera, scheduler })
      } catch (err) {
        if (cancelled) return
        const e = err instanceof Error ? err : new Error(String(err))
        // eslint-disable-next-line no-console
        console.error('[MatterScene] renderer init failed:', e)
        setError(e)
      }
    }

    void setup()
    return () => {
      cancelled = true
      cleanup?.()
      cleanup = null
      setCtx(null)
    }
  }, [maxDPR])

  return (
    <div className={className} style={{ ...defaultStyle, ...style }}>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
      {error ? (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
            color: '#fff',
            background: 'rgba(120, 30, 30, 0.85)',
            font: '0.85rem ui-monospace, monospace',
            whiteSpace: 'pre-wrap',
            textAlign: 'center',
          }}
        >
          MatterScene init failed:
          {'\n'}
          {error.message}
        </div>
      ) : ctx ? (
        <MatterContext.Provider value={ctx}>{children}</MatterContext.Provider>
      ) : (
        fallback ?? null
      )}
    </div>
  )
}
