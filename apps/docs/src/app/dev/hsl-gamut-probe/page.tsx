'use client';

import dynamic from 'next/dynamic';

// three/webgpu references `self` at module load and cannot SSR, so the grid is
// loaded client-only.
const ProbeGrid = dynamic(() => import('./ProbeGrid'), { ssr: false });

export default function HslGamutProbePage() {
  return <ProbeGrid />;
}
