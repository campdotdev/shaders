// apps/docs/app/components/mesh-gradient/page.tsx
'use client'

import dynamic from 'next/dynamic'
import { VisualTestPause } from '@/lib/visualTestHooks'

const MatterScene = dynamic(() => import('@lovo/matter-react').then((m) => m.MatterScene), {
  ssr: false,
})
const MeshGradient = dynamic(
  () => import('@matter/registry/mesh-gradient').then((m) => m.MeshGradient),
  { ssr: false },
)

export default function MeshGradientPage() {
  return (
    <main style={{ minHeight: '100vh', position: 'relative' }}>
      <div style={{ position: 'relative', height: '70vh' }}>
        <MatterScene>
          <MeshGradient />
          <VisualTestPause />
        </MatterScene>
      </div>
      <section style={{ padding: '2rem', maxWidth: '60ch', margin: '0 auto' }}>
        <h1 style={{ marginTop: 0 }}>&lt;MeshGradient /&gt;</h1>
        <p>Rebuild in progress. Tweakpane controls return in later phases.</p>
      </section>
    </main>
  )
}
