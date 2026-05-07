'use client'

import dynamic from 'next/dynamic'

// MeshGradient prototype pulls in three/webgpu (directly and transitively
// through @lovo/matter and @lovo/matter-react), which references `self` at
// module load and breaks Next's SSR pass. Load it client-only.
// (CLAUDE.md gotcha #10 — same pattern as fbm-playground/page.tsx.)
const MeshGradientPlaygroundScene = dynamic(
  () => import('./MeshGradientPlaygroundScene'),
  { ssr: false },
)

export default function MeshGradientPlaygroundPage() {
  return <MeshGradientPlaygroundScene />
}
