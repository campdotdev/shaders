'use client'

import { useCallback, useState, type ReactNode } from 'react'
import dynamic from 'next/dynamic'
import { LiveDemo } from '../../_components/LiveDemo'
import {
  PropsPlayground,
  initialStateFromSchema,
  type PropSchema,
  type PropsState,
} from '../../_components/PropsPlayground'
import { VisualTestPause } from '../../_lib/visualTestHooks'

// LinearGradient pulls in three/webgpu, which references `self` at module
// load time and breaks Next's SSR. `ssr: false` requires this to live in a
// Client Component (Next 15 forbids it in Server Components).
const LinearGradient = dynamic(
  () => import('@matter/registry/linear-gradient').then((m) => m.LinearGradient),
  { ssr: false },
)

interface PageBodyProps {
  schema: PropSchema
  // Server-rendered CodeBlock passed in as a prop. Next 15 supports passing
  // Server Components into Client Components via children/props — the host
  // page resolves it on the server and we just slot it into our layout.
  code: ReactNode
}

// Owns the playground state shared between the live shader and the controls.
// Splitting this out of the page lets the page itself be a Server Component
// (which is required to call readRegistrySource).
export function PageBody({ schema, code }: PageBodyProps) {
  const [params, setParams] = useState<PropsState>(() => initialStateFromSchema(schema))

  // Stable callback so PropsPlayground's useEffect dep on onChange doesn't
  // re-fire every render. (PropsPlayground intentionally depends on the
  // callback identity to avoid missing newly-bound handlers; we keep it
  // stable here.)
  const handleChange = useCallback((next: PropsState) => {
    setParams(next)
  }, [])

  // Stringify props for the remount key — LinearGradient snapshots several
  // props into TSL at material-build time (see registry/linear-gradient.tsx
  // and CLAUDE.md). Changing colors / angle / speed / variant requires a
  // remount to apply. The cursor (when `interactive`) is wired to a live
  // uniform and updates per-frame, so the toggle alone doesn't need a key.
  const colors = params.colors as string[]
  const angle = params.angle as number
  const speed = params.speed as number
  const variant = params.variant as 'linear' | 'radial'
  const interactive = params.interactive as boolean
  const remountKey = `${colors.join('|')}|${angle}|${speed}|${variant}`

  return (
    <>
      <LiveDemo>
        <LinearGradient
          key={remountKey}
          colors={colors}
          angle={angle}
          speed={speed}
          variant={variant}
          interactive={interactive}
        >
          <VisualTestPause />
        </LinearGradient>
      </LiveDemo>

      <div
        style={{
          marginTop: '1.5rem',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '1.5rem',
        }}
      >
        <div>
          <h2 style={{ fontSize: '1rem', marginTop: 0 }}>Playground</h2>
          <PropsPlayground schema={schema} onChange={handleChange} />
        </div>
        <div>
          <h2 style={{ fontSize: '1rem', marginTop: 0 }}>Source</h2>
          {code}
        </div>
      </div>
    </>
  )
}
