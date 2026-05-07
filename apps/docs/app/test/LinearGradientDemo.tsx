'use client'

import dynamic from 'next/dynamic'
import { LiveDemo } from '../_components/LiveDemo'

// LinearGradient pulls in three/webgpu, which references `self` at module
// load time and breaks Next's SSR. `ssr: false` requires this to live in a
// Client Component (Next 15 forbids it in Server Components).
const LinearGradient = dynamic(
  () => import('@matter/registry/linear-gradient').then((m) => m.LinearGradient),
  { ssr: false },
)

export function LinearGradientDemo() {
  return (
    <LiveDemo>
      <LinearGradient />
    </LiveDemo>
  )
}
