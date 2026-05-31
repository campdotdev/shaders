'use client'

import dynamic from 'next/dynamic'

const AuroraCompare = dynamic(() => import('./AuroraCompare').then((m) => m.AuroraCompare), {
  ssr: false,
})

export default function AuroraComparePage() {
  return <AuroraCompare />
}
