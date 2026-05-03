'use client'

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { Scene, OrthographicCamera } from 'three'
import { createRenderer, MatterScheduler } from '@lovo/matter'
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

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    let cancelled = false
    let disposed = false
    let value: MatterContextValue | null = null

    const setup = async () => {
      const renderer = await createRenderer(canvas, { maxDPR })
      if (cancelled) {
        renderer.dispose()
        return
      }
      const scene = new Scene()
      const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 10)
      camera.position.z = 1
      const scheduler = new MatterScheduler()

      // The scheduler renders the scene every frame.
      scheduler.add(() => renderer.three.render(scene, camera))
      scheduler.start()

      const onResize = () => renderer.resize()
      window.addEventListener('resize', onResize)

      value = { renderer, scene, camera, scheduler }
      setCtx(value)

      // Cleanup function lives in the outer effect's return below.
      ;(setup as unknown as { cleanup: () => void }).cleanup = () => {
        if (disposed) return
        disposed = true
        window.removeEventListener('resize', onResize)
        scheduler.dispose()
        renderer.dispose()
      }
    }

    void setup()
    return () => {
      cancelled = true
      ;(setup as unknown as { cleanup?: () => void }).cleanup?.()
      setCtx(null)
    }
  }, [maxDPR])

  return (
    <div className={className} style={{ ...defaultStyle, ...style }}>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
      {ctx ? (
        <MatterContext.Provider value={ctx}>{children}</MatterContext.Provider>
      ) : (
        fallback ?? null
      )}
    </div>
  )
}
