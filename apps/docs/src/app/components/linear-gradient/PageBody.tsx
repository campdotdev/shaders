'use client'

import dynamic from 'next/dynamic'
import { type ReactNode, useCallback, useState } from 'react'

import { LiveDemo } from '@/components/LiveDemo'
import {
  initialStateFromSchema,
  type PropSchema,
  PropsPlayground,
  type PropsState,
} from '@/components/PropsPlayground'
import { VisualTestPause } from '@/lib/visualTestHooks'

const ShaderScene = dynamic(() => import('@lovo/matter-react').then((m) => m.ShaderScene), {
  ssr: false,
})
const LinearGradient = dynamic(
  () => import('@matter/registry/linear-gradient').then((m) => m.LinearGradient),
  { ssr: false },
)

interface PageBodyProps {
  schema: PropSchema
  code: ReactNode
}

export function PageBody({ schema, code }: PageBodyProps) {
  const [params, setParams] = useState<PropsState>(() => initialStateFromSchema(schema))

  const handleChange = useCallback((next: PropsState) => {
    setParams(next)
  }, [])

  const colors = Array.isArray(params.colors) ? params.colors : []
  const angle = typeof params.angle === 'number' ? params.angle : 0
  const speed = typeof params.speed === 'number' ? params.speed : 0
  const variant: 'linear' | 'radial' = params.variant === 'radial' ? 'radial' : 'linear'
  const interactive = params.interactive === true
  const remountKey = `${colors.join('|')}|${angle}|${speed}|${variant}`

  return (
    <>
      <LiveDemo>
        <ShaderScene>
          <LinearGradient
            angle={angle}
            colors={colors}
            interactive={interactive}
            key={remountKey}
            speed={speed}
            variant={variant}
          />
          <VisualTestPause />
        </ShaderScene>
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
          <PropsPlayground onChange={handleChange} schema={schema} />
        </div>
        <div>
          <h2 style={{ fontSize: '1rem', marginTop: 0 }}>Source</h2>
          {code}
        </div>
      </div>
    </>
  )
}
