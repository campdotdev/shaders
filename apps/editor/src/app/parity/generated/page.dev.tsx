'use client';

// Dev-only route (`page.dev.tsx` + INCLUDE_DEV_ROUTES=1 — see next.config.ts)
// rendering the checked-in generated component with no editor chrome. The
// dynamic ssr:false import is required, not stylistic: three/webgpu touches
// `self` at module load and cannot be server-rendered.
import dynamic from 'next/dynamic';

const ParityGeneratedScene = dynamic(() => import('./scene'), { ssr: false });

export default function ParityGeneratedPage() {
  return <ParityGeneratedScene />;
}
