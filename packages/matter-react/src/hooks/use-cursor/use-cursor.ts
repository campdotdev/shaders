'use client'

import { CursorInput, type CursorInputOptions, type Vec2 } from '@lovo/matter'
import { useEffect, useState } from 'react'

import { useShaderContext } from '../use-shader-context/use-shader-context.js'

export interface CursorSignal {
  get(): Vec2
  on(event: 'change', cb: (value: Vec2) => void): () => void
}

const STUB_SIGNAL: CursorSignal = {
  get: () => [0.5, 0.5] as const,
  on: () => () => undefined,
}

export function useCursor(opts: CursorInputOptions = {}): CursorSignal {
  const ctx = useShaderContext()
  const [input, setInput] = useState<CursorInput | null>(null)

  useEffect(() => {
    const canvas = ctx?.renderer.three.domElement
    const elementOpt = opts.element ?? (canvas instanceof HTMLElement ? canvas : undefined)
    const fresh = new CursorInput({ ...opts, element: elementOpt })

    setInput(fresh)

    let detach: (() => void) | null = null

    if (ctx?.scheduler) {
      const client = ({ delta }: { delta: number }) => fresh.tick(delta)

      ctx.scheduler.add(client)
      detach = () => ctx.scheduler.remove(client)
    } else {
      let raf: number | null = null
      let lastNow = performance.now()
      const loop = (now: number) => {
        const delta = (now - lastNow) / 1000

        lastNow = now
        fresh.tick(delta)
        raf = requestAnimationFrame(loop)
      }

      raf = requestAnimationFrame(loop)
      detach = () => {
        if (raf !== null) cancelAnimationFrame(raf)
      }
    }

    return () => {
      detach()
      fresh.dispose()
      setInput(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx])

  return input ?? STUB_SIGNAL
}
