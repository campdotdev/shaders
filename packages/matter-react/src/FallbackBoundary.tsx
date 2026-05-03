'use client'

import { useEffect, useState, type ReactNode } from 'react'

export interface FallbackBoundaryProps {
  /** Rendered until WebGPU/WebGL is available on the client. */
  fallback?: ReactNode
  children: ReactNode
}

/**
 * Render `fallback` until the component mounts on the client. Gates the
 * children behind client-only mounting so SSR/no-WebGPU users see a
 * sensible static placeholder rather than a flash of nothing.
 */
export function FallbackBoundary({ fallback, children }: FallbackBoundaryProps) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])
  return <>{mounted ? children : fallback ?? null}</>
}
