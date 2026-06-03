'use client'

import dynamic from 'next/dynamic'

const FbmPlayground = dynamic(() => import('./FbmScene'), { ssr: false })

export default function FbmPlaygroundPage() {
  return <FbmPlayground />
}
