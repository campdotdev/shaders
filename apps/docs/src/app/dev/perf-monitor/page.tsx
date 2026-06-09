'use client';

import dynamic from 'next/dynamic';

const PerfMonitorDemo = dynamic(() => import('./PerfMonitorDemo').then((m) => m.PerfMonitorDemo), {
  ssr: false,
});

export default function Page() {
  return (
    <main style={{ padding: '2rem', maxWidth: 1100, margin: '0 auto' }}>
      <h1>Perf monitor</h1>
      <PerfMonitorDemo />
    </main>
  );
}
