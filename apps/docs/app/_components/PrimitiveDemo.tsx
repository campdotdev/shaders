'use client'

import { useCallback, useState } from 'react'
import dynamic from 'next/dynamic'
import {
  PropsPlayground,
  initialStateFromSchema,
  type PropSchema,
  type PropsState,
} from './PropsPlayground'
import type { PrimitiveControl } from '../_data/primitives'

interface PrimitiveDemoProps {
  slug: string
  controls: readonly PrimitiveControl[]
}

// PrimitiveScene pulls in three/webgpu transitively (via @lovo/matter-react's
// MatterScene), and three/webgpu touches `self` at module load — that breaks
// SSR. `ssr: false` requires a Client Component host, which is why this file
// (the host of the dynamic import) carries the 'use client' directive.
const PrimitiveScene = dynamic(() => import('./PrimitiveScene').then((m) => m.PrimitiveScene), {
  ssr: false,
})

// Maps each PrimitiveControl entry onto a PropsPlayground number-slider entry.
// All primitive controls in M4 are numeric; if a future primitive needs a
// non-number control, add the type discrimination here.
const buildSchema = (controls: readonly PrimitiveControl[]): PropSchema =>
  controls.map((c) => ({
    name: c.name,
    type: 'number' as const,
    default: c.default,
    min: c.min,
    max: c.max,
    step: c.step,
  }))

export function PrimitiveDemo({ slug, controls }: PrimitiveDemoProps) {
  const schema = buildSchema(controls)
  const [params, setParams] = useState<PropsState>(() => initialStateFromSchema(schema))

  // Stable callback so PropsPlayground's useEffect dep on onChange doesn't
  // re-fire every render. Mirrors the pattern from LinearGradient's PageBody.
  const handleChange = useCallback((next: PropsState) => {
    setParams(next)
  }, [])

  return (
    <div>
      <div
        style={{
          position: 'relative',
          height: 320,
          background: '#0a0a14',
          borderRadius: 8,
          overflow: 'hidden',
          border: '1px solid var(--border)',
        }}
      >
        <PrimitiveScene slug={slug} params={params} />
      </div>
      {schema.length > 0 && (
        <div style={{ marginTop: '1rem' }}>
          <PropsPlayground schema={schema} onChange={handleChange} />
        </div>
      )}
    </div>
  )
}
