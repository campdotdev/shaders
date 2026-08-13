'use client';

import dynamic from 'next/dynamic';

// three/webgpu references `self` at module load and cannot SSR, so the
// generated scene loads client-only. Dev route: invisible to production
// builds without INCLUDE_DEV_ROUTES=1.
const GeneratedPreview = dynamic(() => import('./preview'), { ssr: false });

export default function GeneratedPreviewPage() {
  return <GeneratedPreview />;
}
