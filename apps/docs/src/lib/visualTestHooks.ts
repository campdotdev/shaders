'use client'

import dynamic from 'next/dynamic'

export const VisualTestPause = dynamic(() => import('./VisualTestPause').then((m) => m.default), {
  ssr: false,
})
