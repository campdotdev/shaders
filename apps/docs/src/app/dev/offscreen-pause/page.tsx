'use client'

import dynamic from 'next/dynamic'

// OffscreenPauseDemo imports three/webgpu (transitively via @lovo/matter and
// @matter/registry), which references `self` at module load and breaks
// Next's SSR pass. Load it client-only. (CLAUDE.md gotcha #10 — same pattern
// as reduced-motion/page.tsx and fbm-playground/page.tsx.)
const OffscreenPauseDemo = dynamic(
  () => import('./OffscreenPauseDemo').then((m) => m.OffscreenPauseDemo),
  { ssr: false },
)

export default function Page() {
  return <OffscreenPauseDemo />
}
