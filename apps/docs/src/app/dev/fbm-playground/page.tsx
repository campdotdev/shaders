'use client'

import dynamic from 'next/dynamic'

// The playground module imports `three/webgpu` (directly and transitively
// through `@lovo/matter` / `@lovo/matter-react`), which references `self`
// at module load and breaks Next's SSR pass. Load it client-only.
// (CLAUDE.md gotcha #10 — same pattern as `apps/docs/app/components/linear-gradient/page.tsx`.)
const FbmPlayground = dynamic(() => import('./FbmScene'), { ssr: false })

export default function FbmPlaygroundPage() {
  return <FbmPlayground />
}
