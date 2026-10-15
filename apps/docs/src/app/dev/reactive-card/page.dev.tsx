'use client';

import dynamic from 'next/dynamic';

// The rig loads client-only, like every probe. The card's scene already
// loads three through import(), but the page has nothing to server-render.
// Dev route: invisible to production builds.
const Tuning = dynamic(() => import('./tuning'), { ssr: false });

export default function ReactiveCardPage() {
  return <Tuning />;
}
