'use client';

import dynamic from 'next/dynamic';

// three/webgpu references `self` at module load and cannot SSR, so the probe
// scene is loaded client-only. Dev route: invisible to production builds.
const ProbeScene = dynamic(() => import('./probe-scene'), { ssr: false });

export default function VoronoiProbePage() {
  return <ProbeScene />;
}
