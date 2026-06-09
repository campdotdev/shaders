'use client';

import dynamic from 'next/dynamic';

const ReducedMotionDemo = dynamic(
  () => import('./ReducedMotionDemo').then((m) => m.ReducedMotionDemo),
  { ssr: false },
);

export default function Page() {
  return (
    <main style={{ padding: '2rem', maxWidth: 1100, margin: '0 auto' }}>
      <h1>Reduced motion playground</h1>
      <p>
        Toggle the OS setting (System Settings &rarr; Accessibility &rarr; Display &rarr; Reduce
        motion) or the runtime override below. With <code>auto</code>, scale follows the OS; with{' '}
        <code>off</code> it is always 1; with <code>slow</code> it is always 0.3; with{' '}
        <code>paused</code> it is always 0.
      </p>
      <ReducedMotionDemo />
    </main>
  );
}
