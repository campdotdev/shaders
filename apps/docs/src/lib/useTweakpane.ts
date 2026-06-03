'use client'

import { type RefObject, useEffect, useRef, useState } from 'react'
import { Pane } from 'tweakpane'

export function useTweakpane<T extends object>(
  title: string,
  initial: T,
  setup: (pane: Pane, local: T, sync: () => void) => void,
): [params: T, paneContainerRef: RefObject<HTMLDivElement | null>] {
  const paneContainerRef = useRef<HTMLDivElement>(null)
  const [params, setParams] = useState<T>(initial)
  // Capture the latest setup fn via ref so it doesn't need to be a dep
  const setupRef = useRef(setup)

  setupRef.current = setup

  useEffect(() => {
    const container = paneContainerRef.current

    if (!container) return

    const local = { ...initial }
    const pane = new Pane({ container, title })
    const sync = () => setParams({ ...local })

    setupRef.current(pane, local, sync)

    return () => {
      pane.dispose()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return [params, paneContainerRef]
}
