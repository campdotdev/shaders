'use client';

import dynamic from 'next/dynamic';

// three/webgpu references `self` at module load and cannot SSR, so the
// benchmark scene is loaded client-only. Dev route: invisible to production
// builds.
const BenchmarkScene = dynamic(() => import('./benchmark-scene'), { ssr: false });

export default function AuroraBenchmarkPage() {
  return <BenchmarkScene />;
}
