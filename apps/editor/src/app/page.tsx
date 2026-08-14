'use client';

import dynamic from 'next/dynamic';

const Editor = dynamic(() => import('@/editor/Editor'), { ssr: false });

export default function Page() {
  return <Editor />;
}
