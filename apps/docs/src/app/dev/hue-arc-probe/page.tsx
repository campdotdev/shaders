'use client';

import dynamic from 'next/dynamic';

// three/webgpu references `self` at module load and cannot SSR, so the grid
// (which pulls in addPlaneMesh -> three/webgpu) is loaded client-only.
const ProbeGrid = dynamic(() => import('./ProbeGrid'), { ssr: false });

export default function HueArcProbePage() {
  return <ProbeGrid />;
}
