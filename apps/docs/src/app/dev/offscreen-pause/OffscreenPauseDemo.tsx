'use client';

import { ShaderMonitor, ShaderScene } from '@lovo/matter-react';
import { LinearGradient } from '@matter/registry/linear-gradient';

const Spacer = ({ label }: { label: string }) => (
  <div
    style={{
      height: '120vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '1.2rem',
      color: '#666',
      borderTop: '1px solid #333',
      borderBottom: '1px solid #333',
    }}
  >
    {label}
  </div>
);

export function OffscreenPauseDemo() {
  return (
    <main style={{ maxWidth: 800, margin: '0 auto', padding: '2rem' }}>
      <h1>Offscreen pause</h1>
      <p>
        Watch the <code>ShaderMonitor</code> overlay (top-right of the gradient). Scroll until the
        gradient is fully off the top or bottom of the viewport &mdash; fps should drop to 0. Scroll
        back into view &mdash; fps resumes. The DevTools Performance Monitor still works as a
        corroborating CPU indicator (Chrome DevTools &rarr; Performance Monitor &rarr;{' '}
        <strong>CPU usage</strong>).
      </p>
      <Spacer label="Scroll down…" />
      <div style={{ position: 'relative', width: '100%', height: 360, margin: '2rem 0' }}>
        <ShaderScene style={{ borderRadius: 8 }}>
          <LinearGradient angle={45} colors={['#ff7b72', '#7b9cff', '#7bff9c']} speed={1} />
          <ShaderMonitor anchor="top-right" />
        </ShaderScene>
      </div>
      <Spacer label="Keep scrolling — gradient should be off-screen above by now." />
    </main>
  );
}
