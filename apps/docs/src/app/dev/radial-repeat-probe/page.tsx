'use client';

import dynamic from 'next/dynamic';

// three/webgpu references `self` at module load and cannot SSR, so the probe
// (which pulls in addPlaneMesh -> three/webgpu) is loaded client-only.
const RepeatProbe = dynamic(() => import('./RepeatProbe'), { ssr: false });

export default function RadialRepeatProbePage() {
  return <RepeatProbe />;
}
