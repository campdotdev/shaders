'use client';

import dynamic from 'next/dynamic';

// three/webgpu references `self` at module load and cannot SSR, so the rough
// scene is loaded client-only. Dev route: invisible to production builds.
const RoughScene = dynamic(() => import('./rough-scene'), { ssr: false });

export default function Composition1RoughPage() {
  return <RoughScene />;
}
