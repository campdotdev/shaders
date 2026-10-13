'use client';

// Phase-review route for SHA-224. Loading the scene only in the browser
// keeps three/webgpu's reference to self out of server rendering.
import dynamic from 'next/dynamic';

const ProbeScene = dynamic(() => import('./probe-scene'), { ssr: false });

export default function CursorSmudgeProbePage() {
  return <ProbeScene />;
}
