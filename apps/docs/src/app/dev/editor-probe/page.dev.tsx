'use client';

import dynamic from 'next/dynamic';

// The editor will pull in three/webgpu (cannot SSR) once the graph-to-TSL
// compile step lands, so the whole canvas loads client-only from the start.
// Dev route: invisible to production builds without INCLUDE_DEV_ROUTES=1.
const Editor = dynamic(() => import('./editor'), { ssr: false });

export default function EditorProbePage() {
  return <Editor />;
}
