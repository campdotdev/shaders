'use client'

import dynamic from 'next/dynamic'

// PerfMonitorDemo imports three/webgpu (transitively via @lovo/matter and
// @matter/registry), which references `self` at module load and breaks
// Next's SSR pass. Load it client-only. (CLAUDE.md gotcha #10 — same pattern
// as reduced-motion/page.tsx and offscreen-pause/page.tsx.)
const PerfMonitorDemo = dynamic(() => import('./PerfMonitorDemo').then((m) => m.PerfMonitorDemo), {
  ssr: false,
})

export default function Page() {
  return (
    <main style={{ padding: '2rem', maxWidth: 1100, margin: '0 auto' }}>
      <h1>Perf monitor</h1>
      <PerfMonitorDemo />
    </main>
  )
}
