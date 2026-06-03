'use client'

import dynamic from 'next/dynamic'

const OffscreenPauseDemo = dynamic(
  () => import('./OffscreenPauseDemo').then((m) => m.OffscreenPauseDemo),
  { ssr: false },
)

export default function Page() {
  return <OffscreenPauseDemo />
}
